-- Migration: Add CTA Event Layer tables
-- user_media_actions (event log), user_saved_items (projection), user_subscriptions (notifications)

-- New ENUMs
DO $$ BEGIN
  CREATE TYPE "public"."saved_item_list" AS ENUM('for_later', 'considering');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."subscription_trigger" AS ENUM('release', 'new_season', 'on_streaming');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- USER MEDIA ACTIONS (Event Log)
CREATE TABLE IF NOT EXISTS "user_media_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"media_item_id" uuid NOT NULL,
	"action" text NOT NULL,
	"context" text,
	"reason_key" text,
	"payload" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "user_media_actions" DROP CONSTRAINT IF EXISTS "user_media_actions_user_id_users_id_fk";
ALTER TABLE "user_media_actions" ADD CONSTRAINT "user_media_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_media_actions" DROP CONSTRAINT IF EXISTS "user_media_actions_media_item_id_media_items_id_fk";
ALTER TABLE "user_media_actions" ADD CONSTRAINT "user_media_actions_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "user_media_actions_user_idx" ON "user_media_actions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "user_media_actions_media_idx" ON "user_media_actions" USING btree ("media_item_id");
CREATE INDEX IF NOT EXISTS "user_media_actions_action_idx" ON "user_media_actions" USING btree ("action");
CREATE INDEX IF NOT EXISTS "user_media_actions_created_at_idx" ON "user_media_actions" USING btree ("created_at");

-- USER SAVED ITEMS (Projection)
CREATE TABLE IF NOT EXISTS "user_saved_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"media_item_id" uuid NOT NULL,
	"list" "saved_item_list" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "user_saved_items" DROP CONSTRAINT IF EXISTS "user_saved_items_user_id_users_id_fk";
ALTER TABLE "user_saved_items" ADD CONSTRAINT "user_saved_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_saved_items" DROP CONSTRAINT IF EXISTS "user_saved_items_media_item_id_media_items_id_fk";
ALTER TABLE "user_saved_items" ADD CONSTRAINT "user_saved_items_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "user_saved_items_user_media_list_uniq" ON "user_saved_items" USING btree ("user_id","media_item_id","list");
CREATE INDEX IF NOT EXISTS "user_saved_items_user_idx" ON "user_saved_items" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "user_saved_items_user_list_idx" ON "user_saved_items" USING btree ("user_id","list");

-- USER SUBSCRIPTIONS (Notifications)
CREATE TABLE IF NOT EXISTS "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"media_item_id" uuid NOT NULL,
	"trigger" "subscription_trigger" NOT NULL,
	"channel" text DEFAULT 'push',
	"is_active" boolean DEFAULT true NOT NULL,
	"last_notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "user_subscriptions" DROP CONSTRAINT IF EXISTS "user_subscriptions_user_id_users_id_fk";
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_subscriptions" DROP CONSTRAINT IF EXISTS "user_subscriptions_media_item_id_media_items_id_fk";
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "user_subscriptions_user_media_trigger_channel_uniq" ON "user_subscriptions" USING btree ("user_id","media_item_id","trigger","channel");
CREATE INDEX IF NOT EXISTS "user_subscriptions_user_idx" ON "user_subscriptions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "user_subscriptions_user_active_idx" ON "user_subscriptions" USING btree ("user_id","is_active");
CREATE INDEX IF NOT EXISTS "user_subscriptions_trigger_idx" ON "user_subscriptions" USING btree ("trigger");