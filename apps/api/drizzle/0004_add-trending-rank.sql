ALTER TYPE "public"."subscription_trigger" ADD VALUE 'new_episode' BEFORE 'on_streaming';--> statement-breakpoint
ALTER TYPE "public"."subscription_trigger" ADD VALUE 'status_changed';--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "trending_rank" integer;--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "trending_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN "last_notified_episode_key" text;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN "last_notified_season_number" integer;--> statement-breakpoint
CREATE INDEX "media_trending_rank_idx" ON "media_items" USING btree ("trending_rank");