INSERT INTO public.role_permissions (role, permission_key, is_allowed) VALUES
  ('admin',      'tab:support_teams', true),
  ('finance',    'tab:support_teams', true),
  ('gtm_ops',    'tab:support_teams', true),
  ('executive',  'tab:support_teams', false),
  ('sales_head', 'tab:support_teams', false),
  ('sales_rep',  'tab:support_teams', false)
ON CONFLICT DO NOTHING;