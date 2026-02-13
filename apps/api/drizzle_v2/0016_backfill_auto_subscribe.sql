-- Backfill: auto-subscribe existing watchers/completed users
-- to new_season + new_episode notifications.
-- Idempotent via NOT EXISTS — safe on fresh DBs (no rows to backfill).

INSERT INTO user_subscriptions (id, user_id, media_item_id, trigger, channel, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  ums.user_id,
  ums.media_item_id,
  t.trigger,
  'push',
  true,
  now(),
  now()
FROM user_media_state ums
CROSS JOIN (VALUES ('new_season'::subscription_trigger), ('new_episode'::subscription_trigger)) AS t(trigger)
JOIN users u ON u.id = ums.user_id AND u.auto_subscribe_on_watch = true
WHERE ums.state IN ('watching', 'completed')
  AND NOT EXISTS (
    SELECT 1 FROM user_subscriptions us
    WHERE us.user_id = ums.user_id
      AND us.media_item_id = ums.media_item_id
      AND us.trigger = t.trigger
  );
