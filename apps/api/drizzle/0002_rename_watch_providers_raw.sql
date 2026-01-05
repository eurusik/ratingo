-- Migration: Rename watch_providers to watch_providers_raw
-- This column stores raw TMDB watch provider data.
-- Normalized offers are now in media_watch_offers table.

ALTER TABLE media_items RENAME COLUMN watch_providers TO watch_providers_raw;
