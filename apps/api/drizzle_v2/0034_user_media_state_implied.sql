ALTER TABLE "user_media_state" ADD COLUMN IF NOT EXISTS "state_implied" boolean DEFAULT false NOT NULL;
