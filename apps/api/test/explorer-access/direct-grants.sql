SELECT table_schema AS schema_name, table_name, column_name
FROM information_schema.column_privileges
WHERE grantee = 'ai_explorer' AND privilege_type = 'SELECT'
ORDER BY table_schema, table_name, column_name;
