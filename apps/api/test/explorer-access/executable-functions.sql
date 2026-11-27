SELECT
  n.nspname AS schema_name,
  format('%I.%s(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS signature,
  p.prosecdef AS security_definer,
  n.nspname = 'pg_catalog' AS system_function
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE has_schema_privilege('ai_explorer', n.oid, 'USAGE')
  AND has_function_privilege('ai_explorer', p.oid, 'EXECUTE')
  AND (
    (p.prosecdef AND n.nspname NOT IN ('pg_catalog', 'information_schema'))
    OR (
      n.nspname = 'pg_catalog'
      AND (
        p.proname IN ('pg_terminate_backend', 'pg_cancel_backend', 'pg_logical_emit_message')
        OR p.proname LIKE 'pg\_advisory\_%'
        OR p.proname LIKE 'pg\_try\_advisory\_%'
      )
    )
  )
ORDER BY n.nspname, p.proname, p.oid;
