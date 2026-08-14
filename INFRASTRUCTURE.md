# Kelo infrastructure — non-database resources

Last verified against live AWS state: **2026-08-14 19:25 UTC**, via AWS CLI (account `682579209187`, region `eu-west-2`) plus a real upload/download/delete cycle against the deployed bucket. Everything below is what was actually confirmed deployed/present at that moment, not a restatement of what was intended.

This doc covers infrastructure that isn't the database. For RDS, the bastion, IAM group policies, budgets, and the `cdk diff`/`cdk deploy` workflow, see [DATABASE.md](DATABASE.md) — that account-wide context isn't repeated here.

---

## S3 — charger photos

Confirmed live via `aws s3api head-bucket` / `get-public-access-block`:

| Property | Value |
|---|---|
| Bucket name | `keloinfrastructuredev-chargerphotosbucket4df76e14-uramuvnpkv83` |
| ARN | `arn:aws:s3:::keloinfrastructuredev-chargerphotosbucket4df76e14-uramuvnpkv83` |
| Region | `eu-west-2` |
| Encryption | SSE-S3 (S3-managed key) |
| Versioning | Off |
| Storage class | Standard only (no lifecycle rules, no Intelligent-Tiering) |
| Public access block | All four settings `true` (`BlockPublicAcls`, `IgnorePublicAcls`, `BlockPublicPolicy`, `RestrictPublicBuckets`) |
| Bucket policy | None public — only a narrowly-scoped policy granting the CDK-managed auto-delete custom resource's Lambda role `s3:DeleteObject*`/`s3:GetBucket*`/`s3:List*` on `cdk destroy`, nothing else |
| Removal policy | `DESTROY` + `autoDeleteObjects` — dev-stage, prioritizes easy teardown over durability, same tradeoff as the RDS instance in DATABASE.md |

Defined in `infrastructure/lib/infrastructure-stack.ts` as the `ChargerPhotosBucket` construct, part of the same `KeloInfrastructureDev` stack as the database. No dedicated IAM policy was created for this — `kelo-dev-group`'s existing `AmazonS3FullAccess` (already attached, confirmed via `aws iam list-attached-group-policies`) already covers it.

### Access model: no public access, ever

**There is no path to this bucket that doesn't go through the backend.** Block Public Access is enabled on all four settings, and no bucket policy grants anonymous or public access. Confirmed live — an unauthenticated HTTPS GET against an object in this bucket returns `403 Forbidden`.

The intended access pattern (not yet implemented — this pass is infrastructure only, no backend code was touched): the backend generates short-lived presigned URLs via the AWS SDK, for both uploads (`PutObjectCommand` + `getSignedUrl`) and reads (`GetObjectCommand` + `getSignedUrl`), and the mobile app talks to S3 directly using those URLs, not through the backend as a proxy.

**No IAM role, no static access keys.** The backend doesn't run on any AWS compute service yet (no ECS/Lambda/EC2) — there's no compute resource to attach a real IAM execution role to, so "IAM role-based access" in the strict sense isn't achievable yet. Instead this reuses the same pattern already established for Secrets Manager access in `apps/backend/src/config/load-database-secret.ts`: the AWS SDK's default credential provider chain, backed by the `kelo-dev` IAM user's locally-configured credentials (`aws configure`). No new Secrets Manager entry was needed — there's no secret to store, since nothing here is a static credential. Revisit this once the backend actually deploys onto AWS compute and a real execution role becomes possible.

### Verification performed (2026-08-14)

Real CLI commands against the live deployed bucket, not just "stack deployed":

```bash
aws s3api head-bucket --bucket keloinfrastructuredev-chargerphotosbucket4df76e14-uramuvnpkv83
# → succeeded, bucket exists and is reachable

aws s3api get-public-access-block --bucket keloinfrastructuredev-chargerphotosbucket4df76e14-uramuvnpkv83
# → all four block-public-access settings true

aws s3api put-object --bucket ... --key test/verification-upload.txt --body ...
aws s3api list-objects-v2 --bucket ... --prefix test/        # → object listed
aws s3api get-object --bucket ... --key test/verification-upload.txt ...
# → downloaded content byte-for-byte identical to what was uploaded

curl -s -o /dev/null -w "%{http_code}" https://<bucket>.s3.eu-west-2.amazonaws.com/test/verification-upload.txt
# → 403 (confirms no public/anonymous access works)

aws s3api delete-object --bucket ... --key test/verification-upload.txt
aws s3api list-objects-v2 --bucket ... --prefix test/         # → empty, delete confirmed
```

The test object was deleted after verification — the bucket is empty, same "prove it works, then clean up" standard as the database smoke test in DATABASE.md.

### Cost

Pulled from AWS's public bulk pricing JSON (`https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/eu-west-2/index.json` and the `AWSDataTransfer` equivalent), not estimated:

| Item | Rate (eu-west-2) | Dev-scale assumption | Monthly cost |
|---|---|---|---|
| Storage | $0.024/GB-month | ~50 test images, ~5MB avg → 0.25GB | ~$0.006 |
| PUT/COPY/POST/LIST requests | $0.0053 / 1,000 | ~500/month | ~$0.0027 |
| GET requests | $0.00042 / 1,000 | ~2,000/month | ~$0.0008 |
| Data transfer out | first 100GB/month free (global), then $0.09/GB | well under 100GB | $0.00 |
| Auto-delete custom resource Lambda | only runs on stack deploy/destroy | negligible | ~$0.00 |

**Total: roughly $0.01/month** at this scale. Counts toward the existing `kelo-dev-monthly` $20/month AWS Budgets alert (see DATABASE.md) — no new budget resource was created for this.

---

## Deliberately not done yet

- No presigned-URL generation code in the backend (this pass was infrastructure only — see DATABASE.md-style constraint: application code wasn't touched)
- No lifecycle rules / auto-expiration of old objects
- No versioning
- No CloudFront/CDN in front of the bucket
- No image resizing/thumbnailing pipeline

Don't infer any of the above exists because related-sounding code or docs appear elsewhere — if it's not listed as deployed above, it isn't deployed.
