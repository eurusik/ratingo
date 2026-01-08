-- Migration: Fix run-level idempotency index for context-aware evaluations
--
-- Previously we had a UNIQUE (run_id, media_item_id) index.
-- With context-aware evaluations, a single run evaluates the same media_item_id
-- across multiple contexts, so we need to include context in the uniqueness.
--
-- NOTE: We keep the index partial to avoid treating legacy NULL run_id rows as duplicates.

DROP INDEX IF EXISTS media_catalog_eval_run_item_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS media_catalog_eval_run_item_unique_idx
ON media_catalog_evaluations (run_id, media_item_id, context)
WHERE run_id IS NOT NULL;
