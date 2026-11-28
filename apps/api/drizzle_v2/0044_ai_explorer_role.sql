DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_explorer') THEN
    CREATE ROLE "ai_explorer" NOLOGIN;
  END IF;
END
$$;--> statement-breakpoint
ALTER ROLE "ai_explorer" CONNECTION LIMIT 2;--> statement-breakpoint
ALTER ROLE "ai_explorer" SET default_transaction_read_only = on;--> statement-breakpoint
ALTER ROLE "ai_explorer" SET statement_timeout = '5s';--> statement-breakpoint
ALTER ROLE "ai_explorer" SET lock_timeout = '2s';--> statement-breakpoint
ALTER ROLE "ai_explorer" SET idle_in_transaction_session_timeout = '10s';--> statement-breakpoint
ALTER ROLE "ai_explorer" SET work_mem = '16MB';--> statement-breakpoint
ALTER ROLE "ai_explorer" SET search_path = public, pg_catalog;--> statement-breakpoint
GRANT USAGE ON SCHEMA "public" TO "ai_explorer";--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA "public" TO "ai_explorer";--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" GRANT SELECT ON TABLES TO "ai_explorer";--> statement-breakpoint
REVOKE ALL ON TABLE "refresh_tokens", "oauth_exchange_codes", "oauth_accounts" FROM "ai_explorer";--> statement-breakpoint
REVOKE ALL ON TABLE "users" FROM "ai_explorer";--> statement-breakpoint
GRANT SELECT ("id", "role", "preferred_language", "preferred_region", "is_profile_public", "show_watch_history", "show_ratings", "allow_followers", "auto_subscribe_on_watch", "created_at", "updated_at", "deleted_at") ON "users" TO "ai_explorer";--> statement-breakpoint
REVOKE ALL ON TABLE "user_media_state" FROM "ai_explorer";--> statement-breakpoint
GRANT SELECT ("id", "user_id", "media_item_id", "state", "rating", "progress", "state_implied", "created_at", "updated_at") ON "user_media_state" TO "ai_explorer";--> statement-breakpoint
REVOKE ALL ON TABLE "user_media_actions" FROM "ai_explorer";--> statement-breakpoint
GRANT SELECT ("id", "user_id", "media_item_id", "action", "context", "reason_key", "created_at") ON "user_media_actions" TO "ai_explorer";--> statement-breakpoint
REVOKE ALL ON TABLE "review_replies" FROM "ai_explorer";--> statement-breakpoint
GRANT SELECT ("id", "review_id", "user_id", "parent_reply_id", "content", "is_deleted", "created_at", "updated_at") ON "review_replies" TO "ai_explorer";--> statement-breakpoint
REVOKE ALL ON TABLE "review_reports" FROM "ai_explorer";--> statement-breakpoint
GRANT SELECT ("id", "review_id", "reporter_id", "reason", "status", "moderator_id", "resolved_at", "created_at") ON "review_reports" TO "ai_explorer";--> statement-breakpoint
REVOKE ALL ON TABLE "job_failure_days" FROM "ai_explorer";--> statement-breakpoint
GRANT SELECT ("id", "day", "queue", "job_type", "scheduler_job_id", "error_class", "failure_count", "exhausted_count", "first_failed_at", "last_failed_at") ON "job_failure_days" TO "ai_explorer";--> statement-breakpoint
REVOKE ALL ON TABLE "key_health_checks" FROM "ai_explorer";--> statement-breakpoint
GRANT SELECT ("id", "provider", "status", "status_code", "latency_ms", "quota_remaining", "quota_limit", "checked_at") ON "key_health_checks" TO "ai_explorer";--> statement-breakpoint
REVOKE ALL ON TABLE "catalog_evaluation_runs" FROM "ai_explorer";--> statement-breakpoint
GRANT SELECT ("id", "policy_version", "status", "started_at", "finished_at", "cursor", "counters", "target_policy_id", "target_policy_version", "baseline_policy_version", "total_ready_snapshot", "snapshot_cutoff", "processed", "eligible", "ineligible", "pending", "errors", "promoted_at") ON "catalog_evaluation_runs" TO "ai_explorer";
