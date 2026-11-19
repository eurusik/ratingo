INSERT INTO "user_subscriptions" ("user_id", "media_item_id", "trigger", "channel", "is_active")
SELECT DISTINCT planned."user_id", planned."media_item_id", pending."trigger", 'push', true
FROM (
  SELECT "user_id", "media_item_id" FROM "user_media_state" WHERE "state" = 'planned'
  UNION
  SELECT "user_id", "media_item_id" FROM "user_saved_items" WHERE "list" = 'for_later'
) AS planned
INNER JOIN "users" AS u ON u."id" = planned."user_id" AND u."auto_subscribe_on_watch" IS TRUE
INNER JOIN "media_items" AS mi ON mi."id" = planned."media_item_id" AND mi."type" = 'movie' AND mi."deleted_at" IS NULL
INNER JOIN "movies" AS m ON m."media_item_id" = mi."id"
CROSS JOIN LATERAL (
  VALUES
    (
      'on_streaming'::"subscription_trigger",
      CASE
        WHEN m."digital_release_date" IS NOT NULL THEN m."digital_release_date" >= (now() AT TIME ZONE 'utc')::date
        ELSE coalesce(m."theatrical_release_date", mi."release_date") IS NULL
          OR coalesce(m."theatrical_release_date", mi."release_date") >= (now() AT TIME ZONE 'utc')::date - 180
      END
    ),
    (
      'release'::"subscription_trigger",
      coalesce(m."theatrical_release_date", m."digital_release_date", mi."release_date") IS NULL
        OR coalesce(m."theatrical_release_date", m."digital_release_date", mi."release_date") >= (now() AT TIME ZONE 'utc')::date
    )
) AS pending("trigger", "is_pending")
WHERE pending."is_pending"
ON CONFLICT ("user_id", "media_item_id", "trigger", "channel") DO NOTHING;
