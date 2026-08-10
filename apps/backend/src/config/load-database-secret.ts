import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

/** Shape of the secret RDS's `Credentials.fromGeneratedSecret` + SecretTargetAttachment produces. */
interface RdsGeneratedSecret {
  username: string;
  password: string;
  host: string;
  port: number;
  dbname: string;
}

/**
 * If DATABASE_SECRET_ARN is set, fetches the RDS-generated credentials
 * from Secrets Manager and derives DATABASE_URL from them, so
 * ConfigService picks it up the same way it already picks up anything
 * else from .env. When the ARN isn't set (e.g. local dev before AWS
 * infra exists), this is a no-op — whatever DATABASE_URL is already in
 * .env (if anything) is left alone.
 *
 * Deliberately does not swallow errors: if DATABASE_SECRET_ARN is set but
 * the fetch fails (bad ARN, no AWS credentials, wrong region), that's a
 * real configuration problem and should fail bootstrap loudly rather than
 * silently boot with no DATABASE_URL and fail confusingly later.
 */
export async function loadDatabaseUrlFromSecretsManager(): Promise<void> {
  const secretArn = process.env.DATABASE_SECRET_ARN;
  if (!secretArn) return;

  const client = new SecretsManagerClient({ region: process.env.AWS_REGION || "eu-west-2" });
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!response.SecretString) {
    throw new Error(`Secret ${secretArn} has no SecretString`);
  }

  const secret: RdsGeneratedSecret = JSON.parse(response.SecretString);
  const encodedPassword = encodeURIComponent(secret.password);
  process.env.DATABASE_URL = `postgresql://${secret.username}:${encodedPassword}@${secret.host}:${secret.port}/${secret.dbname}`;
}
