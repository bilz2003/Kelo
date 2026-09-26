/**
 * The ONE definition of what "the same email address" means in Kelo:
 * surrounding whitespace removed, lower-cased.
 *
 * The backend applies it to every email it accepts (see NormalizedEmail in
 * apps/backend/src/auth/dto) before any lookup or uniqueness check, so
 * Grace@Example.com and grace@example.com are one account. Clients must NOT
 * normalise on their own to "help" — that is how the two clients once
 * disagreed. They only use this to COMPARE two things a person typed (the
 * website's "Confirm email" field), never to alter what is sent.
 *
 * Lower-casing the local part is not strictly RFC-correct, but no mainstream mail
 * provider treats it as case-sensitive, and treating it so here is what let
 * one person register twice.
 */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
