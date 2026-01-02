-- Migration: Create media_catalog_evaluations table
-- Stores evaluation results for each media item based on catalog policy
-- Requirements: 1.2, 1.3, 1.5

-- Create eligibility_status enum
CREATE TYPE eligibility_status AS ENUM ('pending', 'eligible', 'ineligible', 'review');

-- Create media_catalog_evaluations table
CREATE TABLE media_catalog_evaluations (
  media_item_id uuid PRIMARY KEY REFERENCES media_items(id) ON DELETE CASCADE,
  status eligibility_status NOT NULL DEFAULT 'pending',
  reasons text[] NOT NULL DEFAULT '{}',
  relevance_score integer NOT NULL DEFAULT 0,
  policy_version integer NOT NULL DEFAULT 0,  -- 0 = no policy / pending seed
  breakout_rule_id text,
  evaluated_at timestamp  -- NULL for pending, set when actually evaluated
);

-- Constraint: relevance_score must be 0-100
ALTER TABLE media_catalog_evaluations 
ADD CONSTRAINT media_catalog_eval_relevance_range 
CHECK (relevance_score >= 0 AND relevance_score <= 100);

-- Index on status for filtering by eligibility
CREATE INDEX media_catalog_eval_status_idx 
ON media_catalog_evaluations (status);

-- Composite index on status and relevance_score for homepage queries
CREATE INDEX media_catalog_eval_status_relevance_idx 
ON media_catalog_evaluations (status, relevance_score);

-- Index on policy_version for tracking which policy was used
CREATE INDEX media_catalog_eval_policy_version_idx 
ON media_catalog_evaluations (policy_version);
