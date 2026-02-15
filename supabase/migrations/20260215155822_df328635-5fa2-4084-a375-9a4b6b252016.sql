UPDATE plan_commissions
SET min_gp_margin_pct = 55
WHERE commission_type = 'Managed Services'
  AND is_active = true
  AND min_gp_margin_pct IS NULL;