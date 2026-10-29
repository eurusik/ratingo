-- Case-insensitive uniqueness for email.
-- The application now looks users up with lower(email) and lower-cases new emails, so
-- "A@x.com" and "a@x.com" must not exist as two accounts.
--
-- Accounts that already differ only by email case cannot be merged automatically, so the
-- migration aborts with a count instead. Find them with:
--   SELECT lower(email), array_agg(id) FROM users GROUP BY 1 HAVING count(*) > 1;
--
-- Username is intentionally not covered yet: production has a username pair that differs
-- only by case. The application already rejects new case-insensitive duplicates; add
-- users_username_lower_uniq in a later migration once that pair is resolved.
--
-- Idempotent (IF NOT EXISTS). No CONCURRENTLY: drizzle-kit migrate wraps migrations in a
-- transaction; users is small.

DO $$
DECLARE
  dup_emails integer;
BEGIN
  SELECT count(*) INTO dup_emails
  FROM (SELECT 1 FROM "users" GROUP BY lower("email") HAVING count(*) > 1) d;

  IF dup_emails > 0 THEN
    RAISE EXCEPTION 'users has % email(s) that differ only by case; resolve them before applying 0030',
      dup_emails;
  END IF;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_uniq" ON "users" USING btree (lower("email"));
