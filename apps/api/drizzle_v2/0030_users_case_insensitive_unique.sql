-- Case-insensitive uniqueness for email and username.
-- The application now looks users up with lower(...) and lower-cases new emails, so
-- "A@x.com" and "a@x.com" must not exist as two accounts.
--
-- Accounts that already differ only by case cannot be merged automatically, so the
-- migration aborts with a summary instead. Find them with:
--   SELECT lower(email), array_agg(id) FROM users GROUP BY 1 HAVING count(*) > 1;
--   SELECT lower(username), array_agg(id) FROM users GROUP BY 1 HAVING count(*) > 1;
--
-- No CONCURRENTLY: drizzle-kit migrate wraps migrations in a transaction; users is small.

DO $$
DECLARE
  dup_emails integer;
  dup_usernames integer;
BEGIN
  SELECT count(*) INTO dup_emails
  FROM (SELECT 1 FROM "users" GROUP BY lower("email") HAVING count(*) > 1) d;
  SELECT count(*) INTO dup_usernames
  FROM (SELECT 1 FROM "users" GROUP BY lower("username") HAVING count(*) > 1) d;

  IF dup_emails > 0 OR dup_usernames > 0 THEN
    RAISE EXCEPTION 'users has % email(s) and % username(s) that differ only by case; resolve them before applying 0030',
      dup_emails, dup_usernames;
  END IF;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX "users_email_lower_uniq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_uniq" ON "users" USING btree (lower("username"));
