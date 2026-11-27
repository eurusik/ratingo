WITH RECURSIVE user_linked (table_oid, depth) AS (
  SELECT 'public.users'::regclass::oid, 0
  UNION
  SELECT k.conrelid, linked.depth + 1
  FROM pg_constraint k
  JOIN user_linked linked ON k.confrelid = linked.table_oid
  WHERE k.contype = 'f' AND linked.depth < 4
)
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relkind::text AS kind,
  coalesce(c.reloptions::text, '') AS options,
  a.attname AS column_name,
  a.atttypid::int AS type_oid,
  c.oid IN (SELECT table_oid FROM user_linked WHERE depth > 0) AS links_to_users
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE a.attnum > 0
  AND NOT a.attisdropped
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND n.nspname NOT LIKE 'pg_temp%'
  AND has_schema_privilege('ai_explorer', n.oid, 'USAGE')
  AND has_column_privilege('ai_explorer', c.oid, a.attnum, 'SELECT')
ORDER BY n.nspname, c.relname, a.attnum;
