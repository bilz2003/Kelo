-- Which client an account was registered through.
--
-- Every account that exists at the time this runs was created before the
-- website existed, so 'mobile' is the correct backfill (it may include a few
-- dev/test accounts created by scripts against the API, which is the same
-- backfill value — there was no other client). The default is dropped
-- immediately after, so every future INSERT must state its source explicitly
-- rather than silently inheriting a default that could be wrong.
CREATE TYPE "CreatedVia" AS ENUM ('web', 'mobile');

ALTER TABLE "User" ADD COLUMN "createdVia" "CreatedVia" NOT NULL DEFAULT 'mobile';
ALTER TABLE "User" ALTER COLUMN "createdVia" DROP DEFAULT;
