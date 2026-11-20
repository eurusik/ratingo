ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "known_premiere_date" timestamp;--> statement-breakpoint
UPDATE "user_subscriptions" AS s
SET "known_premiere_date" = m."release_date"
FROM "media_items" AS m
WHERE m."id" = s."media_item_id"
  AND s."trigger" = 'premiere'
  AND s."known_premiere_date" IS NULL
  AND m."release_date" IS NOT NULL;
