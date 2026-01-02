-- Add processed column to catalog_evaluation_runs
-- This column replaces counters.processed as the single source of truth

ALTER TABLE "catalog_evaluation_runs" ADD COLUMN IF NOT EXISTS "processed" integer DEFAULT 0;

-- Migrate existing data from counters.processed to processed column
UPDATE "catalog_evaluation_runs" 
SET "processed" = COALESCE((counters->>'processed')::integer, 0)
WHERE "processed" IS NULL OR "processed" = 0;
