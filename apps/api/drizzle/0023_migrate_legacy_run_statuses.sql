-- Migration: Migrate legacy run statuses to canonical values
-- Date: 2025-12-26
-- Description: Updates legacy 'success' and 'completed' statuses to 'prepared'

-- Update legacy 'success' status to 'prepared'
UPDATE catalog_evaluation_runs
SET status = 'prepared'
WHERE status = 'success';

-- Update legacy 'completed' status to 'prepared' (if any exist)
UPDATE catalog_evaluation_runs
SET status = 'prepared'
WHERE status = 'completed';

-- Update legacy 'pending' status to 'running' (if any exist)
UPDATE catalog_evaluation_runs
SET status = 'running'
WHERE status = 'pending';

-- Log migration results
DO $$
DECLARE
  success_count INTEGER;
  completed_count INTEGER;
  pending_count INTEGER;
BEGIN
  -- Count would have been updated (already updated above, so these will be 0)
  SELECT COUNT(*) INTO success_count FROM catalog_evaluation_runs WHERE status = 'success';
  SELECT COUNT(*) INTO completed_count FROM catalog_evaluation_runs WHERE status = 'completed';
  SELECT COUNT(*) INTO pending_count FROM catalog_evaluation_runs WHERE status = 'pending';
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  - success → prepared (remaining: %)', success_count;
  RAISE NOTICE '  - completed → prepared (remaining: %)', completed_count;
  RAISE NOTICE '  - pending → running (remaining: %)', pending_count;
END $$;
