ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "auto_plan" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "user_subscriptions" AS s
SET "auto_plan" = true
WHERE s."trigger" IN ('release', 'on_streaming')
  AND s."is_active" IS TRUE
  AND s."auto_plan" IS FALSE
  AND EXISTS (
    SELECT 1 FROM "user_media_actions" AS a
    WHERE a."user_id" = s."user_id"
      AND a."media_item_id" = s."media_item_id"
      AND a."action" = 'subscribe'
      AND a."payload" ->> 'trigger' = s."trigger"::text
      AND a."context" = 'auto-plan'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "user_media_actions" AS a
    WHERE a."user_id" = s."user_id"
      AND a."media_item_id" = s."media_item_id"
      AND a."action" IN ('subscribe', 'unsubscribe')
      AND a."payload" ->> 'trigger' = s."trigger"::text
      AND a."context" IS DISTINCT FROM 'auto-plan'
  );
