DO $$
DECLARE
  routine regprocedure;
BEGIN
  FOR routine IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    WHERE p.pronamespace = 'pg_catalog'::regnamespace
      AND (
        p.proname IN ('pg_terminate_backend', 'pg_cancel_backend')
        OR p.proname LIKE 'pg\_advisory\_%'
        OR p.proname LIKE 'pg\_try\_advisory\_%'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', routine);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', routine, current_user);
  END LOOP;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'ai_explorer function limits were not applied: the migration role may not change grants on pg_catalog functions';
END
$$;
