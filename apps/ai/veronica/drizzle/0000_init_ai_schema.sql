CREATE SCHEMA IF NOT EXISTS "ai";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai"."digest_deliveries" (
	"digest_date" date PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"claimed_at_ms" bigint NOT NULL,
	"sent_at_ms" bigint,
	"silent" boolean,
	"run_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai"."runs" (
	"id" text PRIMARY KEY NOT NULL,
	"agent" text NOT NULL,
	"task" text,
	"trigger" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"stop_reason" text,
	"stop_detail" text,
	"started_at_ms" bigint NOT NULL,
	"finished_at_ms" bigint,
	"turns" integer NOT NULL,
	"usage" jsonb NOT NULL,
	"cost_usd" double precision NOT NULL,
	"tool_calls" jsonb NOT NULL
);
