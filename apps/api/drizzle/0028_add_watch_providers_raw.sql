-- Add watch_providers_raw column to media_items table
-- This column stores raw watch providers data from TMDB before normalization

ALTER TABLE "media_items"
ADD COLUMN IF NOT EXISTS "watch_providers_raw" jsonb DEFAULT null;

-- Add comment for documentation
COMMENT ON COLUMN "media_items"."watch_providers_raw" IS 'Raw watch providers data from TMDB. Normalized offers are stored in media_watch_offers table. Deprecated: Use media_watch_offers for policy evaluation.';
