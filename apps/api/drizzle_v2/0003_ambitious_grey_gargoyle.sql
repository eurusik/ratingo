CREATE TABLE "user_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"media_item_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"trigger" "subscription_trigger" NOT NULL,
	"payload" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_notifications_user_idx" ON "user_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_notifications_user_unread_idx" ON "user_notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "user_notifications_created_at_idx" ON "user_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_notifications_dedup_idx" ON "user_notifications" USING btree ("user_id","media_item_id","trigger","payload");