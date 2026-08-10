import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { loadDatabaseUrlFromSecretsManager } from "./config/load-database-secret";

async function bootstrap() {
  // Must happen before NestFactory.create, since ConfigModule reads
  // process.env at module init — this is what makes DATABASE_URL show up
  // via ConfigService exactly like anything else in .env, whether it came
  // from Secrets Manager or a plain local .env value.
  await loadDatabaseUrlFromSecretsManager();

  const app = await NestFactory.create(AppModule);
  // CORS is a browser-only restriction — the shipped app is native
  // (iOS/Android), never subject to it, and auth here is bearer-token based
  // (no cookies), so an open origin doesn't expose session hijacking the
  // way it would for cookie auth. Enabled for any future browser-based
  // client (a web dashboard, local dev tooling) without needing per-origin
  // configuration up front.
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  const configService = app.get(ConfigService);
  const port = configService.get<number>("PORT", 3000);
  await app.listen(port);
}

bootstrap();
