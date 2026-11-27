DO $$
DECLARE
  routine regprocedure;
BEGIN
  FOR routine IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    WHERE p.pronamespace = 'pg_catalog'::regnamespace
      AND (
        p.proname IN ('pg_terminate_backend', 'pg_cancel_backend', 'pg_logical_emit_message')
        OR p.proname LIKE 'pg\_advisory\_%'
        OR p.proname LIKE 'pg\_try\_advisory\_%'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', routine);
  END LOOP;
END
$$;--> statement-breakpoint
ALTER VIEW "public"."public_media_items" SET (security_invoker = true);
