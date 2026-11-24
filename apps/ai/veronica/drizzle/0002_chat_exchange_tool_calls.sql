ALTER TABLE "ai"."chat_exchanges" ADD COLUMN IF NOT EXISTS "tool_calls" jsonb;
