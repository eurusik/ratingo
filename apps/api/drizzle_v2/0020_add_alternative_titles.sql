-- Add alternative_titles column for improved search
ALTER TABLE media_items ADD COLUMN alternative_titles text[];

--> statement-breakpoint

-- Create immutable wrapper for array_to_string (needed for generated columns)
CREATE OR REPLACE FUNCTION immutable_array_to_string(arr text[], sep text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT array_to_string(arr, sep) $$;

--> statement-breakpoint

-- Recreate search_vector generated column to include alternative_titles
-- Must drop dependent index first
DROP INDEX IF EXISTS media_search_idx;
ALTER TABLE media_items DROP COLUMN search_vector;
ALTER TABLE media_items ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(title, '') || ' ' ||
      coalesce(original_title, '') || ' ' ||
      coalesce(overview, '') || ' ' ||
      coalesce(immutable_array_to_string(alternative_titles, ' '), ''))
  ) STORED;

--> statement-breakpoint

-- Recreate GIN index for full-text search
CREATE INDEX media_search_idx ON media_items USING GIN (search_vector);

--> statement-breakpoint

-- GIN trigram index for fuzzy search on alternative titles
CREATE INDEX media_alt_titles_trgm_idx ON media_items
  USING GIN (coalesce(immutable_array_to_string(alternative_titles, ' '), '') gin_trgm_ops);
