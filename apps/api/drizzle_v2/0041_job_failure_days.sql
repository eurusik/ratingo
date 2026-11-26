CREATE TABLE IF NOT EXISTS "job_failure_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"queue" text NOT NULL,
	"job_type" text NOT NULL,
	"scheduler_job_id" text,
	"error_class" text NOT NULL,
	"failure_count" integer NOT NULL,
	"exhausted_count" integer NOT NULL,
	"first_failed_at" timestamp with time zone NOT NULL,
	"last_failed_at" timestamp with time zone NOT NULL,
	"last_message" text NOT NULL,
	CONSTRAINT "job_failure_days_key_unique" UNIQUE NULLS NOT DISTINCT("day","queue","job_type","scheduler_job_id","error_class"),
	CONSTRAINT "job_failure_days_error_class_check" CHECK ("job_failure_days"."error_class" IN ('rate_limit', 'access_denied', 'not_found', 'timeout', 'network', 'database', 'other')),
	CONSTRAINT "job_failure_days_counts_check" CHECK ("job_failure_days"."failure_count" >= 1 AND "job_failure_days"."exhausted_count" >= 0 AND "job_failure_days"."exhausted_count" <= "job_failure_days"."failure_count")
);--> statement-breakpoint
CREATE OR REPLACE VIEW "reporting"."daily_job_failures" AS
SELECT "day", "queue", "job_type", "scheduler_job_id", "error_class", "failure_count", "exhausted_count", "first_failed_at", "last_failed_at", "last_message"
FROM "job_failure_days"
WHERE "day" >= (now() AT TIME ZONE 'Europe/Kyiv')::date - 13;--> statement-breakpoint
GRANT SELECT ON "reporting"."daily_job_failures" TO "ai_reader";
