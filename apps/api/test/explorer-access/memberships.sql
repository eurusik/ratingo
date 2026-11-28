SELECT r.rolname AS role_name
FROM pg_auth_members m
JOIN pg_roles r ON r.oid = m.roleid
WHERE m.member = 'ai_explorer'::regrole
ORDER BY r.rolname;
