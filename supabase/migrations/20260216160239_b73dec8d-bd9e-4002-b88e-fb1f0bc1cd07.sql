INSERT INTO role_permissions (role, permission_key, is_allowed)
SELECT r.name, 'page:executive_dashboard', 
  CASE WHEN r.name IN ('admin', 'executive') THEN true ELSE false END
FROM roles r
ON CONFLICT DO NOTHING;