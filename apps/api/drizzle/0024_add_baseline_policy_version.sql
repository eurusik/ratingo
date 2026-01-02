-- Migration: Add baseline_policy_version to catalog_evaluation_runs
-- Purpose: Store the active policy version at run creation time for consistent diff calculation
-- This allows diff to work correctly even after a run is promoted

ALTER TABLE catalog_evaluation_runs
ADD COLUMN baseline_policy_version INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN catalog_evaluation_runs.baseline_policy_version IS 
  'Version of active policy when run was created. Used for diff calculation to ensure consistent historical comparison.';

-- Backfill existing promoted runs: set baseline = target (diff will be 0, but honest)
-- We cannot reconstruct historical baseline, so this is the safest approach
-- Prepared/running runs: leave NULL (diff service will fallback to activePolicy.version)
UPDATE catalog_evaluation_runs
SET baseline_policy_version = target_policy_version
WHERE status = 'promoted' AND baseline_policy_version IS NULL;
