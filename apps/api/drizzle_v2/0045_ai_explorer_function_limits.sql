DO $$
DECLARE
  routine regprocedure;
BEGIN
  FOR routine IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    WHERE p.pronamespace = 'pg_catalog'::regnamespace
      AND (
        p.proname IN (
          'pg_terminate_backend',
          'pg_cancel_backend',
          'pg_logical_emit_message',
          'pg_notify',
          'set_config',
          'ts_stat',
          'ts_rewrite',
          'lo_creat',
          'lo_create',
          'lo_from_bytea',
          'lo_put',
          'lo_unlink'
        )
        OR p.proname LIKE 'pg\_advisory\_%'
        OR p.proname LIKE 'pg\_try\_advisory\_%'
        OR p.proname LIKE 'query\_to\_xml%'
        OR p.proname LIKE 'cursor\_to\_xml%'
        OR p.proname LIKE 'table\_to\_xml%'
        OR p.proname LIKE 'schema\_to\_xml%'
        OR p.proname LIKE 'database\_to\_xml%'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', routine);
  END LOOP;
END
$$;--> statement-breakpoint
ALTER VIEW "public"."public_media_items" SET (security_invoker = true);--> statement-breakpoint
ALTER ROLE "ai_explorer" SET temp_file_limit = '256MB';--> statement-breakpoint
REVOKE ALL ON TABLE "import_pending_items" FROM "ai_explorer";--> statement-breakpoint
GRANT SELECT ("id", "batch_id", "imdb_id", "tmdb_id", "resolved_tmdb_id", "media_type", "rating", "state", "status", "media_item_id", "created_at", "updated_at") ON "import_pending_items" TO "ai_explorer";
