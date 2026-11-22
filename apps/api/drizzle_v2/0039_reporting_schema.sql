CREATE SCHEMA IF NOT EXISTS "reporting";--> statement-breakpoint
CREATE OR REPLACE VIEW "reporting"."internal_user_events" AS
SELECT ("created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Kyiv')::date AS "day", "user_id", 'watch_state'::text AS "kind"
FROM "user_media_state" WHERE "state_implied" = false
UNION ALL
SELECT ("created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Kyiv')::date, "user_id", 'rating'
FROM "user_media_state" WHERE "rating" IS NOT NULL
UNION ALL
SELECT ("created_at" AT TIME ZONE 'Europe/Kyiv')::date, "user_id", 'review'
FROM "reviews" WHERE "is_deleted" = false
UNION ALL
SELECT ("created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Kyiv')::date, "user_id", 'save'
FROM "user_media_actions" WHERE "action" IN ('save_for_later', 'consider')
UNION ALL
SELECT ("created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Kyiv')::date, "user_id", 'subscription'
FROM "user_media_actions" WHERE "action" = 'subscribe'
UNION ALL
SELECT ("created_at" AT TIME ZONE 'Europe/Kyiv')::date, "user_id", 'import'
FROM "import_batches";--> statement-breakpoint
CREATE OR REPLACE VIEW "reporting"."daily_new_users" AS
SELECT ("created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Kyiv')::date AS "day", count(*)::integer AS "new_users"
FROM "users"
GROUP BY 1;--> statement-breakpoint
CREATE OR REPLACE VIEW "reporting"."daily_user_actions" AS
SELECT "day", "kind", count(*)::integer AS "actions", count(DISTINCT "user_id")::integer AS "users"
FROM "reporting"."internal_user_events"
GROUP BY "day", "kind";--> statement-breakpoint
CREATE OR REPLACE VIEW "reporting"."daily_active_users" AS
SELECT "day", count(DISTINCT "user_id")::integer AS "active_users"
FROM "reporting"."internal_user_events"
GROUP BY "day";--> statement-breakpoint
CREATE OR REPLACE VIEW "reporting"."catalog_freshness" AS
SELECT
  count(*)::integer AS "items_total",
  max("created_at" AT TIME ZONE 'UTC') AS "newest_item_at",
  max("last_synced_at" AT TIME ZONE 'UTC') AS "last_synced_at"
FROM "media_items"
WHERE "deleted_at" IS NULL;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_reader') THEN
    CREATE ROLE "ai_reader" NOLOGIN;
  END IF;
END
$$;--> statement-breakpoint
GRANT USAGE ON SCHEMA "reporting" TO "ai_reader";--> statement-breakpoint
GRANT SELECT ON "reporting"."daily_new_users", "reporting"."daily_user_actions", "reporting"."daily_active_users", "reporting"."catalog_freshness" TO "ai_reader";
