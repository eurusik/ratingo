-- Migration: Change budget and revenue from integer to bigint

-- Idempotent: only alter if column is not already bigint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'movies' AND column_name = 'budget' AND data_type != 'bigint'
  ) THEN
    ALTER TABLE "movies" ALTER COLUMN "budget" SET DATA TYPE bigint;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'movies' AND column_name = 'revenue' AND data_type != 'bigint'
  ) THEN
    ALTER TABLE "movies" ALTER COLUMN "revenue" SET DATA TYPE bigint;
  END IF;
END $$;
