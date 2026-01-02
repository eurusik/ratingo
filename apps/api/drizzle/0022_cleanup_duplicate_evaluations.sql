-- Migration: Cleanup duplicate evaluations (if needed)
-- Purpose: Remove duplicate (policy_version, media_item_id) entries before adding unique constraint
-- Strategy: Keep the latest evaluation by evaluated_at timestamp
--
-- NOTE: This migration should only be run if duplicates exist.
-- The composite primary key (media_item_id, policy_version) should prevent duplicates,
-- but this script handles edge cases from legacy data or schema changes.
--
-- Requirements: 3.1

-- ============================================================================
-- PRE-CHECK: Detect duplicates
-- ============================================================================

-- Run this query FIRST to check if duplicates exist:
-- SELECT policy_version, media_item_id, COUNT(*) as duplicate_count
-- FROM media_catalog_evaluations 
-- GROUP BY policy_version, media_item_id 
-- HAVING COUNT(*) > 1
-- ORDER BY duplicate_count DESC;

-- If the above query returns 0 rows, this migration is NOT needed.
-- Skip to migration 0021 for index creation.

-- ============================================================================
-- DUPLICATE ANALYSIS (Run before cleanup)
-- ============================================================================

-- 1. Count total duplicates:
--    SELECT COUNT(*) as total_duplicate_pairs
--    FROM (
--      SELECT policy_version, media_item_id
--      FROM media_catalog_evaluations 
--      GROUP BY policy_version, media_item_id 
--      HAVING COUNT(*) > 1
--    ) dups;

-- 2. Count total rows that will be deleted:
--    WITH duplicates AS (
--      SELECT policy_version, media_item_id, COUNT(*) - 1 as extra_rows
--      FROM media_catalog_evaluations 
--      GROUP BY policy_version, media_item_id 
--      HAVING COUNT(*) > 1
--    )
--    SELECT SUM(extra_rows) as rows_to_delete FROM duplicates;

-- 3. Sample duplicates for review:
--    SELECT e.*
--    FROM media_catalog_evaluations e
--    INNER JOIN (
--      SELECT policy_version, media_item_id
--      FROM media_catalog_evaluations 
--      GROUP BY policy_version, media_item_id 
--      HAVING COUNT(*) > 1
--      LIMIT 10
--    ) dups ON e.policy_version = dups.policy_version 
--          AND e.media_item_id = dups.media_item_id
--    ORDER BY e.policy_version, e.media_item_id, e.evaluated_at DESC NULLS LAST;

-- ============================================================================
-- CLEANUP STRATEGY: Keep latest by evaluated_at
-- ============================================================================

-- NOTE: The table has a composite primary key (media_item_id, policy_version).
-- If duplicates exist, it means the primary key was added AFTER the data was inserted,
-- or there's a schema inconsistency that needs investigation.

-- Since the table has a composite PRIMARY KEY, duplicates should NOT be possible.
-- This migration is provided as a safety net for edge cases.

-- If duplicates DO exist (which would indicate a schema issue), use this approach:

-- Step 1: Create temporary table with deduplicated data
-- CREATE TEMP TABLE media_catalog_evaluations_dedup AS
-- SELECT DISTINCT ON (policy_version, media_item_id)
--   media_item_id,
--   status,
--   reasons,
--   relevance_score,
--   policy_version,
--   breakout_rule_id,
--   evaluated_at,
--   run_id
-- FROM media_catalog_evaluations
-- ORDER BY policy_version, media_item_id, evaluated_at DESC NULLS LAST;

-- Step 2: Truncate original table (faster than DELETE for large tables)
-- TRUNCATE media_catalog_evaluations;

-- Step 3: Restore deduplicated data
-- INSERT INTO media_catalog_evaluations 
-- SELECT * FROM media_catalog_evaluations_dedup;

-- Step 4: Drop temp table
-- DROP TABLE media_catalog_evaluations_dedup;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- After cleanup, verify no duplicates remain:
-- SELECT policy_version, media_item_id, COUNT(*) 
-- FROM media_catalog_evaluations 
-- GROUP BY policy_version, media_item_id 
-- HAVING COUNT(*) > 1;

-- Expected result: 0 rows

-- ============================================================================
-- ACTUAL MIGRATION (Conditional)
-- ============================================================================

-- This block only executes if duplicates are found
DO $$
DECLARE
  duplicate_count integer;
BEGIN
  -- Check for duplicates
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT policy_version, media_item_id
    FROM media_catalog_evaluations 
    GROUP BY policy_version, media_item_id 
    HAVING COUNT(*) > 1
  ) dups;
  
  IF duplicate_count = 0 THEN
    RAISE NOTICE 'No duplicates found. Skipping cleanup.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found % duplicate (policy_version, media_item_id) pairs.', duplicate_count;
  
  -- Since the table has a composite PRIMARY KEY, duplicates should NOT exist.
  -- If we reach here, there's a schema inconsistency that needs manual investigation.
  RAISE EXCEPTION 'Duplicates found but table has PRIMARY KEY constraint. This indicates a schema inconsistency. Please investigate manually.';
  
  -- If you need to proceed with cleanup despite the warning, comment out the RAISE EXCEPTION
  -- and uncomment the cleanup logic above.
END $$;

-- ============================================================================
-- ROLLBACK STRATEGY
-- ============================================================================
-- This migration is detection-only by default.
-- If cleanup was performed, restore from database backup.
