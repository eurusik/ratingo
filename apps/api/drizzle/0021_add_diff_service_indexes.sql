-- Migration: Add indexes for DiffService optimization
-- Purpose: Optimize SQL aggregation queries for diff computation
-- 
-- These indexes support the DiffService.computeCountsSQL() method which uses
-- SQL aggregation instead of loading all records into memory.
--
-- Requirements: 3.1, 3.4

-- ============================================================================
-- PRE-CHECK QUERIES (Run these BEFORE executing migration)
-- ============================================================================

-- 1. Check existing indexes on media_catalog_evaluations:
--    SELECT indexname, indexdef 
--    FROM pg_indexes 
--    WHERE tablename = 'media_catalog_evaluations' 
--    ORDER BY indexname;

-- 2. Check for duplicates that would prevent unique index creation:
--    SELECT policy_version, media_item_id, COUNT(*) 
--    FROM media_catalog_evaluations 
--    GROUP BY policy_version, media_item_id 
--    HAVING COUNT(*) > 1;

-- 3. Estimate table size for index creation time:
--    SELECT reltuples::bigint AS row_estimate
--    FROM pg_class
--    WHERE relname = 'media_catalog_evaluations';

-- ============================================================================
-- INDEX CREATION
-- ============================================================================

-- Index 1: Primary lookup index for DiffService queries
-- Supports: WHERE policy_version = X queries
-- Used by: computeCountsSQL() for both old_evals and new_evals CTEs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_catalog_evaluations_version_item
ON media_catalog_evaluations (policy_version, media_item_id);

-- Index 2: Covering index for diff queries (includes status to avoid table lookup)
-- Supports: SELECT media_item_id, status WHERE policy_version = X
-- Used by: computeCountsSQL() to avoid heap fetches for status column
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_catalog_evaluations_version_item_status
ON media_catalog_evaluations (policy_version, media_item_id, status);

-- Index 3: Unique constraint to prevent duplicates
-- CRITICAL: DiffService relies on this invariant - no duplicates by (policy_version, media_item_id)
-- Note: This is enforced by the composite primary key, but we add explicit unique index for clarity
-- and to support potential future schema changes.
--
-- IMPORTANT: If duplicates exist, run cleanup migration 0022 first!
-- Check: SELECT policy_version, media_item_id, COUNT(*) 
--        FROM media_catalog_evaluations 
--        GROUP BY 1,2 HAVING COUNT(*) > 1;
--
-- Note: The composite primary key (media_item_id, policy_version) already enforces uniqueness.
-- This index is redundant but kept for documentation purposes and explicit naming.
-- Commenting out to avoid duplicate index overhead.
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_evals_version_item
-- ON media_catalog_evaluations (policy_version, media_item_id);

-- ============================================================================
-- QUERY PLAN VALIDATION
-- ============================================================================

-- After migration, run EXPLAIN ANALYZE on staging for these queries:

-- 1. DiffService.computeCountsSQL() - old_evals CTE:
--    EXPLAIN ANALYZE
--    SELECT media_item_id, status 
--    FROM media_catalog_evaluations 
--    WHERE policy_version = 1;

-- 2. DiffService.computeCountsSQL() - new_evals CTE:
--    EXPLAIN ANALYZE
--    SELECT media_item_id, status 
--    FROM media_catalog_evaluations 
--    WHERE policy_version = 2;

-- 3. Full diff query (should use Index Only Scan with covering index):
--    EXPLAIN ANALYZE
--    WITH old_evals AS (
--      SELECT media_item_id, status 
--      FROM media_catalog_evaluations 
--      WHERE policy_version = 1
--    ),
--    new_evals AS (
--      SELECT media_item_id, status 
--      FROM media_catalog_evaluations 
--      WHERE policy_version = 2
--    ),
--    diff AS (
--      SELECT 
--        COALESCE(o.status::text, 'none') as old_status,
--        COALESCE(n.status::text, 'none') as new_status
--      FROM old_evals o
--      FULL OUTER JOIN new_evals n ON o.media_item_id = n.media_item_id
--    )
--    SELECT
--      COUNT(*) FILTER (WHERE old_status = 'eligible' AND new_status IN ('ineligible', 'pending', 'none')) as regressions,
--      COUNT(*) FILTER (WHERE old_status IN ('ineligible', 'pending', 'none') AND new_status = 'eligible') as improvements,
--      COUNT(*) FILTER (WHERE old_status = 'eligible' AND new_status = 'eligible') as unchanged,
--      COUNT(*) FILTER (WHERE old_status != 'eligible' AND new_status != 'eligible') as still_ineligible
--    FROM diff;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================

-- 1. Verify indexes were created:
--    SELECT indexname, indexdef 
--    FROM pg_indexes 
--    WHERE tablename = 'media_catalog_evaluations' 
--      AND indexname LIKE 'idx_media_catalog_evaluations_version%'
--    ORDER BY indexname;

-- 2. Check index sizes:
--    SELECT indexrelname, pg_size_pretty(pg_relation_size(indexrelid)) as size
--    FROM pg_stat_user_indexes
--    WHERE relname = 'media_catalog_evaluations'
--    ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- ROLLBACK STRATEGY
-- ============================================================================
-- DROP INDEX CONCURRENTLY IF EXISTS idx_media_catalog_evaluations_version_item;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_media_catalog_evaluations_version_item_status;
