SELECT table_schema AS schema_name, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'ai_explorer'
ORDER BY table_schema, table_name, privilege_type;
