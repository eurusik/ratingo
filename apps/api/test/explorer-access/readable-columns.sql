SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relkind::text AS kind,
  coalesce(c.reloptions::text, '') AS options,
  a.attname AS column_name,
  t.typname AS type_name,
  t.typcategory::text AS type_category
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_type t ON t.oid = a.atttypid
WHERE a.attnum > 0
  AND NOT a.attisdropped
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND n.nspname NOT LIKE 'pg_temp%'
  AND has_schema_privilege('ai_explorer', n.oid, 'USAGE')
  AND has_column_privilege('ai_explorer', c.oid, a.attnum, 'SELECT')
ORDER BY n.nspname, c.relname, a.attnum;
