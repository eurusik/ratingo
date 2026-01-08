-- Bootstrap: Run counters function + run-level idempotency

-- Helper function for aggregating run counters
-- Source of truth for run progress (used by services)
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
    0::bigint AS errors
  FROM media_catalog_evaluations
  WHERE run_id = p_run_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Run-level idempotency unique index
-- Allows same media_item_id to be evaluated in multiple contexts within the same run
DROP INDEX IF EXISTS media_catalog_eval_run_item_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS media_catalog_eval_run_item_unique_idx
ON media_catalog_evaluations (run_id, media_item_id, context)
WHERE run_id IS NOT NULL;
