# Kelo database — operational reference

Last verified against live AWS state: **2026-08-10 19:23 UTC**, via AWS CLI (account `682579209187`, region `eu-west-2`) plus a direct `psql` connection through the SSM tunnel. Everything below is what was actually confirmed deployed/present at that moment, not a restatement of what was intended — re-run the commands in this doc if you need current state and it's been a while.

---

## ⚠️ Read this before running the backend locally

**`apps/backend` runs on your machine, outside the VPC. RDS has zero public inbound access — not even an IP allowlist. The database is only reachable through an SSM tunnel to the bastion instance.**

This is not a one-time setup step. It's part of the normal dev loop, every session:

```bash
# 1. Open the tunnel (leave this running in its own terminal)
aws ssm start-session \
  --target i-0c99c7ca2e8b5607c \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["keloinfrastructuredev-databaseb269d8bb-nrzicuotl6yw.czkuagqymi46.eu-west-2.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["15432"]}' \
  --region eu-west-2

# 2. Then, in a second terminal, run the backend as normal
cd apps/backend && npm run start:dev
```

If the tunnel isn't open, `apps/backend` will fail to reach the database the moment anything tries to use `DATABASE_URL` (nothing does yet — see "Schema status" below — but this will matter as soon as a real DB connection is wired up).

Requires `session-manager-plugin` on your machine (`aws ssm start-session` fails without it). Check with `session-manager-plugin --version`; install via `brew install --cask session-manager-plugin` if missing, or download the standalone bundle directly if you don't have `sudo`/an interactive terminal available (see "Known gotchas" below — this exact situation came up during setup).

---

## What's deployed

Confirmed live via `aws rds describe-db-instances`:

| Property | Value |
|---|---|
| Identifier | `keloinfrastructuredev-databaseb269d8bb-nrzicuotl6yw` |
| Status | `available` |
| Engine | PostgreSQL 17.9 |
| Instance class | `db.t4g.micro` (ARM/Graviton) |
| Storage | 20 GB, gp3, encrypted |
| Multi-AZ | No (single-AZ) |
| Backup retention | 1 day |
| Performance Insights | Off |
| Enhanced Monitoring | Off |
| Publicly accessible | No |
| Endpoint | `keloinfrastructuredev-databaseb269d8bb-nrzicuotl6yw.czkuagqymi46.eu-west-2.rds.amazonaws.com` |
| Port | 5432 |
| DB name | `kelo` |
| VPC | `vpc-0c5c2b7a722aac0ca` |

**Security group rules — confirmed live, not assumed** (`aws ec2 describe-security-groups`):
- DB security group (`sg-0c4d00dde5d2dfad7`): exactly one inbound rule — TCP 5432 from security group `sg-0649b69397b649067` (the bastion) only. `IpRanges: []` — no CIDR, no IP allowlist, nothing public.
- Bastion security group (`sg-0649b69397b649067`): **zero inbound rules of any kind.** It's reachable only via SSM Session Manager, never by an open port.

**Bastion instance:**
| Property | Value |
|---|---|
| Instance ID | `i-0c99c7ca2e8b5607c` |
| Type | `t4g.micro` |
| State at last check | `running` — **stop it when not in use, see Cost section** |
| Subnet | `subnet-0ab78851132d252b1` (public subnet, but no inbound rule — see gotcha below for why it's public at all) |

Re-check current state anytime with:
```bash
aws ec2 describe-instances --instance-ids i-0c99c7ca2e8b5607c --region eu-west-2 --query "Reservations[0].Instances[0].State.Name"
aws rds describe-db-instances --region eu-west-2 --query "DBInstances[0].DBInstanceStatus"
```

---

## Known gotchas hit during this deploy

**IAM permissions.** The `kelo-dev` user's group (`kelo-dev-group`) originally only had `AmazonRDSFullAccess`, `IAMFullAccess`, `SecretsManagerReadWrite`, `AmazonVPCFullAccess`, `AmazonS3FullAccess`, `AWSCloudFormationFullAccess`. That's not enough to deploy this stack. Five more were added manually (confirmed still attached):

| Policy | Why |
|---|---|
| `AmazonEC2ContainerRegistryFullAccess` | CDK bootstrap creates an ECR repo for container image assets, even though this stack has none |
| `AmazonEC2FullAccess` | `AmazonVPCFullAccess` covers networking (subnets, security groups, gateways) but **not** `ec2:RunInstances`/`ec2:CreateLaunchTemplate` — launching the bastion needs this separately |
| `AWSLambda_FullAccess` | CDK's VPC construct deploys a small Lambda-backed custom resource to restrict the default security group |
| `AmazonSSMFullAccess` | CDK bootstrap's version marker (SSM Parameter) + the AMI ID lookup for the bastion |
| Inline `budgets:*` (policy name `BudgetsFullAccess`) | No AWS-managed "FullAccess" policy exists for Budgets at all — had to be a custom inline policy |

If a future deploy fails with an `AccessDenied` error, check `aws iam list-attached-group-policies --group-name kelo-dev-group` first before assuming the CDK code is wrong.

**Free-tier-eligible-only guardrail.** This account restricts EC2 instances to Free-Tier-eligible types — a real deploy failure surfaced this: `"The specified instance type is not eligible for Free Tier"` when the bastion was originally specified as `t4g.nano`. Confirmed via the authoritative source, not assumed:
```bash
aws ec2 describe-instance-types --filters "Name=free-tier-eligible,Values=true" --region eu-west-2 --query "InstanceTypes[].InstanceType"
```
Eligible in this region: `t3.micro`, `t3.small`, `t4g.micro`, `t4g.small`, plus `c7i-flex.large`/`m7i-flex.large`. **`t4g.nano` is not on this list.** If the bastion (or anything else EC2-based) ever needs resizing, it must stay on this list or the deploy will fail the same way again.

This guardrail is also the strongest evidence available that **this account is currently inside its 12-month Free Tier window** — see Cost section.

**`session-manager-plugin` needs `sudo` via Homebrew's cask, which isn't available in a non-interactive/no-TTY environment.** Worked around by downloading AWS's standalone bundle directly and placing the binary in an already-writable `/usr/local/bin`, no elevation needed:
```bash
curl -o /tmp/sessionmanager-bundle.zip "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/mac/sessionmanager-bundle.zip"
unzip -o /tmp/sessionmanager-bundle.zip -d /tmp
cp /tmp/sessionmanager-bundle/bin/session-manager-plugin /usr/local/bin/
chmod +x /usr/local/bin/session-manager-plugin
```

**CDK bootstrap document name.** The port-forwarding SSM document is `AWS-StartPortForwardingSessionToRemoteHost` — easy to typo as `AWS-StartPortForwardingToRemoteHost` (missing "Session"), which fails with `InvalidDocument`. The command at the top of this file has the correct name.

---

## How the backend gets its connection string

`apps/backend/src/config/load-database-secret.ts`, called as the first `await` in `main.ts`'s `bootstrap()`, before `NestFactory.create()`:

1. Reads `DATABASE_SECRET_ARN` from the environment (set in `apps/backend/.env`, gitignored).
2. If unset, it's a no-op — nothing crashes, `DATABASE_URL` is just whatever's already in the environment (nothing, currently).
3. If set, fetches the secret from Secrets Manager, parses it (`username`, `password`, `host`, `port`, `dbname`), and constructs `DATABASE_URL` into `process.env` before Nest's `ConfigModule` reads it — so `ConfigService.get('DATABASE_URL')` works exactly like any other `.env` value, regardless of source.
4. **Fails loudly, not silently**: if the ARN is set but the fetch fails (bad ARN, missing/expired AWS credentials, wrong region), it throws and crashes bootstrap rather than booting with a missing `DATABASE_URL` and failing confusingly later.

Current secret ARN (`apps/backend/.env`, and confirmed live via `aws secretsmanager list-secrets`):
```
arn:aws:secretsmanager:eu-west-2:682579209187:secret:KeloInfrastructureDevDataba-3PaZqKL0GhaL-UgueCv
```
Requires AWS credentials available via the default credential chain (e.g. `aws configure`) wherever the backend runs — it doesn't ship its own keys.

---

## Schema status: migrated, empty

Tables exist and match `apps/backend/prisma/schema.prisma`, applied via two real migrations (`prisma migrate dev`, not just `db push`) — confirmed live via `psql`, not just a clean exit code:

```bash
# through the SSM tunnel, per the top of this file
psql -h 127.0.0.1 -p 15432 -U kelo_app -d kelo -c "\dt"
```
```
               List of relations
 Schema |        Name        | Type  |  Owner
--------+--------------------+-------+----------
 public | Booking            | table | kelo_app
 public | Charger            | table | kelo_app
 public | RefreshToken       | table | kelo_app
 public | Session            | table | kelo_app
 public | Transaction        | table | kelo_app
 public | User               | table | kelo_app
 public | _prisma_migrations | table | kelo_app
(7 rows)
```

Models: `User`, `Charger`, `Booking`, `Session`, `Transaction` — matches `BACKEND-PLAN.md` §2 — plus `RefreshToken` (added for refresh-token rotation, not part of the original plan doc). Migrations live at `apps/backend/prisma/migrations/20260810192119_init/` and `.../20260810193840_add_refresh_tokens/`. `RefreshToken.tokenHash` stores a SHA-256 hash only, never the plaintext token.

**Tables are empty.** A full register → login → create-charger → create-booking smoke test was run end-to-end against this real database and then deliberately cleaned up (`DELETE FROM` on the rows it created) so the schema stays proven-working without leaving fake data behind. No seed data exists.

**Field naming**: schema field names mirror `@kelo/core`'s `Charger` type wherever they represent the same concept (`rate`, `overstayRate`, `idleRate`, `noShowFee`, `postcode`, `fullAddress`), but the Prisma models are **not** the same type as `@kelo/core`'s hand-written ones and were deliberately kept separate — see the comment at the top of `apps/backend/prisma/schema.prisma` for why (short version: `@prisma/client`'s generated types are Node-only and can't be imported into the Metro-bundled mobile app or a platform-agnostic `packages/core`; `@kelo/core`'s `Charger` is an app-facing view model with computed/display fields — `rating`, `sessions`, `distance`, `initials`, the `power` display string — that were deliberately *not* added to the DB schema, since nothing computes them yet).

**Prisma CLI vs the running app use different paths to `DATABASE_URL`:**
- The Nest app (`main.ts`) derives it dynamically at boot from Secrets Manager, via `load-database-secret.ts`.
- The Prisma CLI (`prisma migrate dev`, `prisma studio`, etc.) reads a **literal** `DATABASE_URL` from `apps/backend/.env` directly — it doesn't run `load-database-secret.ts`. That literal value was written once by fetching the same secret manually; see the comment above it in `.env`.
- Both now route through the SSM tunnel (`localhost:15432`), not the raw RDS hostname — `load-database-secret.ts` was fixed to do this via `DATABASE_TUNNEL_LOCAL_PORT` in `.env`, since the raw hostname is unreachable from outside the VPC even with the tunnel open (the tunnel forwards a local port, not the DB's own port directly). Unset `DATABASE_TUNNEL_LOCAL_PORT` once the backend runs somewhere with direct VPC access.

Prisma pinned to **6.19.3**, not the newer 7.x that's now the default `npm install prisma` pulls — 7.x changes the generated client to an ESM-only, driver-adapter-based model that isn't worth the churn for this app's current CommonJS NestJS setup. Revisit later if there's a real reason to.

Auth (registration, login, JWT via `@nestjs/jwt` + Passport, bcrypt) and basic REST CRUD (Users `/users/me`; Chargers and Bookings, both scoped to the authenticated user) exist and were verified against this real database — see `apps/backend/src/auth/`, `src/users/`, `src/chargers/`, `src/bookings/`. No-show/idle/overstay scheduled-job rules (BACKEND-PLAN.md §4) are **not** implemented yet — deliberately deferred to a later step.

---

## Cost

**Likely actual cost right now: close to $0/month**, not the ~$20/month worst-case originally estimated. The free-tier-eligible-only guardrail this account enforces (see gotchas) is strong, direct evidence this account is still inside its 12-month RDS + EC2 Free Tier window — an account past that window has no reason to carry such a guardrail. This wasn't confirmed via the Billing console directly (the `kelo-dev` user still lacks `freetier:*`/`ce:*` permissions), so treat it as strong inference, not certainty.

**Two AWS Budgets exist on this account** — don't confuse them:
- `kelo-dev-monthly` — the one this stack deployed via CDK. $20/month, email alert to `bilalmhussain2003@gmail.com` when actual cost exceeds 100% of that.
- `My Monthly Cost Budget` — pre-existing, **not created by this infrastructure**, also happens to be $20/month. Unrelated; don't remove or modify it as part of managing this stack.

**Cutting cost further between dev sessions:**
```bash
# RDS: storage cost continues either way, but stopping avoids compute-hour usage
# (and conserves Free Tier hours if this account's usage is being tracked against them)
aws rds stop-db-instance --db-instance-identifier keloinfrastructuredev-databaseb269d8bb-nrzicuotl6yw --region eu-west-2
aws rds start-db-instance --db-instance-identifier keloinfrastructuredev-databaseb269d8bb-nrzicuotl6yw --region eu-west-2
# Note: AWS auto-restarts a stopped RDS instance after 7 days if not restarted manually first.

# Bastion: stop this whenever you're not actively tunneling in — no reason to leave it running
aws ec2 stop-instances --instance-ids i-0c99c7ca2e8b5607c --region eu-west-2
aws ec2 start-instances --instance-ids i-0c99c7ca2e8b5607c --region eu-west-2
```

---

## Deliberately not done yet

- No S3
- No Stripe
- No mock `ChargerAdapter` / WebSocket bridge to the app (BACKEND-PLAN.md §3)
- No no-show/idle/overstay scheduled-job rules (BACKEND-PLAN.md §4)
- No real OCPP or Enode integration (§5/§6)
- No data (schema and auth exist now — see "Schema status" above — but the `kelo` database itself is empty, no seed data)

Don't infer any of the above exists because related-sounding code or docs appear elsewhere — if it's not listed as deployed above, it isn't deployed.

---

## Changing the infrastructure safely

CDK app lives in `infrastructure/` (npm workspace member `@kelo/infrastructure`), stack code in `infrastructure/lib/infrastructure-stack.ts`, entry point `infrastructure/bin/infrastructure.ts`. Stack name: `KeloInfrastructureDev`.

Always, in this order:
```bash
cd infrastructure
npx cdk diff        # review exactly what will change — never skip this
# then, only after reviewing the diff:
npx cdk deploy --require-approval never   # the "never" is for non-interactive sessions only;
                                            # in an interactive terminal, let it prompt you
```
`cdk deploy` without reviewing `cdk diff` first is how the free-tier-instance-type failure above got caught at deploy time instead of before — the diff wouldn't have caught that specific one either (it's a runtime account guardrail, not a template issue), but it's still the only way to know what's about to change before it happens.
