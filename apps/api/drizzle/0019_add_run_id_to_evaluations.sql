-- Migration: Add run_id to media_catalog_evaluations
-- Purpose: Link evaluations to specific runs for accurate counter aggregation
--
-- Architecture change:
-- - Source of truth = evaluations table (not incrementCounters)
-- - Counters = derived state via COUNT/FILTER aggregation
-- - Jobs are idempotent via UNIQUE(run_id, media_item_id)
--
-- This enables:
-- - Self-healing runs (watchdog can finalize based on actual data)
-- - No race conditions on counter updates
-- - Accurate progress tracking regardless of worker failures

-- Step 1: Add run_id column (nullable initially for existing data)
ALTER TABLE media_catalog_evaluations
ADD COLUMN run_id uuid REFERENCES catalog_evaluation_runs(id) ON DELETE SET NULL;

-- Step 2: Create index for efficient aggregation queries
CREATE INDEX media_catalog_eval_run_id_idx 
ON media_catalog_evaluations(run_id) 
WHERE run_id IS NOT NULL;

-- Step 2b: Composite index for status aggregation per run
CREATE INDEX media_catalog_eval_run_status_idx
ON media_catalog_evaluations(run_id, status)
WHERE run_id IS NOT NULL;

-- Step 3: Create unique constraint for idempotent upserts per run
-- This allows the same item to be evaluated in different runs
CREATE UNIQUE INDEX media_catalog_eval_run_item_unique_idx
ON media_catalog_evaluations(run_id, media_item_id)
WHERE run_id IS NOT NULL;

-- Step 4: Add helper function for aggregating run counters
-- This is the source of truth for run progress
CREATE OR REPLACE FUNCTION aggregate_run_counters(p_run_id uuid)
RETURNS TABLE (
  processed bigint,
  eligible bigint,
  ineligible bigint,
  pending bigint,
  errors bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS processed,
    COUNT(*) FILTER (WHERE status = 'eligible')::bigint AS eligible,
    COUNT(*) FILTER (WHERE status = 'ineligible')::bigint AS ineligible,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint AS pending,
    0::bigint AS errors  -- errors tracked separately in run.error_sample
  FROM media_catalog_evaluations
  WHERE run_id = p_run_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 5: Add comment documenting the change
COMMENT ON COLUMN media_catalog_evaluations.run_id IS 
'Links evaluation to specific run. NULL for legacy evaluations or manual updates.
Counters should be derived via aggregate_run_counters(run_id), not incrementCounters.';
