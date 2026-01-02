-- Migration: Add origin metadata to media_items
-- Adds origin_countries (jsonb) and original_language (text) columns
-- Requirements: 1.1

-- Add origin_countries column (jsonb array of ISO 3166-1 alpha-2 codes)
ALTER TABLE media_items 
ADD COLUMN origin_countries jsonb;

-- Add original_language column (ISO 639-1 code)
ALTER TABLE media_items 
ADD COLUMN original_language text;

-- Add index on ingestion_status for public_media_items view performance
-- Only indexes non-deleted items
CREATE INDEX media_items_ingestion_status_idx 
ON media_items (ingestion_status) 
WHERE deleted_at IS NULL;
