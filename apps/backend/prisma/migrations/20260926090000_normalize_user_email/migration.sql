-- Make "User"."email" case-insensitive in practice: store it trimmed and lower-cased.
--
-- Before this, Grace@Example.com and grace@example.com were two different
-- accounts (the unique index is case-sensitive) and the mobile app, which
-- lower-cased, could not log into a web account registered with capitals.
--
-- 1. REFUSE to proceed if lower-casing would merge two existing accounts. That
--    needs a human decision (which one is the real person? merge or delete?),
--    so the migration aborts with the offending addresses named instead of
--    silently picking a winner. (Checked against the real table beforehand: it
--    held one row, already lower-case, so nothing collides.)
DO $$
DECLARE dup text;
BEGIN
  SELECT string_agg(norm || ' (' || n || ' accounts)', ', ') INTO dup
  FROM (SELECT lower(btrim("email")) AS norm, count(*) AS n FROM "User" GROUP BY 1 HAVING count(*) > 1) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot normalise User.email: these addresses exist more than once differing only in case/whitespace and need a human decision (merge or delete) first: %', dup;
  END IF;
END $$;

-- 2. Backfill: lower-case + trim every stored address that isn't already.
UPDATE "User" SET "email" = lower(btrim("email")) WHERE "email" <> lower(btrim("email"));

-- 3. Make it permanent: the database itself now refuses a non-normalised email,
--    so a code path that forgets to normalise fails loudly instead of quietly
--    creating a second account. (Prisma can't model CHECK constraints; it leaves this one alone.)
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalised_check" CHECK ("email" = lower(btrim("email")));
