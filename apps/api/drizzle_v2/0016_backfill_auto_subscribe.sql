-- Backfill: auto-subscribe existing watchers/completed users
-- to new_season + new_episode notifications.
-- Idempotent via NOT EXISTS — safe on fresh DBs (no rows to backfill).

INSERT INTO user_subscriptions (id, user_id, media_item_id, trigger, is_active, context, created_at, updated_at)
SELECT
  gen_random_uuid(),
  ums.user_id,
  ums.media_item_id,
  t.trigger,
  true,
  'backfill-existing-watchers',
  now(),
  now()
FROM user_media_states ums
CROSS JOIN (VALUES ('new_season'), ('new_episode')) AS t(trigger)
JOIN users u ON u.id = ums.user_id AND u.auto_subscribe_on_watch = true
WHERE ums.state IN ('watching', 'completed')
  AND NOT EXISTS (
    SELECT 1 FROM user_subscriptions us
    WHERE us.user_id = ums.user_id
      AND us.media_item_id = ums.media_item_id
      AND us.trigger = t.trigger
      AND us.is_active = true
  );
