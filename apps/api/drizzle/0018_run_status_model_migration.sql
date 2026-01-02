-- Migration: Run Status Model Migration
-- Updates evaluation_run_status enum to align with design document
-- Requirements: 15.1-15.8
--
-- Status Model Changes:
-- - Remove 'pending' status (runs start directly in 'running')
-- - Replace 'completed' with 'prepared' (ready for promotion)
-- - Keep 'promoted' status (terminal state after activation)
-- - Keep 'cancelled' status (terminal state after user cancellation)
-- - Keep 'failed' status (terminal state after error)
--
-- Target enum values: running, prepared, promoted, cancelled, failed
-- Legacy values to migrate: pending → running, completed → prepared, success → prepared

-- Step 1: Add 'prepared' status to enum (if not exists)
-- PostgreSQL doesn't allow removing enum values, so we add new ones and migrate data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'prepared' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'evaluation_run_status')
  ) THEN
    ALTER TYPE evaluation_run_status ADD VALUE 'prepared';
  END IF;
END$$;

-- Step 2: Migrate existing data
-- Note: This must be in a separate transaction from ADD VALUE in PostgreSQL
-- The migration runner handles this automatically

-- Update runs with status='completed' to status='prepared'
UPDATE catalog_evaluation_runs 
SET status = 'prepared' 
WHERE status = 'completed';

-- Update runs with status='success' to status='prepared'
UPDATE catalog_evaluation_runs 
SET status = 'prepared' 
WHERE status = 'success';

-- Update runs with status='pending' to status='running'
-- (pending runs should be rare, but handle them)
UPDATE catalog_evaluation_runs 
SET status = 'running' 
WHERE status = 'pending';

-- Step 3: Add comment documenting the migration
COMMENT ON TYPE evaluation_run_status IS 
'Run status lifecycle: running → prepared → promoted | cancelled | failed. 
Legacy values (pending, completed, success) are deprecated and should not be used.';

