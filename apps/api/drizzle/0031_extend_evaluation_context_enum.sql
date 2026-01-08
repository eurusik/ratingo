-- Migration: Extend evaluation_context enum with missing values
-- Purpose: Ensure production DB enum is aligned with application contexts.
-- This migration is idempotent and safe to run multiple times.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evaluation_context') THEN
    ALTER TYPE evaluation_context ADD VALUE IF NOT EXISTS 'homepage';
    ALTER TYPE evaluation_context ADD VALUE IF NOT EXISTS 'search';
    ALTER TYPE evaluation_context ADD VALUE IF NOT EXISTS 'now_playing';
    ALTER TYPE evaluation_context ADD VALUE IF NOT EXISTS 'new_digital';
    ALTER TYPE evaluation_context ADD VALUE IF NOT EXISTS 'trending';
    ALTER TYPE evaluation_context ADD VALUE IF NOT EXISTS 'catalog';
  END IF;
END $$;
