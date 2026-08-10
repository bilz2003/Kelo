#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { KeloInfrastructureStack } from "../lib/infrastructure-stack";

const app = new cdk.App();

// This account only ever needs one environment right now — a single
// dev stack, deliberately not parameterized per-environment yet. Revisit
// once there's an actual second (staging/prod) environment to support.
new KeloInfrastructureStack(app, "KeloInfrastructureDev", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  // Budget alert recipient — change if this should go elsewhere.
  budgetAlertEmail: "bilalmhussain2003@gmail.com",
});
