DO $$
DECLARE
  routine regprocedure;
BEGIN
  FOR routine IN
    SELECT p.oid::regprocedure FROM pg_proc p
    WHERE p.pronamespace = 'pg_catalog'::regnamespace AND p.proname = 'set_config'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', routine);
  END LOOP;
END
$$;
