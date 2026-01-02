-- Add reason_key column to user_saved_items (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_saved_items' AND column_name = 'reason_key'
  ) THEN
    ALTER TABLE "user_saved_items" ADD COLUMN "reason_key" varchar(64);
  END IF;
END $$;
