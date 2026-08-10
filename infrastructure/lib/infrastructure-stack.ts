import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as iam from "aws-cdk-lib/aws-iam";
import * as budgets from "aws-cdk-lib/aws-budgets";

export interface KeloInfrastructureStackProps extends cdk.StackProps {
  /** Recipient for the AWS Budgets "over $20/month" email alert. */
  budgetAlertEmail: string;
}

const DB_PORT = 5432;

export class KeloInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: KeloInfrastructureStackProps) {
    super(scope, id, props);

    // ---------------------------------------------------------------------
    // Network
    //
    // Cost decision: natGateways: 0. A NAT Gateway is ~$32-38/month in
    // hourly charges alone before any data processing — often the single
    // biggest line item in a small dev VPC, and unnecessary here:
    //   - RDS in an ISOLATED subnet never needs outbound internet access.
    //   - The SSM bastion needs outbound access only to reach AWS's SSM
    //     endpoints, which a plain Internet Gateway (free) provides via a
    //     PUBLIC subnet — as long as inbound stays fully closed, a public
    //     subnet costs nothing extra and is exactly what "outbound-only,
    //     no inbound rule ever" requires.
    // The alternative to a public subnet here would be VPC Interface
    // Endpoints for SSM/SSMMessages/EC2Messages (verified pricing: $0.011/hr
    // per endpoint, ~$8/month each, ~$24/month combined for the 3 needed,
    // plus data processing) — strictly more private (the bastion would
    // have no public IP at all) but real ongoing cost for a dev-only
    // bastion used occasionally. Flagging this as the tradeoff: public
    // subnet + zero inbound rules (free, chosen here) vs. private subnet +
    // interface endpoints (fully network-isolated, ~$24/month extra).
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2, // RDS subnet groups require >= 2 AZs even for a Single-AZ instance
      natGateways: 0,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "isolated",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // ---------------------------------------------------------------------
    // SSM bastion — reaches the database via `aws ssm start-session` port
    // forwarding. No SSH, no key pair, no inbound security group rule ever.
    //
    // Cost decision: t4g.micro, not the even-smaller/cheaper t4g.nano —
    // this account enforces free-tier-eligible instance types only
    // (confirmed by a real deploy failure: "The specified instance type
    // is not eligible for Free Tier"), and t4g.nano isn't on that list
    // even though t4g.micro and t4g.small are. Verified via
    // `aws ec2 describe-instance-types --filters
    // Name=free-tier-eligible,Values=true`. On-demand this is $0.0094/hr
    // (~$6.86/month if left running 24/7) — but free-tier eligible means
    // likely $0 if this account is still within its 12-month window.
    // Since this is only used for occasional admin access, stop it
    // between uses (see the final summary) regardless, to avoid relying
    // on that assumption.
    const bastionSecurityGroup = new ec2.SecurityGroup(this, "BastionSecurityGroup", {
      vpc,
      description: "SSM bastion - no inbound rules; reachable only via SSM Session Manager",
      allowAllOutbound: true, // needed to reach the SSM/SSMMessages/EC2Messages endpoints and RDS
    });
    // Deliberately no addIngressRule call at all — this is the point.

    const bastionRole = new iam.Role(this, "BastionRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      description: "Grants the SSM bastion instance Session Manager access, nothing else",
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")],
    });

    const bastion = new ec2.Instance(this, "Bastion", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
      securityGroup: bastionSecurityGroup,
      role: bastionRole,
      requireImdsv2: true,
      // Amazon Linux 2023 ships the SSM agent pre-installed and running —
      // no user-data bootstrap needed for Session Manager to work.
    });
    cdk.Tags.of(bastion).add("Name", "kelo-ssm-bastion");

    // ---------------------------------------------------------------------
    // Database
    const dbSecurityGroup = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
      vpc,
      description: "RDS Postgres - inbound allowed only from the SSM bastion security group",
      allowAllOutbound: false,
    });
    // Security-group-to-security-group reference, not an IP or CIDR — this
    // is what makes "no public inbound access, not even an IP allowlist"
    // true even for the one thing that's allowed to reach it.
    dbSecurityGroup.addIngressRule(
      bastionSecurityGroup,
      ec2.Port.tcp(DB_PORT),
      "From the SSM bastion only"
    );

    const database = new rds.DatabaseInstance(this, "Database", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_17_9,
      }),
      // db.t4g.micro: Graviton/ARM, cheaper on-demand than the Intel
      // db.t3.micro equivalent, and both instance classes are equally
      // covered by the RDS Free Tier (750 hrs/month combined, 12 months
      // from account creation) — see the cost estimate for whether this
      // account is actually still inside that window.
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      allocatedStorage: 20,
      storageType: rds.StorageType.GP3, // cheaper than gp2 at this size
      multiAz: false, // dev only — doesn't need to survive a zone outage yet
      // No read replicas: simply never adding one is sufficient, there's
      // no "off" switch to set.
      backupRetention: cdk.Duration.days(1), // minimum that still gives a same-day restore point
      deleteAutomatedBackups: true,
      // Performance Insights and Enhanced Monitoring both left off by
      // omission — neither is enabled unless explicitly configured.
      storageEncrypted: true, // AWS-managed KMS key — no cost, no reason not to
      credentials: rds.Credentials.fromGeneratedSecret("kelo_app"),
      databaseName: "kelo",
      // Dev environment: prioritize easy teardown over data durability on
      // stack deletion. Real tradeoff, flagging it explicitly rather than
      // picking silently — RemovalPolicy.DESTROY means `cdk destroy` (or
      // removing this construct) deletes the database AND its data with
      // no final snapshot. Switch to SNAPSHOT once there's data worth
      // keeping across a teardown.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });
    cdk.Tags.of(database).add("Name", "kelo-dev-db");

    // ---------------------------------------------------------------------
    // Budget alert — $20/month, email when actual cost exceeds it.
    new budgets.CfnBudget(this, "MonthlyBudget", {
      budget: {
        budgetName: "kelo-dev-monthly",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: {
          amount: 20,
          unit: "USD",
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold: 100,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [
            {
              subscriptionType: "EMAIL",
              address: props.budgetAlertEmail,
            },
          ],
        },
      ],
    });

    // ---------------------------------------------------------------------
    // Outputs
    new cdk.CfnOutput(this, "DatabaseSecretArn", {
      value: database.secret!.secretArn,
      description: "Secrets Manager ARN holding the generated DB credentials + connection info",
    });
    new cdk.CfnOutput(this, "DatabaseEndpoint", {
      value: database.dbInstanceEndpointAddress,
      description: "RDS endpoint hostname (only reachable from inside the VPC, e.g. via the SSM tunnel)",
    });
    new cdk.CfnOutput(this, "DatabasePort", {
      value: database.dbInstanceEndpointPort,
    });
    new cdk.CfnOutput(this, "BastionInstanceId", {
      value: bastion.instanceId,
      description: "Use with `aws ssm start-session` to tunnel to the database",
    });
    new cdk.CfnOutput(this, "VpcId", {
      value: vpc.vpcId,
    });
  }
}
