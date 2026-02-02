-- Drop old two-way split constraint from plan_metrics
ALTER TABLE plan_metrics DROP CONSTRAINT IF EXISTS valid_metric_payout_split;

-- Drop old two-way split constraint from plan_commissions (if exists)
ALTER TABLE plan_commissions DROP CONSTRAINT IF EXISTS valid_commission_payout_split;