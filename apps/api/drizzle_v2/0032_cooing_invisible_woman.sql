CREATE TABLE "key_health_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"status_code" integer,
	"latency_ms" integer,
	"detail" text,
	"quota_remaining" integer,
	"quota_limit" integer,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "key_health_checks_provider_checked_idx" ON "key_health_checks" USING btree ("provider","checked_at" DESC NULLS LAST);