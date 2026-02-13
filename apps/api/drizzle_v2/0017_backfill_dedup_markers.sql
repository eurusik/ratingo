-- Backfill: initialize dedup markers for subscriptions missing them.
-- Prevents retro-notifications when sync-tracked-shows runs.
-- Sets markers to current aired state so only genuinely NEW content triggers notifications.

-- 1. Fill last_notified_episode_key for new_episode subscriptions
--    Uses the highest aired episode (by season+episode number) per media item.
UPDATE user_subscriptions us
SET
  last_notified_episode_key = lat.episode_key,
  updated_at = now()
FROM (
  SELECT DISTINCT ON (us2.id)
    us2.id AS sub_id,
    'S' || s.number || 'E' || e.number AS episode_key
  FROM user_subscriptions us2
  JOIN shows sh ON sh.media_item_id = us2.media_item_id
  JOIN seasons s ON s.show_id = sh.id
  JOIN episodes e ON e.season_id = s.id
  WHERE us2.trigger = 'new_episode'
    AND us2.is_active = true
    AND us2.last_notified_episode_key IS NULL
    AND e.air_date IS NOT NULL
    AND e.air_date <= now()
  ORDER BY us2.id, s.number DESC, e.number DESC
) lat
WHERE us.id = lat.sub_id;

-- 2. Fill last_notified_season_number for new_season subscriptions
--    Uses the highest aired season (that has at least one aired episode).
UPDATE user_subscriptions us
SET
  last_notified_season_number = lat.season_number,
  updated_at = now()
FROM (
  SELECT DISTINCT ON (us2.id)
    us2.id AS sub_id,
    s.number AS season_number
  FROM user_subscriptions us2
  JOIN shows sh ON sh.media_item_id = us2.media_item_id
  JOIN seasons s ON s.show_id = sh.id
  JOIN episodes e ON e.season_id = s.id
  WHERE us2.trigger = 'new_season'
    AND us2.is_active = true
    AND us2.last_notified_season_number IS NULL
    AND e.air_date IS NOT NULL
    AND e.air_date <= now()
  ORDER BY us2.id, s.number DESC
) lat
WHERE us.id = lat.sub_id;
