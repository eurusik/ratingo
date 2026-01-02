-- Migration: Extend catalog_evaluation_runs for Policy Activation Flow
-- Adds two-phase activation support (Prepare → Promote)
-- Requirements: 1.1, 6.1

-- Step 1: Add new enum values for run status
-- Note: PostgreSQL doesn't support removing enum values easily, so we keep 'completed' 
-- and add new values. Code will use 'success' instead of 'completed'.
ALTER TYPE evaluation_run_status ADD VALUE IF NOT EXISTS 'success';
ALTER TYPE evaluation_run_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE evaluation_run_status ADD VALUE IF NOT EXISTS 'promoted';

-- Step 2: Add new columns to catalog_evaluation_runs
ALTER TABLE catalog_evaluation_runs
ADD COLUMN IF NOT EXISTS target_policy_id uuid REFERENCES catalog_policies(id),
ADD COLUMN IF NOT EXISTS target_policy_version integer,
ADD COLUMN IF NOT EXISTS total_ready_snapshot integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS snapshot_cutoff timestamp,
ADD COLUMN IF NOT EXISTS eligible integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ineligible integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS errors integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_sample jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS promoted_at timestamp,
ADD COLUMN IF NOT EXISTS promoted_by text;

-- Step 3: Create index on target_policy_id
CREATE INDEX IF NOT EXISTS catalog_eval_runs_target_policy_idx 
ON catalog_evaluation_runs (target_policy_id);

-- Step 4: Create partial unique index to prevent concurrent runs for same policy
-- Only one RUNNING run allowed per policy at a time
CREATE UNIQUE INDEX IF NOT EXISTS catalog_eval_runs_running_policy_uniq 
ON catalog_evaluation_runs (target_policy_id) 
WHERE status = 'running';

-- Note: Existing runs will have NULL target_policy_id/target_policy_version
-- New runs created via PolicyActivationService will populate these fields
