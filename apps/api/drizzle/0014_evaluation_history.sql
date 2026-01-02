-- Migration: Add policy_version to evaluation primary key
-- This enables storing evaluation history per policy version

-- Step 1: Drop the existing primary key constraint
ALTER TABLE media_catalog_evaluations DROP CONSTRAINT media_catalog_evaluations_pkey;

-- Step 2: Add composite primary key (media_item_id, policy_version)
ALTER TABLE media_catalog_evaluations 
ADD CONSTRAINT media_catalog_evaluations_pkey 
PRIMARY KEY (media_item_id, policy_version);

-- Step 3: Add index for efficient queries by active policy
-- (policy_version, status, relevance_score DESC) for homepage/listing queries
CREATE INDEX IF NOT EXISTS media_catalog_eval_policy_status_relevance_idx 
ON media_catalog_evaluations (policy_version, status, relevance_score DESC);

-- Step 4: Add index for finding latest evaluation per item
CREATE INDEX IF NOT EXISTS media_catalog_eval_item_version_idx 
ON media_catalog_evaluations (media_item_id, policy_version DESC);
