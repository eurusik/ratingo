-- Migration: Add content_class to media_items
-- Purpose: Content classification for policy filtering (anime, documentary, reality, kids, mainstream)

-- Step 1: Create enum type
CREATE TYPE content_class AS ENUM ('mainstream', 'anime', 'documentary', 'reality', 'kids');

-- Step 2: Add column with default (all existing items default to 'mainstream')
ALTER TABLE media_items 
ADD COLUMN content_class content_class NOT NULL DEFAULT 'mainstream';

-- Step 3: Create index for efficient filtering
CREATE INDEX media_content_class_idx ON media_items (content_class);

-- Note: Backfill will be done via application code (backfill-content-class.job.ts)
-- to properly classify existing items based on genres and origin metadata.
