SELECT table_schema AS schema_name, table_name
FROM information_schema.role_table_grants
WHERE grantee = 'ai_explorer' AND privilege_type = 'SELECT'
ORDER BY table_schema, table_name;
