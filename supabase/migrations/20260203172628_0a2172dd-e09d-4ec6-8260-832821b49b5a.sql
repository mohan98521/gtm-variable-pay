-- Add clawback exemption flag to comp_plans table
ALTER TABLE comp_plans
ADD COLUMN is_clawback_exempt BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN comp_plans.is_clawback_exempt IS 
  'When true, employees on this plan receive full payout regardless of collection status. No clawback rules apply.';