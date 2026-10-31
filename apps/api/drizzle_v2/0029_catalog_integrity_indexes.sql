-- Catalog integrity indexes previously documented in schema comments but never created by migrations.
--
-- NOTE: drizzle-kit migrate runs every migration inside one transaction, so
-- CREATE INDEX CONCURRENTLY is not possible here. All affected tables are small
-- (policies, runs, subscriptions) or moderate (watch offers); the plain build holds
-- a SHARE lock (reads allowed, writes wait) for the duration of each statement.
--
-- Idempotent (IF [NOT] EXISTS): some of these indexes were created by hand in production
-- earlier (e.g. catalog_policies_single_active), so existing ones are kept as-is.
--
-- Pre-steps clean up rows that would violate the new unique indexes:
-- * watch offers are derived data (re-synced from TMDB), so exact duplicates are deleted;
-- * stale duplicate RUNNING evaluation runs are cancelled (newest run per policy is kept);
-- * duplicate policy versions or several active policies cannot be fixed automatically,
--   so the migration aborts with an explicit message instead.

-- 1. Remove duplicate watch offers, keeping the most recently updated row
DELETE FROM "media_watch_offers" a
USING "media_watch_offers" b
WHERE a."media_item_id" = b."media_item_id"
  AND a."provider_id" = b."provider_id"
  AND COALESCE(a."variant_id", 'standard') = COALESCE(b."variant_id", 'standard')
  AND a."distribution_channel" = b."distribution_channel"
  AND a."offer_type" = b."offer_type"
  AND a."region" = b."region"
  AND (a."updated_at", a."id") < (b."updated_at", b."id");--> statement-breakpoint

-- 2. Cancel stale duplicate running runs, keeping the newest one per target policy
UPDATE "catalog_evaluation_runs" r
SET "status" = 'cancelled', "finished_at" = now()
WHERE r."status" = 'running'
  AND r."target_policy_id" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "catalog_evaluation_runs" newer
    WHERE newer."status" = 'running'
      AND newer."target_policy_id" = r."target_policy_id"
      AND (newer."started_at", newer."id") > (r."started_at", r."id")
  );--> statement-breakpoint

-- 3. Abort with a clear message if policy data needs a manual decision
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "catalog_policies" GROUP BY "version" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'catalog_policies has duplicate versions; resolve them before applying 0029';
  END IF;
  IF (SELECT count(*) FROM "catalog_policies" WHERE "is_active" = true) > 1 THEN
    RAISE EXCEPTION 'catalog_policies has more than one active policy; deactivate extras before applying 0029';
  END IF;
END $$;--> statement-breakpoint

DROP INDEX IF EXISTS "catalog_policies_version_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_eval_runs_single_running" ON "catalog_evaluation_runs" USING btree ("target_policy_id") WHERE "catalog_evaluation_runs"."status" = 'running';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_policies_version_uniq" ON "catalog_policies" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_policies_single_active" ON "catalog_policies" USING btree ("is_active") WHERE "catalog_policies"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "media_watch_offers_uniq" ON "media_watch_offers" USING btree ("media_item_id","provider_id",COALESCE("variant_id", 'standard'),"distribution_channel","offer_type","region");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_subscriptions_media_trigger_active_idx" ON "user_subscriptions" USING btree ("media_item_id","trigger") WHERE "user_subscriptions"."is_active" = true;
