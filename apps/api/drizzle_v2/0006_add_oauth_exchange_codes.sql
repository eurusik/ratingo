CREATE TABLE "oauth_exchange_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_exchange_codes" ADD CONSTRAINT "oauth_exchange_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_exchange_codes_hash_idx" ON "oauth_exchange_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "oauth_exchange_codes_expires_idx" ON "oauth_exchange_codes" USING btree ("expires_at");