-- Add new subscription trigger enum values
-- new_episode: New episode aired
-- status_changed: Show status changed (e.g., renewed, canceled)

ALTER TYPE subscription_trigger ADD VALUE IF NOT EXISTS 'new_episode';
ALTER TYPE subscription_trigger ADD VALUE IF NOT EXISTS 'status_changed';

-- Add dedup marker columns to prevent duplicate notifications
ALTER TABLE user_subscriptions 
  ADD COLUMN IF NOT EXISTS last_notified_episode_key TEXT,
  ADD COLUMN IF NOT EXISTS last_notified_season_number INTEGER;
