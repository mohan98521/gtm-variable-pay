
INSERT INTO public.role_permissions (role, permission_key, is_allowed)
VALUES
  ('admin', 'tab:deal_team_spiffs', true),
  ('finance', 'tab:deal_team_spiffs', true),
  ('gtm_ops', 'tab:deal_team_spiffs', true),
  ('admin', 'action:allocate_deal_spiff', true),
  ('finance', 'action:allocate_deal_spiff', true),
  ('gtm_ops', 'action:allocate_deal_spiff', true),
  ('admin', 'action:approve_deal_spiff', true)
ON CONFLICT DO NOTHING;
