-- Split "User"."name" into "firstName" / "lastName".
--
-- Backfill: the first whitespace-delimited token becomes firstName and the
-- remainder (trimmed) becomes lastName. This is a best guess, and knowingly
-- imperfect for names that don't fit "one given name + the rest": a multi-word
-- given name ("Mary Jane Watson") splits as Mary | Jane Watson, and a
-- single-word name ("Cher") gets an empty lastName. It was rehearsed against a
-- temp table of awkward names (hyphens, apostrophes, tabs, non-Latin scripts,
-- extra whitespace) before this was written, and no name can be recovered
-- wrongly enough to be lost: firstName || ' ' || lastName reproduces the original
-- with whitespace collapsed. At the time of writing the table held one real row.
--
-- There is no profile-edit screen, so a wrongly split existing name can only be
-- corrected in the database; new sign-ups supply both parts explicitly.
--
-- The old "name" column is dropped once both new columns are populated and
-- NOT NULL — keeping it would leave two sources of truth to drift apart.
ALTER TABLE "User" ADD COLUMN "firstName" TEXT, ADD COLUMN "lastName" TEXT;

UPDATE "User" SET
  "firstName" = COALESCE(substring(btrim("name") from '^\S+'), ''),
  "lastName"  = btrim(regexp_replace(btrim("name"), '^\S+\s*', ''));

ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL, ALTER COLUMN "lastName" SET NOT NULL;
ALTER TABLE "User" DROP COLUMN "name";
