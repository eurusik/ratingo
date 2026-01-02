-- Enable pg_trgm extension for trigram-based fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index on title for fast trigram search
CREATE INDEX IF NOT EXISTS media_title_trgm_idx ON media_items USING gin (title gin_trgm_ops);

-- Create GIN index on original_title for searching by original title
CREATE INDEX IF NOT EXISTS media_original_title_trgm_idx ON media_items USING gin (original_title gin_trgm_ops);
