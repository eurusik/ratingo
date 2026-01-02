-- Migration: Create catalog_evaluation_runs table
-- Tracks RE_EVALUATE_CATALOG job runs for monitoring and resumability
-- Requirements: 11.1

-- Create evaluation_run_status enum
CREATE TYPE evaluation_run_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- Create catalog_evaluation_runs table
CREATE TABLE catalog_evaluation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version integer NOT NULL,
  status evaluation_run_status NOT NULL DEFAULT 'pending',
  started_at timestamp NOT NULL DEFAULT now(),
  finished_at timestamp,
  cursor text,  -- For resumability - stores last processed item ID
  counters jsonb NOT NULL DEFAULT '{"processed":0,"eligible":0,"ineligible":0,"review":0,"reasonBreakdown":{}}'
);

-- Index on policy_version for finding runs by policy
CREATE INDEX catalog_eval_runs_policy_version_idx 
ON catalog_evaluation_runs (policy_version);

-- Index on status for filtering active/failed runs
CREATE INDEX catalog_eval_runs_status_idx 
ON catalog_evaluation_runs (status);
