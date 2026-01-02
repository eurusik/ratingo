-- Migration: Normalize eligibility_status enum values
-- Purpose: Ensure all eligibility_status values are in canonical lowercase format
-- 
-- NOTE: This migration is designed to run ONCE. Not idempotent by design.
-- If re-run is needed, restore from backup first.
-- IMPORTANT: DDL locks possible. Run during low-traffic period.
--
-- Requirements: 1.5, 1.6, 9.2

-- ============================================================================
-- PRE-CHECK QUERIES (Run these BEFORE executing migration)
-- ============================================================================

-- 1. Check all columns using the eligibility_status enum type:
--    SELECT c.table_schema, c.table_name, c.column_name, c.udt_name 
--    FROM information_schema.columns c 
--    WHERE c.udt_name IN ('eligibility_status', 'eligibility_status_old');

-- 2. Check views referencing status column:
--    SELECT viewname FROM pg_views WHERE definition LIKE '%media_catalog_evaluations%status%';

-- 3. Check functions/triggers referencing the enum:
--    SELECT proname FROM pg_proc WHERE prosrc LIKE '%eligibility_status%';

-- 4. Check indexes on status column:
--    SELECT indexname FROM pg_indexes WHERE tablename = 'media_catalog_evaluations' AND indexdef LIKE '%status%';

-- 5. Check for any UPPERCASE values in the database:
--    SELECT DISTINCT status::text FROM media_catalog_evaluations WHERE status::text ~ '[A-Z]';

-- 6. Count records by status (for verification after migration):
--    SELECT status::text, COUNT(*) FROM media_catalog_evaluations GROUP BY status::text ORDER BY 1;

-- ============================================================================
-- MIGRATION SCRIPT
-- ============================================================================

-- The eligibility_status enum was created with lowercase values in migration 0009.
-- This migration ensures any potential UPPERCASE values are normalized to lowercase.
-- 
-- Since PostgreSQL enums are case-sensitive and the enum was created with lowercase,
-- any UPPERCASE values would have been rejected at insert time. However, this migration
-- provides a safety net and documents the canonical format.

-- Step 1: Verify current enum values are lowercase
DO $$
DECLARE
  enum_values text[];
  v text;
BEGIN
  SELECT array_agg(enumlabel ORDER BY enumsortorder)
  INTO enum_values
  FROM pg_enum
  WHERE enumtypid = 'eligibility_status'::regtype;
  
  FOREACH v IN ARRAY enum_values
  LOOP
    IF v ~ '[A-Z]' THEN
      RAISE EXCEPTION 'Found UPPERCASE enum value: %. Migration cannot proceed.', v;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Enum values verified: %', enum_values;
END $$;

-- Step 2: Verify no NULL status values exist (fail-fast)
DO $$
DECLARE
  null_count integer;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM media_catalog_evaluations
  WHERE status IS NULL;
  
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Found % NULL status values. Clean up required before migration.', null_count;
  END IF;
  
  RAISE NOTICE 'No NULL status values found. Proceeding.';
END $$;

-- Step 3: Log current status distribution for audit
DO $$
DECLARE
  rec record;
BEGIN
  RAISE NOTICE '=== Current status distribution ===';
  FOR rec IN 
    SELECT status::text as status_val, COUNT(*) as cnt 
    FROM media_catalog_evaluations 
    GROUP BY status::text 
    ORDER BY 1
  LOOP
    RAISE NOTICE 'Status: %, Count: %', rec.status_val, rec.cnt;
  END LOOP;
END $$;

-- Step 4: Add comment documenting canonical format
COMMENT ON TYPE eligibility_status IS 
'Canonical eligibility status values (lowercase only): pending, eligible, ineligible, review.
UPPERCASE values are NOT supported. Any legacy UPPERCASE data must be migrated before use.
See migration 0020_normalize_eligibility_status.sql for details.';

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Run after migration)
-- ============================================================================

-- 1. Verify enum values:
--    SELECT enumlabel FROM pg_enum WHERE enumtypid = 'eligibility_status'::regtype ORDER BY enumsortorder;

-- 2. Verify no UPPERCASE values exist:
--    SELECT DISTINCT status::text FROM media_catalog_evaluations WHERE status::text ~ '[A-Z]';

-- 3. Verify status distribution matches pre-migration:
--    SELECT status::text, COUNT(*) FROM media_catalog_evaluations GROUP BY status::text ORDER BY 1;

-- ============================================================================
-- ROLLBACK STRATEGY
-- ============================================================================
-- This migration is verification-only and does not modify data.
-- If issues are found, restore from database backup.
-- No in-code rollback logic per Design Principles.
