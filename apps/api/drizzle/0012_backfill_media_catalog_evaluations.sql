-- Migration: Backfill media_catalog_evaluations for existing media_items
-- Creates PENDING evaluation records for all existing media items
-- Requirements: 1.4, 1.6
-- Uses constants from: apps/api/src/modules/catalog-policy/domain/constants/evaluation.constants.ts
--   EligibilityStatus.PENDING = 'pending'
--   DEFAULT_POLICY_VERSION = 0
--   EvaluationReason.NO_ACTIVE_POLICY = 'NO_ACTIVE_POLICY'

-- Insert PENDING evaluations for all existing media_items
-- This ensures every media_item has a corresponding evaluation record (1:1 invariant)
INSERT INTO media_catalog_evaluations (media_item_id, status, policy_version, reasons, evaluated_at)
SELECT 
  id, 
  'pending'::eligibility_status, 
  0,  -- DEFAULT_POLICY_VERSION
  ARRAY['NO_ACTIVE_POLICY'],  -- EvaluationReason.NO_ACTIVE_POLICY
  NULL  -- evaluated_at is NULL for pending items
FROM media_items 
WHERE deleted_at IS NULL
ON CONFLICT (media_item_id) DO NOTHING;  -- Skip if already exists (idempotent)
