-- Add compensation target fields to employees table
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS employee_role TEXT,
ADD COLUMN IF NOT EXISTS incentive_type TEXT,
ADD COLUMN IF NOT EXISTS target_bonus_percent NUMERIC,
ADD COLUMN IF NOT EXISTS tfp_local_currency NUMERIC,
ADD COLUMN IF NOT EXISTS tvp_local_currency NUMERIC,
ADD COLUMN IF NOT EXISTS ote_local_currency NUMERIC,
ADD COLUMN IF NOT EXISTS tfp_usd NUMERIC,
ADD COLUMN IF NOT EXISTS tvp_usd NUMERIC,
ADD COLUMN IF NOT EXISTS ote_usd NUMERIC;

-- Add comments for documentation
COMMENT ON COLUMN public.employees.employee_role IS 'Employee role type (e.g., Individual Contributor, Manager, Team Lead)';
COMMENT ON COLUMN public.employees.incentive_type IS 'Incentive program type (e.g., Standard, Accelerated, Commission Only)';
COMMENT ON COLUMN public.employees.target_bonus_percent IS 'Target bonus as percentage of TFP';
COMMENT ON COLUMN public.employees.tfp_local_currency IS 'Target Fixed Pay in local currency';
COMMENT ON COLUMN public.employees.tvp_local_currency IS 'Target Variable Pay in local currency';
COMMENT ON COLUMN public.employees.ote_local_currency IS 'Total On-Target Earnings in local currency';
COMMENT ON COLUMN public.employees.tfp_usd IS 'Target Fixed Pay in USD';
COMMENT ON COLUMN public.employees.tvp_usd IS 'Target Variable Pay in USD';
COMMENT ON COLUMN public.employees.ote_usd IS 'Total On-Target Earnings in USD';