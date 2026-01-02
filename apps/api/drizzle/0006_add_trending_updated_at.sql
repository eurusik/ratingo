-- Add trending_updated_at column to track when item was last updated by trending sync
ALTER TABLE media_items ADD COLUMN trending_updated_at TIMESTAMP;

-- Create index for efficient querying of recently updated trending items
CREATE INDEX media_trending_updated_idx ON media_items (trending_updated_at DESC) WHERE trending_updated_at IS NOT NULL;
