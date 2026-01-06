-- Migration: Add context column to media_catalog_evaluations
-- Purpose: Enable context-aware evaluations (catalog vs trending vs homepage etc.)
-- 
-- This allows the same media item to have different eligibility per display surface.
-- For example: a movie might be PENDING for catalog (missing data) but ELIGIBLE for trending
-- (where we apply relaxed requirements).

-- Step 1: Create enum type for evaluation context
CREATE TYPE evaluation_context AS ENUM (
  'catalog',
  'trending',
  'homepage',
  'now_playing',
  'new_digital',
  'search'
);

-- Step 2: Add context column with default 'catalog' for existing rows
ALTER TABLE media_catalog_evaluations
ADD COLUMN context evaluation_context NOT NULL DEFAULT 'catalog';

-- Step 3: Drop existing primary key
ALTER TABLE media_catalog_evaluations
DROP CONSTRAINT media_catalog_evaluations_pkey;

-- Step 4: Create new composite primary key including context
ALTER TABLE media_catalog_evaluations
ADD CONSTRAINT media_catalog_evaluations_pkey 
PRIMARY KEY (media_item_id, policy_version, context);

-- Step 5: Add index for context-based queries
CREATE INDEX media_catalog_eval_context_idx 
ON media_catalog_evaluations (context);

-- Step 6: Add composite index for trending queries
CREATE INDEX media_catalog_eval_context_status_idx 
ON media_catalog_evaluations (context, status, relevance_score DESC);

-- Step 7: Update existing indexes to include context where beneficial
-- (existing indexes remain valid for backward compatibility)

COMMENT ON COLUMN media_catalog_evaluations.context IS 
'Display surface context for this evaluation. Same item can have different eligibility per context.';
