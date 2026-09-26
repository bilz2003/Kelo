import { applyDecorators } from "@nestjs/common";
import { normalizeEmail } from "@kelo/core";
import { Transform } from "class-transformer";
import { IsEmail } from "class-validator";

/**
 * The single place email input is normalised (trimmed + lower-cased, via the
 * shared normalizeEmail) and validated. Used by BOTH LoginDto and RegisterDto,
 * so every email the auth service ever sees is already in canonical form —
 * before any database lookup or uniqueness check — regardless of which client
 * sent it or how the user typed it.
 *
 * The transform runs before validation, so " Grace@Example.com " is accepted
 * and becomes "grace@example.com" rather than being rejected for its spaces.
 * The database backs this up with a CHECK constraint (User_email_normalised_check):
 * a code path that forgot to normalise fails loudly instead of creating a duplicate.
 */
export const NormalizedEmail = () =>
  applyDecorators(
    Transform(({ value }) => (typeof value === "string" ? normalizeEmail(value) : value)),
    IsEmail(),
  );
