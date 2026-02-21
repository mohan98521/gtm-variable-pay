-- =====================================================================
-- CONSOLIDATED SCHEMA - Final State
-- Generated for provisioning a clean Supabase project
-- Run this as a single SQL script in the SQL Editor of your new project
-- =====================================================================

-- ============================================================
-- PART 1: ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.logic_type AS ENUM ('Stepped_Accelerator', 'Gated_Threshold', 'Linear');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- PART 2: CORE TABLES (no FK dependencies on other public tables)
-- ============================================================

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  employee_id TEXT UNIQUE,
  designation TEXT,
  country TEXT,
  city TEXT,
  date_of_hire DATE,
  departure_date DATE,
  group_name TEXT,
  business_unit TEXT,
  function_area TEXT,
  sales_function TEXT,
  department TEXT,
  region TEXT,
  local_currency TEXT NOT NULL DEFAULT 'USD',
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- employees
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  designation TEXT,
  country TEXT,
  city TEXT,
  date_of_hire DATE,
  departure_date DATE,
  group_name TEXT,
  business_unit TEXT,
  function_area TEXT,
  sales_function TEXT,
  department TEXT,
  region TEXT,
  local_currency TEXT NOT NULL DEFAULT 'USD',
  manager_employee_id TEXT,
  employee_role TEXT,
  incentive_type TEXT,
  target_bonus_percent NUMERIC,
  tfp_local_currency NUMERIC,
  tvp_local_currency NUMERIC,
  ote_local_currency NUMERIC,
  tfp_usd NUMERIC,
  tvp_usd NUMERIC,
  ote_usd NUMERIC,
  compensation_exchange_rate NUMERIC DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- roles
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'gray',
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- role_permissions
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  is_allowed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, permission_key)
);

-- comp_plans
CREATE TABLE public.comp_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  effective_year INTEGER NOT NULL DEFAULT 2026,
  is_active BOOLEAN NOT NULL DEFAULT true,
  payout_frequency TEXT DEFAULT 'monthly',
  clawback_period_days INTEGER DEFAULT 180,
  is_clawback_exempt BOOLEAN NOT NULL DEFAULT false,
  nrr_ote_percent NUMERIC NOT NULL DEFAULT 0,
  cr_er_min_gp_margin_pct NUMERIC NOT NULL DEFAULT 0,
  impl_min_gp_margin_pct NUMERIC NOT NULL DEFAULT 0,
  nrr_payout_on_booking_pct NUMERIC NOT NULL DEFAULT 0,
  nrr_payout_on_collection_pct NUMERIC NOT NULL DEFAULT 100,
  nrr_payout_on_year_end_pct NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_plan_name_per_year UNIQUE (name, effective_year)
);

-- plan_metrics
CREATE TABLE public.plan_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.comp_plans(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  weightage_percent NUMERIC NOT NULL,
  logic_type logic_type NOT NULL DEFAULT 'Linear',
  gate_threshold_percent NUMERIC DEFAULT NULL,
  payout_on_booking_pct NUMERIC DEFAULT 75,
  payout_on_collection_pct NUMERIC DEFAULT 25,
  payout_on_year_end_pct NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- multiplier_grids
CREATE TABLE public.multiplier_grids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_metric_id UUID NOT NULL REFERENCES public.plan_metrics(id) ON DELETE CASCADE,
  min_pct NUMERIC NOT NULL,
  max_pct NUMERIC NOT NULL,
  multiplier_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- plan_commissions
CREATE TABLE public.plan_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.comp_plans(id) ON DELETE CASCADE,
  commission_type TEXT NOT NULL,
  commission_rate_pct NUMERIC NOT NULL DEFAULT 0,
  min_threshold_usd NUMERIC,
  min_gp_margin_pct NUMERIC,
  is_active BOOLEAN DEFAULT true,
  payout_on_booking_pct NUMERIC DEFAULT 75,
  payout_on_collection_pct NUMERIC DEFAULT 25,
  payout_on_year_end_pct NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plan_id, commission_type)
);

-- plan_spiffs
CREATE TABLE public.plan_spiffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.comp_plans(id) ON DELETE CASCADE,
  spiff_name TEXT NOT NULL,
  description TEXT,
  linked_metric_name TEXT NOT NULL,
  spiff_rate_pct NUMERIC NOT NULL DEFAULT 0,
  min_deal_value_usd NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  payout_on_booking_pct NUMERIC NOT NULL DEFAULT 0,
  payout_on_collection_pct NUMERIC NOT NULL DEFAULT 100,
  payout_on_year_end_pct NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_targets
CREATE TABLE public.user_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.comp_plans(id) ON DELETE CASCADE,
  effective_start_date DATE NOT NULL,
  effective_end_date DATE NOT NULL,
  target_value_annual NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  target_bonus_percent NUMERIC,
  tfp_local_currency NUMERIC,
  ote_local_currency NUMERIC,
  tfp_usd NUMERIC,
  target_bonus_usd NUMERIC,
  ote_usd NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- monthly_actuals
CREATE TABLE public.monthly_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month_year DATE NOT NULL,
  metric_id UUID NOT NULL REFERENCES public.plan_metrics(id) ON DELETE CASCADE,
  achieved_value_local_currency NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- exchange_rates
CREATE TABLE public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code TEXT NOT NULL,
  month_year DATE NOT NULL,
  rate_to_usd NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(currency_code, month_year)
);

-- currencies
CREATE TABLE public.currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- performance_targets
CREATE TABLE public.performance_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  target_value_usd NUMERIC NOT NULL DEFAULT 0,
  effective_year INTEGER NOT NULL DEFAULT 2025,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- quarterly_targets
CREATE TABLE public.quarterly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  quarter INTEGER NOT NULL,
  target_value_usd NUMERIC NOT NULL DEFAULT 0,
  effective_year INTEGER NOT NULL DEFAULT 2025,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- closing_arr_targets
CREATE TABLE public.closing_arr_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  effective_year INTEGER NOT NULL DEFAULT 2025,
  opening_arr_usd NUMERIC NOT NULL DEFAULT 0,
  software_bookings_target_usd NUMERIC NOT NULL DEFAULT 0,
  msps_bookings_target_usd NUMERIC NOT NULL DEFAULT 0,
  software_churn_allowance_usd NUMERIC NOT NULL DEFAULT 0,
  ms_churn_allowance_usd NUMERIC NOT NULL DEFAULT 0,
  net_price_increase_target_usd NUMERIC NOT NULL DEFAULT 0,
  closing_arr_target_usd NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- commission_structures
CREATE TABLE public.commission_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_function TEXT NOT NULL,
  commission_type TEXT NOT NULL,
  commission_rate_pct NUMERIC NOT NULL DEFAULT 0,
  min_arr_threshold_usd NUMERIC,
  requires_100_pct_achievement BOOLEAN NOT NULL DEFAULT false,
  effective_year INTEGER NOT NULL DEFAULT 2025,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- monthly_bookings
CREATE TABLE public.monthly_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  month_year DATE NOT NULL,
  booking_type TEXT NOT NULL,
  booking_value_usd NUMERIC NOT NULL DEFAULT 0,
  booking_value_local NUMERIC,
  local_currency TEXT DEFAULT 'USD',
  tcv_value_usd NUMERIC,
  deal_type TEXT,
  first_year_amc_arr_usd NUMERIC,
  deal_name TEXT,
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'booked',
  collection_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- support_teams
CREATE TABLE public.support_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name TEXT NOT NULL,
  team_role TEXT NOT NULL,
  region TEXT,
  bu TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- support_team_members
CREATE TABLE public.support_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.support_teams(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- sales_functions
CREATE TABLE public.sales_functions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- closing_arr_actuals
CREATE TABLE public.closing_arr_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year DATE NOT NULL,
  bu TEXT NOT NULL,
  product TEXT NOT NULL,
  pid TEXT NOT NULL,
  customer_code TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  order_category TEXT,
  status TEXT,
  order_category_2 TEXT,
  opening_arr NUMERIC DEFAULT 0,
  cr NUMERIC DEFAULT 0,
  als_others NUMERIC DEFAULT 0,
  new NUMERIC DEFAULT 0,
  inflation NUMERIC DEFAULT 0,
  discount_decrement NUMERIC DEFAULT 0,
  churn NUMERIC DEFAULT 0,
  adjustment NUMERIC DEFAULT 0,
  closing_arr NUMERIC,
  country TEXT,
  revised_region TEXT,
  start_date DATE,
  end_date DATE,
  renewal_status TEXT,
  sales_rep_employee_id TEXT,
  sales_rep_name TEXT,
  sales_head_employee_id TEXT,
  sales_head_name TEXT,
  is_multi_year BOOLEAN NOT NULL DEFAULT false,
  renewal_years INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- closing_arr_renewal_multipliers
CREATE TABLE public.closing_arr_renewal_multipliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.comp_plans(id) ON DELETE CASCADE,
  min_years INTEGER NOT NULL,
  max_years INTEGER,
  multiplier_value NUMERIC NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PART 3: DEALS AND RELATED TABLES
-- ============================================================

-- deals
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  customer_code TEXT NOT NULL,
  customer_name TEXT,
  region TEXT NOT NULL,
  country TEXT NOT NULL,
  bu TEXT NOT NULL,
  product TEXT NOT NULL,
  type_of_proposal TEXT NOT NULL,
  gp_margin_percent NUMERIC,
  month_year DATE NOT NULL,
  first_year_amc_usd NUMERIC DEFAULT 0,
  first_year_subscription_usd NUMERIC DEFAULT 0,
  new_software_booking_arr_usd NUMERIC,
  managed_services_usd NUMERIC DEFAULT 0,
  implementation_usd NUMERIC DEFAULT 0,
  cr_usd NUMERIC DEFAULT 0,
  er_usd NUMERIC DEFAULT 0,
  tcv_usd NUMERIC DEFAULT 0,
  perpetual_license_usd NUMERIC DEFAULT 0,
  sales_rep_employee_id TEXT,
  sales_rep_name TEXT,
  sales_head_employee_id TEXT,
  sales_head_name TEXT,
  sales_engineering_employee_id TEXT,
  sales_engineering_name TEXT,
  sales_engineering_head_employee_id TEXT,
  sales_engineering_head_name TEXT,
  channel_sales_employee_id TEXT,
  channel_sales_name TEXT,
  product_specialist_employee_id TEXT,
  product_specialist_name TEXT,
  product_specialist_head_employee_id TEXT,
  product_specialist_head_name TEXT,
  solution_manager_employee_id TEXT,
  solution_manager_name TEXT,
  solution_manager_head_employee_id TEXT,
  solution_manager_head_name TEXT,
  solution_architect_employee_id TEXT,
  solution_architect_name TEXT,
  sales_engineering_team_id UUID REFERENCES public.support_teams(id),
  solution_manager_team_id UUID REFERENCES public.support_teams(id),
  linked_to_impl BOOLEAN DEFAULT false,
  eligible_for_perpetual_incentive BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- deal_participants
CREATE TABLE public.deal_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  participant_role TEXT NOT NULL,
  split_percent NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- deal_audit_log
CREATE TABLE public.deal_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_values JSONB,
  new_values JSONB,
  is_retroactive BOOLEAN NOT NULL DEFAULT false,
  period_month DATE,
  reason TEXT
);

-- deal_collections
CREATE TABLE public.deal_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE UNIQUE,
  booking_month DATE NOT NULL,
  project_id TEXT NOT NULL,
  customer_name TEXT,
  deal_value_usd NUMERIC NOT NULL DEFAULT 0,
  is_collected BOOLEAN DEFAULT false,
  collection_date DATE,
  collection_amount_usd NUMERIC,
  collection_month DATE,
  first_milestone_due_date DATE,
  is_clawback_triggered BOOLEAN DEFAULT false,
  clawback_amount_usd NUMERIC DEFAULT 0,
  clawback_triggered_at TIMESTAMPTZ,
  notes TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PART 4: PAYOUT TABLES
-- ============================================================

-- payout_runs
CREATE TABLE public.payout_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year DATE NOT NULL UNIQUE,
  run_status TEXT NOT NULL DEFAULT 'draft',
  calculated_by UUID,
  calculated_at TIMESTAMPTZ,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  finalized_by UUID,
  finalized_at TIMESTAMPTZ,
  paid_by UUID,
  paid_at TIMESTAMPTZ,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  total_payout_usd NUMERIC DEFAULT 0,
  total_variable_pay_usd NUMERIC DEFAULT 0,
  total_commissions_usd NUMERIC DEFAULT 0,
  total_clawbacks_usd NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- monthly_payouts
CREATE TABLE public.monthly_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  month_year DATE NOT NULL,
  payout_type TEXT NOT NULL,
  calculated_amount_usd NUMERIC NOT NULL DEFAULT 0,
  paid_amount_usd NUMERIC DEFAULT 0,
  holdback_amount_usd NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'calculated',
  paid_date DATE,
  notes TEXT,
  deal_id UUID REFERENCES public.deals(id),
  plan_id UUID REFERENCES public.comp_plans(id),
  metric_id UUID REFERENCES public.plan_metrics(id),
  commission_id UUID REFERENCES public.plan_commissions(id),
  payout_run_id UUID REFERENCES public.payout_runs(id),
  booking_amount_usd NUMERIC DEFAULT 0,
  collection_amount_usd NUMERIC DEFAULT 0,
  clawback_amount_usd NUMERIC DEFAULT 0,
  approval_status TEXT DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  calculated_amount_local NUMERIC DEFAULT 0,
  paid_amount_local NUMERIC DEFAULT 0,
  booking_amount_local NUMERIC DEFAULT 0,
  collection_amount_local NUMERIC DEFAULT 0,
  holdback_amount_local NUMERIC DEFAULT 0,
  year_end_amount_usd NUMERIC DEFAULT 0,
  year_end_amount_local NUMERIC DEFAULT 0,
  clawback_amount_local NUMERIC DEFAULT 0,
  local_currency TEXT DEFAULT 'USD',
  exchange_rate_used NUMERIC DEFAULT 1,
  exchange_rate_type TEXT DEFAULT 'compensation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- payout_audit_log
CREATE TABLE public.payout_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID REFERENCES public.monthly_payouts(id) ON DELETE SET NULL,
  deal_collection_id UUID REFERENCES public.deal_collections(id) ON DELETE SET NULL,
  payout_run_id UUID REFERENCES public.payout_runs(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'payout',
  action_type TEXT,
  audit_category TEXT,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  month_year DATE,
  employee_id TEXT,
  amount_usd NUMERIC,
  amount_local NUMERIC,
  local_currency TEXT,
  exchange_rate_used NUMERIC,
  compensation_rate NUMERIC,
  market_rate NUMERIC,
  rate_type TEXT,
  rate_variance_pct NUMERIC,
  is_rate_mismatch BOOLEAN DEFAULT false,
  metadata JSONB
);

-- payout_adjustments
CREATE TABLE public.payout_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id UUID NOT NULL REFERENCES public.payout_runs(id),
  employee_id TEXT NOT NULL,
  original_amount_usd NUMERIC NOT NULL DEFAULT 0,
  adjustment_amount_usd NUMERIC NOT NULL DEFAULT 0,
  original_amount_local NUMERIC NOT NULL DEFAULT 0,
  adjustment_amount_local NUMERIC NOT NULL DEFAULT 0,
  local_currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate_used NUMERIC NOT NULL DEFAULT 1,
  adjustment_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  supporting_documents JSONB,
  requested_by UUID,
  approved_by UUID,
  applied_to_month DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- deal_variable_pay_attribution
CREATE TABLE public.deal_variable_pay_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  plan_id UUID REFERENCES public.comp_plans(id),
  payout_run_id UUID REFERENCES public.payout_runs(id),
  fiscal_year INTEGER NOT NULL,
  calculation_month DATE NOT NULL,
  metric_name TEXT NOT NULL,
  deal_value_usd NUMERIC NOT NULL,
  total_actual_usd NUMERIC NOT NULL,
  target_usd NUMERIC NOT NULL,
  achievement_pct NUMERIC NOT NULL,
  multiplier NUMERIC NOT NULL,
  total_variable_pay_usd NUMERIC NOT NULL,
  proportion_pct NUMERIC NOT NULL,
  variable_pay_split_usd NUMERIC NOT NULL,
  payout_on_booking_usd NUMERIC NOT NULL,
  payout_on_collection_usd NUMERIC NOT NULL,
  payout_on_year_end_usd NUMERIC NOT NULL,
  clawback_eligible_usd NUMERIC NOT NULL,
  is_clawback_triggered BOOLEAN DEFAULT false,
  clawback_amount_usd NUMERIC DEFAULT 0,
  clawback_date DATE,
  local_currency TEXT DEFAULT 'USD',
  compensation_exchange_rate NUMERIC DEFAULT 1,
  variable_pay_split_local NUMERIC DEFAULT 0,
  payout_on_booking_local NUMERIC DEFAULT 0,
  payout_on_collection_local NUMERIC DEFAULT 0,
  payout_on_year_end_local NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(deal_id, employee_id, metric_name, fiscal_year)
);

-- payout_metric_details
CREATE TABLE public.payout_metric_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id UUID NOT NULL REFERENCES public.payout_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  component_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  plan_id UUID REFERENCES public.comp_plans(id),
  plan_name TEXT,
  target_bonus_usd NUMERIC DEFAULT 0,
  allocated_ote_usd NUMERIC DEFAULT 0,
  target_usd NUMERIC DEFAULT 0,
  actual_usd NUMERIC DEFAULT 0,
  achievement_pct NUMERIC DEFAULT 0,
  multiplier NUMERIC DEFAULT 0,
  ytd_eligible_usd NUMERIC DEFAULT 0,
  prior_paid_usd NUMERIC DEFAULT 0,
  this_month_usd NUMERIC DEFAULT 0,
  booking_usd NUMERIC DEFAULT 0,
  collection_usd NUMERIC DEFAULT 0,
  year_end_usd NUMERIC DEFAULT 0,
  commission_rate_pct NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- payout_deal_details
CREATE TABLE public.payout_deal_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id UUID NOT NULL REFERENCES public.payout_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL,
  deal_id UUID NOT NULL REFERENCES public.deals(id),
  project_id TEXT,
  customer_name TEXT,
  commission_type TEXT NOT NULL,
  component_type TEXT NOT NULL DEFAULT 'commission',
  deal_value_usd NUMERIC NOT NULL DEFAULT 0,
  gp_margin_pct NUMERIC,
  min_gp_margin_pct NUMERIC,
  commission_rate_pct NUMERIC NOT NULL DEFAULT 0,
  is_eligible BOOLEAN NOT NULL DEFAULT true,
  exclusion_reason TEXT,
  gross_commission_usd NUMERIC NOT NULL DEFAULT 0,
  booking_usd NUMERIC NOT NULL DEFAULT 0,
  collection_usd NUMERIC NOT NULL DEFAULT 0,
  year_end_usd NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- closing_arr_payout_details
CREATE TABLE public.closing_arr_payout_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id UUID NOT NULL,
  employee_id TEXT NOT NULL,
  closing_arr_actual_id UUID NOT NULL,
  pid TEXT NOT NULL,
  customer_name TEXT,
  customer_code TEXT,
  bu TEXT,
  product TEXT,
  month_year DATE,
  end_date DATE,
  is_multi_year BOOLEAN NOT NULL DEFAULT false,
  renewal_years INTEGER NOT NULL DEFAULT 1,
  closing_arr_usd NUMERIC NOT NULL DEFAULT 0,
  multiplier NUMERIC NOT NULL DEFAULT 1.0,
  adjusted_arr_usd NUMERIC NOT NULL DEFAULT 0,
  is_eligible BOOLEAN NOT NULL DEFAULT true,
  exclusion_reason TEXT,
  order_category_2 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PART 5: CLAWBACK, SPIFF, AND F&F TABLES
-- ============================================================

-- clawback_ledger
CREATE TABLE public.clawback_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  deal_id UUID NOT NULL REFERENCES public.deals(id),
  deal_collection_id UUID NOT NULL REFERENCES public.deal_collections(id),
  original_amount_usd NUMERIC NOT NULL DEFAULT 0,
  recovered_amount_usd NUMERIC NOT NULL DEFAULT 0,
  remaining_amount_usd NUMERIC GENERATED ALWAYS AS (original_amount_usd - recovered_amount_usd) STORED,
  status TEXT NOT NULL DEFAULT 'pending',
  triggered_month DATE NOT NULL,
  last_recovery_month DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- deal_team_spiff_allocations
CREATE TABLE public.deal_team_spiff_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id),
  employee_id TEXT NOT NULL,
  allocated_amount_usd NUMERIC NOT NULL DEFAULT 0,
  allocated_amount_local NUMERIC NOT NULL DEFAULT 0,
  local_currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate_used NUMERIC NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  payout_month DATE NOT NULL,
  payout_run_id UUID REFERENCES public.payout_runs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- deal_team_spiff_config
CREATE TABLE public.deal_team_spiff_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spiff_pool_amount_usd NUMERIC NOT NULL DEFAULT 10000,
  min_deal_arr_usd NUMERIC NOT NULL DEFAULT 400000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  exclude_roles TEXT[] NOT NULL DEFAULT ARRAY['sales_rep', 'sales_head'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- fnf_settlements
CREATE TABLE public.fnf_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  departure_date DATE NOT NULL,
  fiscal_year INTEGER NOT NULL,
  collection_grace_days INTEGER NOT NULL DEFAULT 90,
  tranche1_status TEXT NOT NULL DEFAULT 'draft',
  tranche1_total_usd NUMERIC DEFAULT 0,
  tranche1_calculated_at TIMESTAMPTZ,
  tranche1_finalized_at TIMESTAMPTZ,
  tranche2_status TEXT NOT NULL DEFAULT 'pending',
  tranche2_eligible_date DATE,
  tranche2_total_usd NUMERIC DEFAULT 0,
  tranche2_calculated_at TIMESTAMPTZ,
  tranche2_finalized_at TIMESTAMPTZ,
  clawback_carryforward_usd NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- fnf_settlement_lines
CREATE TABLE public.fnf_settlement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES public.fnf_settlements(id) ON DELETE CASCADE,
  tranche INTEGER NOT NULL,
  line_type TEXT NOT NULL,
  payout_type TEXT,
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  amount_local NUMERIC DEFAULT 0,
  local_currency TEXT DEFAULT 'USD',
  exchange_rate_used NUMERIC DEFAULT 1,
  deal_id UUID,
  source_payout_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PART 6: AUDIT TABLES
-- ============================================================

-- system_audit_log
CREATE TABLE public.system_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_retroactive BOOLEAN NOT NULL DEFAULT false,
  reason TEXT
);

-- employee_change_log
CREATE TABLE public.employee_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID,
  change_type TEXT NOT NULL,
  change_reason TEXT,
  field_changes JSONB NOT NULL DEFAULT '{}',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- ============================================================
-- PART 7: FK CONSTRAINTS (added after table creation)
-- ============================================================

ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_fkey
  FOREIGN KEY (role) REFERENCES public.roles(name) ON DELETE CASCADE;

ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_fkey
  FOREIGN KEY (role) REFERENCES public.roles(name) ON DELETE CASCADE;

-- ============================================================
-- PART 8: ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comp_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiplier_grids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_spiffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quarterly_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closing_arr_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closing_arr_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closing_arr_renewal_multipliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_variable_pay_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_metric_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_deal_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closing_arr_payout_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clawback_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_team_spiff_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_team_spiff_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fnf_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fnf_settlement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_change_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART 9: FUNCTIONS
-- ============================================================

-- has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- has_permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission_key TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.role_permissions rp JOIN public.user_roles ur ON ur.role = rp.role WHERE ur.user_id = _user_id AND rp.permission_key = _permission_key AND rp.is_allowed = true) $$;

-- update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- update_deal_collections_updated_at
CREATE OR REPLACE FUNCTION public.update_deal_collections_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp_id text;
BEGIN
  SELECT employee_id INTO emp_id FROM public.employees WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1;
  INSERT INTO public.profiles (id, email, full_name, employee_id)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email), emp_id);
  RETURN NEW;
END; $$;

-- calculate_compensation_exchange_rate
CREATE OR REPLACE FUNCTION public.calculate_compensation_exchange_rate()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ote_usd IS NOT NULL AND NEW.ote_usd > 0 AND NEW.ote_local_currency IS NOT NULL THEN
    NEW.compensation_exchange_rate := ROUND((NEW.ote_local_currency / NEW.ote_usd)::numeric, 4);
  ELSE
    NEW.compensation_exchange_rate := 1;
  END IF;
  RETURN NEW;
END; $$;

-- auto_create_deal_collection
CREATE OR REPLACE FUNCTION public.auto_create_deal_collection()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.deal_collections (deal_id, booking_month, project_id, customer_name, deal_value_usd, is_collected, first_milestone_due_date)
  VALUES (NEW.id, NEW.month_year, NEW.project_id, NEW.customer_name, COALESCE(NEW.tcv_usd, 0), false,
    (date_trunc('month', NEW.month_year) + interval '1 month' - interval '1 day' + interval '180 days')::date)
  ON CONFLICT (deal_id) DO UPDATE SET
    booking_month = EXCLUDED.booking_month, project_id = EXCLUDED.project_id,
    customer_name = EXCLUDED.customer_name, deal_value_usd = EXCLUDED.deal_value_usd, updated_at = now();
  RETURN NEW;
END; $$;

-- log_deal_changes
CREATE OR REPLACE FUNCTION public.log_deal_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE current_period date; is_retro boolean;
BEGIN
  current_period := date_trunc('month', CURRENT_DATE)::date;
  IF TG_OP = 'INSERT' THEN
    is_retro := NEW.month_year < current_period;
    INSERT INTO public.deal_audit_log (deal_id, action, changed_by, old_values, new_values, is_retroactive, period_month)
    VALUES (NEW.id, 'CREATE', auth.uid(), NULL, to_jsonb(NEW), is_retro, NEW.month_year);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    is_retro := OLD.month_year < current_period OR NEW.month_year < current_period;
    INSERT INTO public.deal_audit_log (deal_id, action, changed_by, old_values, new_values, is_retroactive, period_month)
    VALUES (NEW.id, 'UPDATE', auth.uid(), to_jsonb(OLD), to_jsonb(NEW), is_retro, NEW.month_year);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    is_retro := OLD.month_year < current_period;
    INSERT INTO public.deal_audit_log (deal_id, action, changed_by, old_values, new_values, is_retroactive, period_month)
    VALUES (OLD.id, 'DELETE', auth.uid(), to_jsonb(OLD), NULL, is_retro, OLD.month_year);
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

-- log_payout_change
CREATE OR REPLACE FUNCTION public.log_payout_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payout_audit_log (payout_id, action, entity_type, new_values, changed_by)
    VALUES (NEW.id, 'created', 'payout', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.payout_audit_log (payout_id, action, entity_type, old_values, new_values, changed_by)
    VALUES (NEW.id, 'updated', 'payout', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.payout_audit_log (payout_id, action, entity_type, old_values, changed_by, payout_run_id, employee_id, month_year)
    VALUES (NULL, 'deleted', 'payout', to_jsonb(OLD), auth.uid(), OLD.payout_run_id, OLD.employee_id, OLD.month_year);
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

-- log_collection_change
CREATE OR REPLACE FUNCTION public.log_collection_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payout_audit_log (deal_collection_id, action, entity_type, new_values, changed_by)
    VALUES (NEW.id, 'created', 'collection', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.payout_audit_log (deal_collection_id, action, entity_type, old_values, new_values, changed_by)
    VALUES (NEW.id, 'updated', 'collection', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  END IF;
  RETURN NEW;
END; $$;

-- log_payout_run_change
CREATE OR REPLACE FUNCTION public.log_payout_run_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payout_audit_log (payout_run_id, action, entity_type, audit_category, new_values, changed_by, month_year)
    VALUES (NEW.id, 'created', 'payout_run', 'run_lifecycle', to_jsonb(NEW), auth.uid(), NEW.month_year);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.run_status IS DISTINCT FROM NEW.run_status THEN
      INSERT INTO public.payout_audit_log (payout_run_id, action, entity_type, audit_category, old_values, new_values, changed_by, month_year)
      VALUES (NEW.id,
        CASE WHEN NEW.run_status = 'finalized' THEN 'finalized' WHEN NEW.run_status = 'paid' THEN 'paid' ELSE 'status_changed' END,
        'payout_run', 'run_lifecycle',
        jsonb_build_object('run_status', OLD.run_status), jsonb_build_object('run_status', NEW.run_status),
        auth.uid(), NEW.month_year);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

-- log_adjustment_change
CREATE OR REPLACE FUNCTION public.log_adjustment_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_month_year date;
BEGIN
  SELECT month_year INTO v_month_year FROM public.payout_runs WHERE id = COALESCE(NEW.payout_run_id, OLD.payout_run_id);
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payout_audit_log (payout_run_id, action, entity_type, audit_category, employee_id, amount_usd, amount_local, local_currency, exchange_rate_used, new_values, changed_by, month_year, reason)
    VALUES (NEW.payout_run_id, 'adjustment_created', 'adjustment', 'adjustment', NEW.employee_id, NEW.adjustment_amount_usd, NEW.adjustment_amount_local, NEW.local_currency, NEW.exchange_rate_used, to_jsonb(NEW), auth.uid(), v_month_year, NEW.reason);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.payout_audit_log (payout_run_id, action, entity_type, audit_category, employee_id, amount_usd, amount_local, local_currency, old_values, new_values, changed_by, month_year, reason)
      VALUES (NEW.payout_run_id,
        CASE NEW.status WHEN 'approved' THEN 'adjustment_approved' WHEN 'rejected' THEN 'adjustment_rejected' WHEN 'applied' THEN 'adjustment_applied' ELSE 'adjustment_updated' END,
        'adjustment', 'adjustment', NEW.employee_id, NEW.adjustment_amount_usd, NEW.adjustment_amount_local, NEW.local_currency,
        jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status, 'applied_to_month', NEW.applied_to_month),
        auth.uid(), v_month_year, NEW.reason);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

-- check_month_lock
CREATE OR REPLACE FUNCTION public.check_month_lock()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_is_locked BOOLEAN; v_month_year date;
BEGIN
  IF TG_OP = 'DELETE' THEN v_month_year := date_trunc('month', OLD.month_year)::date;
  ELSE v_month_year := date_trunc('month', NEW.month_year)::date; END IF;
  SELECT is_locked INTO v_is_locked FROM public.payout_runs WHERE month_year = v_month_year ORDER BY created_at DESC LIMIT 1;
  IF v_is_locked = TRUE THEN
    RAISE EXCEPTION 'Cannot modify data for locked payout month: %. Use payout adjustments for corrections.', v_month_year;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;

-- check_collection_month_lock
CREATE OR REPLACE FUNCTION public.check_collection_month_lock()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF NEW.collection_month IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.payout_runs WHERE month_year = NEW.collection_month AND is_locked = true) THEN
        RAISE EXCEPTION 'Cannot update collection: the collection month (%) is in a locked payout month.', NEW.collection_month;
      END IF;
    END IF;
    IF OLD.collection_month IS NOT NULL AND NEW.is_collected = false THEN
      IF EXISTS (SELECT 1 FROM public.payout_runs WHERE month_year = OLD.collection_month AND is_locked = true) THEN
        RAISE EXCEPTION 'Cannot revert collection: the original collection month (%) is in a locked payout month.', OLD.collection_month;
      END IF;
    END IF;
    IF NEW.is_clawback_triggered = true AND OLD.is_clawback_triggered = false THEN NULL; END IF;
  END IF;
  RETURN NEW;
END; $$;

-- set_collection_month
CREATE OR REPLACE FUNCTION public.set_collection_month()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.is_collected = true AND (OLD.is_collected = false OR OLD.is_collected IS NULL) THEN
    NEW.collection_month := date_trunc('month', COALESCE(NEW.collection_date::date, CURRENT_DATE))::date;
  END IF;
  IF NEW.is_collected = false AND OLD.is_collected = true THEN
    NEW.collection_month := NULL;
  END IF;
  RETURN NEW;
END; $$;

-- log_system_change
CREATE OR REPLACE FUNCTION public.log_system_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.system_audit_log (table_name, record_id, action, new_values, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id::text, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.system_audit_log (table_name, record_id, action, old_values, new_values, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id::text, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.system_audit_log (table_name, record_id, action, old_values, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id::text, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

-- auto_generate_role_permissions
CREATE OR REPLACE FUNCTION public.auto_generate_role_permissions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.role_permissions (role, permission_key, is_allowed)
  SELECT NEW.name, dk.permission_key, false
  FROM (SELECT DISTINCT permission_key FROM public.role_permissions) AS dk
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

-- ============================================================
-- PART 10: TRIGGERS
-- ============================================================

-- Auth trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_comp_plans_updated_at BEFORE UPDATE ON public.comp_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_monthly_actuals_updated_at BEFORE UPDATE ON public.monthly_actuals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_closing_arr_actuals_updated_at BEFORE UPDATE ON public.closing_arr_actuals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_monthly_payouts_updated_at BEFORE UPDATE ON public.monthly_payouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_monthly_bookings_updated_at BEFORE UPDATE ON public.monthly_bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payout_runs_updated_at BEFORE UPDATE ON public.payout_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payout_adjustments_updated_at BEFORE UPDATE ON public.payout_adjustments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deal_vp_attribution_updated_at BEFORE UPDATE ON public.deal_variable_pay_attribution FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clawback_ledger_updated_at BEFORE UPDATE ON public.clawback_ledger FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fnf_settlements_updated_at BEFORE UPDATE ON public.fnf_settlements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_role_permissions_updated_at BEFORE UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_deal_collections_updated_at BEFORE UPDATE ON public.deal_collections FOR EACH ROW EXECUTE FUNCTION public.update_deal_collections_updated_at();

-- Compensation exchange rate
CREATE TRIGGER set_compensation_exchange_rate BEFORE INSERT OR UPDATE OF ote_usd, ote_local_currency ON public.employees FOR EACH ROW EXECUTE FUNCTION public.calculate_compensation_exchange_rate();

-- Deal auto-collection creation
CREATE TRIGGER trigger_auto_create_deal_collection AFTER INSERT OR UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.auto_create_deal_collection();

-- Deal audit logging
CREATE TRIGGER log_deal_changes_trigger AFTER INSERT OR UPDATE OR DELETE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.log_deal_changes();

-- Month lock triggers
CREATE TRIGGER check_deals_month_lock BEFORE INSERT OR UPDATE OR DELETE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.check_month_lock();
CREATE TRIGGER check_closing_arr_month_lock BEFORE INSERT OR UPDATE OR DELETE ON public.closing_arr_actuals FOR EACH ROW EXECUTE FUNCTION public.check_month_lock();
CREATE TRIGGER check_collections_month_lock BEFORE UPDATE ON public.deal_collections FOR EACH ROW EXECUTE FUNCTION public.check_collection_month_lock();

-- Collection month auto-set
CREATE TRIGGER set_collection_month_trigger BEFORE UPDATE ON public.deal_collections FOR EACH ROW EXECUTE FUNCTION public.set_collection_month();

-- Payout audit triggers
CREATE TRIGGER trigger_log_payout_change AFTER INSERT OR UPDATE OR DELETE ON public.monthly_payouts FOR EACH ROW EXECUTE FUNCTION public.log_payout_change();
CREATE TRIGGER trigger_log_collection_change AFTER INSERT OR UPDATE ON public.deal_collections FOR EACH ROW EXECUTE FUNCTION public.log_collection_change();
CREATE TRIGGER log_payout_run_changes AFTER INSERT OR UPDATE ON public.payout_runs FOR EACH ROW EXECUTE FUNCTION public.log_payout_run_change();
CREATE TRIGGER log_adjustment_changes AFTER INSERT OR UPDATE ON public.payout_adjustments FOR EACH ROW EXECUTE FUNCTION public.log_adjustment_change();

-- System audit triggers
CREATE TRIGGER audit_employees AFTER INSERT OR UPDATE OR DELETE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_comp_plans AFTER INSERT OR UPDATE OR DELETE ON public.comp_plans FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_plan_metrics AFTER INSERT OR UPDATE OR DELETE ON public.plan_metrics FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_multiplier_grids AFTER INSERT OR UPDATE OR DELETE ON public.multiplier_grids FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_performance_targets AFTER INSERT OR UPDATE OR DELETE ON public.performance_targets FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_exchange_rates AFTER INSERT OR UPDATE OR DELETE ON public.exchange_rates FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_closing_arr_actuals AFTER INSERT OR UPDATE OR DELETE ON public.closing_arr_actuals FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_user_targets AFTER INSERT OR UPDATE OR DELETE ON public.user_targets FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_plan_spiffs AFTER INSERT OR UPDATE OR DELETE ON public.plan_spiffs FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_support_teams AFTER INSERT OR UPDATE OR DELETE ON public.support_teams FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_support_team_members AFTER INSERT OR UPDATE OR DELETE ON public.support_team_members FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_sales_functions AFTER INSERT OR UPDATE OR DELETE ON public.sales_functions FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_roles AFTER INSERT OR UPDATE OR DELETE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_role_permissions AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_plan_commissions AFTER INSERT OR UPDATE OR DELETE ON public.plan_commissions FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_commission_structures AFTER INSERT OR UPDATE OR DELETE ON public.commission_structures FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_closing_arr_renewal_multipliers AFTER INSERT OR UPDATE OR DELETE ON public.closing_arr_renewal_multipliers FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_deal_team_spiff_config AFTER INSERT OR UPDATE OR DELETE ON public.deal_team_spiff_config FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_deal_team_spiff_allocations AFTER INSERT OR UPDATE OR DELETE ON public.deal_team_spiff_allocations FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_fnf_settlements AFTER INSERT OR UPDATE OR DELETE ON public.fnf_settlements FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_fnf_settlement_lines AFTER INSERT OR UPDATE OR DELETE ON public.fnf_settlement_lines FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_deal_participants AFTER INSERT OR UPDATE OR DELETE ON public.deal_participants FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_closing_arr_targets AFTER INSERT OR UPDATE OR DELETE ON public.closing_arr_targets FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_quarterly_targets AFTER INSERT OR UPDATE OR DELETE ON public.quarterly_targets FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER audit_currencies AFTER INSERT OR UPDATE OR DELETE ON public.currencies FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

-- Auto-generate permissions for new roles
CREATE TRIGGER trigger_auto_generate_role_permissions AFTER INSERT ON public.roles FOR EACH ROW EXECUTE FUNCTION public.auto_generate_role_permissions();

-- ============================================================
-- PART 11: RLS POLICIES
-- ============================================================

-- profiles
CREATE POLICY "prof_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "prof_admin" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "prof_exec" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "prof_fin" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "prof_gtm" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "prof_mgr" ON public.profiles FOR SELECT TO authenticated USING (manager_id = auth.uid());
CREATE POLICY "prof_ins" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "prof_upd" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- employees
CREATE POLICY "emp_admin" ON public.employees FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "emp_view" ON public.employees FOR SELECT TO authenticated USING (true);

-- roles
CREATE POLICY "Authenticated users can read roles" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert roles" ON public.roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.roles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "ur_admin_all" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "ur_admin_view" ON public.user_roles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "ur_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- role_permissions
CREATE POLICY "rp_admin" ON public.role_permissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "rp_view" ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- comp_plans
CREATE POLICY "cp_del" ON public.comp_plans FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "cp_ins" ON public.comp_plans FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "cp_upd" ON public.comp_plans FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "cp_view" ON public.comp_plans FOR SELECT TO authenticated USING (true);

-- plan_metrics
CREATE POLICY "pm_admin" ON public.plan_metrics FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "pm_view" ON public.plan_metrics FOR SELECT TO authenticated USING (true);

-- multiplier_grids
CREATE POLICY "mg_admin" ON public.multiplier_grids FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "mg_view" ON public.multiplier_grids FOR SELECT TO authenticated USING (true);

-- plan_commissions
CREATE POLICY "pc_admin" ON public.plan_commissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "pc_view" ON public.plan_commissions FOR SELECT TO authenticated USING (true);

-- plan_spiffs
CREATE POLICY "Authenticated users can read plan_spiffs" ON public.plan_spiffs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin and GTM Ops can insert plan_spiffs" ON public.plan_spiffs FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "Admin and GTM Ops can update plan_spiffs" ON public.plan_spiffs FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "Admin and GTM Ops can delete plan_spiffs" ON public.plan_spiffs FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gtm_ops'));

-- user_targets
CREATE POLICY "ut_admin_all" ON public.user_targets FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "ut_admin_view" ON public.user_targets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "ut_exec" ON public.user_targets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "ut_fin" ON public.user_targets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "ut_gtm" ON public.user_targets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "ut_mgr" ON public.user_targets FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = user_targets.user_id AND profiles.manager_id = auth.uid()));
CREATE POLICY "ut_own" ON public.user_targets FOR SELECT TO authenticated USING (user_id = auth.uid());

-- monthly_actuals
CREATE POLICY "ma_admin" ON public.monthly_actuals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "ma_exec" ON public.monthly_actuals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "ma_fin" ON public.monthly_actuals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "ma_gtm_all" ON public.monthly_actuals FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "ma_gtm_view" ON public.monthly_actuals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "ma_mgr" ON public.monthly_actuals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = monthly_actuals.user_id AND profiles.manager_id = auth.uid()));
CREATE POLICY "ma_own_all" ON public.monthly_actuals FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ma_own_view" ON public.monthly_actuals FOR SELECT TO authenticated USING (user_id = auth.uid());

-- exchange_rates
CREATE POLICY "er_admin" ON public.exchange_rates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "er_view" ON public.exchange_rates FOR SELECT TO authenticated USING (true);

-- currencies
CREATE POLICY "cur_admin" ON public.currencies FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "cur_view" ON public.currencies FOR SELECT TO authenticated USING (true);

-- performance_targets
CREATE POLICY "pt_admin" ON public.performance_targets FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "pt_view" ON public.performance_targets FOR SELECT TO authenticated USING (true);

-- quarterly_targets
CREATE POLICY "qt_admin" ON public.quarterly_targets FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "qt_view" ON public.quarterly_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "qt_gtm" ON public.quarterly_targets FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));

-- closing_arr_targets
CREATE POLICY "cat_admin" ON public.closing_arr_targets FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "cat_view" ON public.closing_arr_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_gtm" ON public.closing_arr_targets FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));

-- commission_structures
CREATE POLICY "cs_admin" ON public.commission_structures FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "cs_view" ON public.commission_structures FOR SELECT TO authenticated USING (true);

-- monthly_bookings
CREATE POLICY "mb_admin" ON public.monthly_bookings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "mb_view" ON public.monthly_bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "mb_fin" ON public.monthly_bookings FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "mb_gtm" ON public.monthly_bookings FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));

-- monthly_payouts
CREATE POLICY "mp_admin" ON public.monthly_payouts FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "mp_view" ON public.monthly_payouts FOR SELECT TO authenticated USING (true);
CREATE POLICY "mp_fin" ON public.monthly_payouts FOR ALL TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "mp_gtm" ON public.monthly_payouts FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));

-- support_teams
CREATE POLICY "st_view" ON public.support_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "st_admin" ON public.support_teams FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "st_gtm" ON public.support_teams FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));

-- support_team_members
CREATE POLICY "stm_view" ON public.support_team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "stm_admin" ON public.support_team_members FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "stm_gtm" ON public.support_team_members FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));

-- sales_functions
CREATE POLICY "Authenticated users can read sales_functions" ON public.sales_functions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert sales_functions" ON public.sales_functions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update sales_functions" ON public.sales_functions FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete sales_functions" ON public.sales_functions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- closing_arr_actuals
CREATE POLICY "ca_admin" ON public.closing_arr_actuals FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "ca_exec" ON public.closing_arr_actuals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "ca_fin" ON public.closing_arr_actuals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "ca_gtm" ON public.closing_arr_actuals FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "ca_sh" ON public.closing_arr_actuals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_head'));
CREATE POLICY "ca_sr" ON public.closing_arr_actuals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_rep') AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.employee_id IS NOT NULL AND (closing_arr_actuals.sales_rep_employee_id = p.employee_id OR closing_arr_actuals.sales_head_employee_id = p.employee_id)));

-- closing_arr_renewal_multipliers
CREATE POLICY "Authenticated users can read renewal multipliers" ON public.closing_arr_renewal_multipliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert renewal multipliers" ON public.closing_arr_renewal_multipliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update renewal multipliers" ON public.closing_arr_renewal_multipliers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete renewal multipliers" ON public.closing_arr_renewal_multipliers FOR DELETE TO authenticated USING (true);

-- deals
CREATE POLICY "d_admin" ON public.deals FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "d_exec" ON public.deals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "d_fin" ON public.deals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "d_gtm" ON public.deals FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "d_sh" ON public.deals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_head'));
CREATE POLICY "d_sr" ON public.deals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_rep') AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.employee_id IS NOT NULL AND (deals.sales_rep_employee_id = p.employee_id OR deals.sales_head_employee_id = p.employee_id OR deals.sales_engineering_employee_id = p.employee_id OR deals.sales_engineering_head_employee_id = p.employee_id OR deals.product_specialist_employee_id = p.employee_id OR deals.product_specialist_head_employee_id = p.employee_id OR deals.solution_manager_employee_id = p.employee_id OR deals.solution_manager_head_employee_id = p.employee_id)));

-- deal_participants
CREATE POLICY "dp_admin" ON public.deal_participants FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "dp_exec" ON public.deal_participants FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "dp_fin" ON public.deal_participants FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "dp_gtm" ON public.deal_participants FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "dp_sh" ON public.deal_participants FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_head'));

-- deal_audit_log
CREATE POLICY "dal_admin" ON public.deal_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "dal_exec" ON public.deal_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "dal_fin" ON public.deal_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "dal_gtm" ON public.deal_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "dal_insert" ON public.deal_audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- deal_collections
CREATE POLICY "dc_admin" ON public.deal_collections FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "dc_exec" ON public.deal_collections FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "dc_fin" ON public.deal_collections FOR ALL TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "dc_gtm" ON public.deal_collections FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "dc_sh" ON public.deal_collections FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_head'));
CREATE POLICY "dc_sr" ON public.deal_collections FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_rep') AND EXISTS (SELECT 1 FROM deals d JOIN profiles p ON p.id = auth.uid() WHERE d.id = deal_collections.deal_id AND p.employee_id IS NOT NULL AND (d.sales_rep_employee_id = p.employee_id OR d.sales_head_employee_id = p.employee_id)));

-- payout_runs
CREATE POLICY "pr_manage" ON public.payout_runs FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'gtm_ops', 'finance')));
CREATE POLICY "pr_view_finalized" ON public.payout_runs FOR SELECT TO authenticated USING (run_status IN ('finalized', 'paid'));

-- payout_audit_log
CREATE POLICY "pal_admin" ON public.payout_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "pal_fin" ON public.payout_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "pal_gtm" ON public.payout_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "pal_exec" ON public.payout_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "pal_insert" ON public.payout_audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- payout_adjustments
CREATE POLICY "pa_manage" ON public.payout_adjustments FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'finance', 'gtm_ops')));

-- deal_variable_pay_attribution
CREATE POLICY "dvpa_admin" ON public.deal_variable_pay_attribution FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "dvpa_exec" ON public.deal_variable_pay_attribution FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "dvpa_fin" ON public.deal_variable_pay_attribution FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "dvpa_gtm" ON public.deal_variable_pay_attribution FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "dvpa_sh" ON public.deal_variable_pay_attribution FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_head'));
CREATE POLICY "dvpa_sr" ON public.deal_variable_pay_attribution FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_rep') AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.employee_id IS NOT NULL AND deal_variable_pay_attribution.employee_id = p.employee_id));

-- payout_metric_details
CREATE POLICY "pmd_manage" ON public.payout_metric_details FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance') OR has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "pmd_own_view" ON public.payout_metric_details FOR SELECT TO authenticated USING (employee_id = auth.uid());

-- payout_deal_details
CREATE POLICY "pdd_manage" ON public.payout_deal_details FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance') OR has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "pdd_own_view" ON public.payout_deal_details FOR SELECT TO authenticated USING (employee_id = auth.uid());

-- closing_arr_payout_details
CREATE POLICY "capd_manage" ON public.closing_arr_payout_details FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance') OR has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "capd_own_view" ON public.closing_arr_payout_details FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.employee_id IS NOT NULL AND closing_arr_payout_details.employee_id = p.employee_id));

-- clawback_ledger
CREATE POLICY "cl_manage" ON public.clawback_ledger FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance') OR has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "cl_own_view" ON public.clawback_ledger FOR SELECT TO authenticated USING (employee_id = auth.uid());

-- deal_team_spiff_allocations
CREATE POLICY "dtsa_manage" ON public.deal_team_spiff_allocations FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance') OR has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "dtsa_view" ON public.deal_team_spiff_allocations FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive') OR has_role(auth.uid(), 'sales_head'));

-- deal_team_spiff_config
CREATE POLICY "dtsc_view" ON public.deal_team_spiff_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "dtsc_update" ON public.deal_team_spiff_config FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gtm_ops'));

-- fnf_settlements
CREATE POLICY "fnf_manage" ON public.fnf_settlements FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY(ARRAY['admin','finance','gtm_ops'])));
CREATE POLICY "fnf_view_finalized" ON public.fnf_settlements FOR SELECT TO authenticated USING (tranche1_status = ANY(ARRAY['finalized','paid']));

-- fnf_settlement_lines
CREATE POLICY "fnfl_manage" ON public.fnf_settlement_lines FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY(ARRAY['admin','finance','gtm_ops'])));
CREATE POLICY "fnfl_view_finalized" ON public.fnf_settlement_lines FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM fnf_settlements s WHERE s.id = fnf_settlement_lines.settlement_id AND s.tranche1_status = ANY(ARRAY['finalized','paid'])));

-- system_audit_log
CREATE POLICY "sal_view" ON public.system_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance') OR has_role(auth.uid(), 'gtm_ops') OR has_role(auth.uid(), 'executive'));
CREATE POLICY "sal_insert" ON public.system_audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- employee_change_log
CREATE POLICY "Authenticated users can read employee change log" ON public.employee_change_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert employee change log" ON public.employee_change_log FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- PART 12: INDEXES
-- ============================================================

CREATE INDEX idx_performance_targets_employee ON public.performance_targets(employee_id);
CREATE INDEX idx_performance_targets_metric ON public.performance_targets(metric_type);
CREATE INDEX idx_deals_month_year ON public.deals(month_year);
CREATE INDEX idx_deals_type_of_proposal ON public.deals(type_of_proposal);
CREATE INDEX idx_deals_status ON public.deals(status);
CREATE INDEX idx_deals_project_id ON public.deals(project_id);
CREATE INDEX idx_deals_se_team_id ON public.deals(sales_engineering_team_id);
CREATE INDEX idx_deals_sm_team_id ON public.deals(solution_manager_team_id);
CREATE INDEX idx_deal_participants_deal_id ON public.deal_participants(deal_id);
CREATE INDEX idx_deal_participants_employee_id ON public.deal_participants(employee_id);
CREATE INDEX idx_deal_audit_log_deal_id ON public.deal_audit_log(deal_id);
CREATE INDEX idx_deal_audit_log_changed_at ON public.deal_audit_log(changed_at DESC);
CREATE INDEX idx_closing_arr_actuals_month ON public.closing_arr_actuals(month_year);
CREATE INDEX idx_closing_arr_actuals_pid ON public.closing_arr_actuals(pid);
CREATE INDEX idx_closing_arr_actuals_sales_rep ON public.closing_arr_actuals(sales_rep_employee_id);
CREATE INDEX idx_deal_collections_booking_month ON public.deal_collections(booking_month);
CREATE INDEX idx_deal_collections_is_collected ON public.deal_collections(is_collected);
CREATE INDEX idx_deal_collections_is_clawback ON public.deal_collections(is_clawback_triggered);
CREATE INDEX idx_deal_collections_collection_month ON public.deal_collections(collection_month);
CREATE INDEX idx_monthly_payouts_deal_id ON public.monthly_payouts(deal_id);
CREATE INDEX idx_monthly_payouts_plan_id ON public.monthly_payouts(plan_id);
CREATE INDEX idx_monthly_payouts_approval_status ON public.monthly_payouts(approval_status);
CREATE INDEX idx_monthly_payouts_payout_run_id ON public.monthly_payouts(payout_run_id);
CREATE INDEX idx_payout_audit_log_payout_id ON public.payout_audit_log(payout_id);
CREATE INDEX idx_payout_audit_log_changed_at ON public.payout_audit_log(changed_at);
CREATE INDEX idx_payout_audit_log_action ON public.payout_audit_log(action);
CREATE INDEX idx_payout_audit_log_category ON public.payout_audit_log(audit_category);
CREATE INDEX idx_payout_audit_log_month ON public.payout_audit_log(month_year);
CREATE INDEX idx_payout_runs_month_year ON public.payout_runs(month_year);
CREATE INDEX idx_payout_runs_status ON public.payout_runs(run_status);
CREATE INDEX idx_payout_runs_is_locked ON public.payout_runs(is_locked);
CREATE INDEX idx_deal_vp_attribution_employee ON public.deal_variable_pay_attribution(employee_id, fiscal_year);
CREATE INDEX idx_deal_vp_attribution_deal ON public.deal_variable_pay_attribution(deal_id);
CREATE INDEX idx_deal_vp_attribution_month ON public.deal_variable_pay_attribution(calculation_month);
CREATE INDEX idx_deal_vp_attribution_payout_run_id ON public.deal_variable_pay_attribution(payout_run_id);
CREATE INDEX idx_payout_adjustments_payout_run_id ON public.payout_adjustments(payout_run_id);
CREATE INDEX idx_payout_adjustments_employee_id ON public.payout_adjustments(employee_id);
CREATE INDEX idx_payout_adjustments_status ON public.payout_adjustments(status);
CREATE INDEX idx_payout_metric_details_run ON public.payout_metric_details(payout_run_id);
CREATE INDEX idx_payout_metric_details_employee ON public.payout_metric_details(employee_id);
CREATE INDEX idx_payout_deal_details_run ON public.payout_deal_details(payout_run_id);
CREATE INDEX idx_payout_deal_details_employee ON public.payout_deal_details(employee_id);
CREATE INDEX idx_payout_deal_details_deal ON public.payout_deal_details(deal_id);
CREATE INDEX idx_capd_payout_run ON public.closing_arr_payout_details(payout_run_id);
CREATE INDEX idx_capd_employee ON public.closing_arr_payout_details(employee_id);
CREATE INDEX idx_clawback_ledger_employee_status ON public.clawback_ledger(employee_id, status);
CREATE INDEX idx_clawback_ledger_deal_collection ON public.clawback_ledger(deal_collection_id);
CREATE INDEX idx_support_team_members_team_id ON public.support_team_members(team_id);
CREATE INDEX idx_support_team_members_employee_id ON public.support_team_members(employee_id);
CREATE INDEX idx_support_teams_role ON public.support_teams(team_role);
CREATE INDEX idx_system_audit_log_table_changed_at ON public.system_audit_log(table_name, changed_at DESC);
CREATE INDEX idx_system_audit_log_changed_by ON public.system_audit_log(changed_by);
CREATE INDEX idx_system_audit_log_record_id ON public.system_audit_log(record_id);
CREATE INDEX idx_employee_change_log_employee_id ON public.employee_change_log(employee_id);
CREATE INDEX idx_employee_change_log_effective_date ON public.employee_change_log(effective_date);
CREATE INDEX idx_comp_plans_effective_year ON public.comp_plans(effective_year);

-- ============================================================
-- PART 13: SEED DATA
-- ============================================================

-- Seed roles
INSERT INTO public.roles (name, label, description, color, is_system_role) VALUES
  ('admin', 'Admin', 'Full system access', 'red', true),
  ('gtm_ops', 'GTM Ops', 'Data operations and plan configuration', 'blue', true),
  ('finance', 'Finance', 'Financial verification and reporting', 'green', true),
  ('executive', 'Executive', 'View-only dashboards across all teams', 'purple', true),
  ('sales_head', 'Sales Head', 'Own team visibility and management', 'orange', true),
  ('sales_rep', 'Sales Rep', 'Personal dashboard access', 'slate', true);

-- Seed currencies
INSERT INTO public.currencies (code, name, symbol) VALUES
  ('USD', 'US Dollar', '$'),
  ('INR', 'Indian Rupee', '₹'),
  ('AED', 'UAE Dirham', 'AED'),
  ('KES', 'Kenyan Shilling', 'KSh'),
  ('NGN', 'Nigerian Naira', '₦'),
  ('SAR', 'Saudi Riyal', '﷼'),
  ('MYR', 'Malaysian Ringgit', 'RM'),
  ('SGD', 'Singapore Dollar', 'S$'),
  ('IDR', 'Indonesian Rupiah', 'Rp'),
  ('LBP', 'Lebanese Pound', 'ل.ل'),
  ('GBP', 'British Pound', '£'),
  ('EUR', 'Euro', '€'),
  ('AUD', 'Australian Dollar', 'A$'),
  ('CAD', 'Canadian Dollar', 'C$'),
  ('PHP', 'Philippine Peso', '₱');

-- Seed sales_functions
INSERT INTO public.sales_functions (name, display_order) VALUES
  ('Farmer', 1), ('Hunter', 2), ('CSM', 3), ('Channel Sales', 4),
  ('Sales Engineering', 5), ('Sales Head - Farmer', 6), ('Sales Head - Hunter', 7),
  ('Farmer - Retain', 8), ('IMAL Product SE', 9), ('Insurance Product SE', 10),
  ('APAC Regional SE', 11), ('MEA Regional SE', 12), ('Sales Engineering - Head', 13),
  ('Team Lead', 14), ('Team Lead - Farmer', 15), ('Team Lead - Hunter', 16),
  ('Overlay', 17), ('Executive', 18);

-- Seed default deal_team_spiff_config
INSERT INTO public.deal_team_spiff_config (spiff_pool_amount_usd, min_deal_arr_usd, is_active, exclude_roles)
VALUES (10000, 400000, true, ARRAY['sales_rep', 'sales_head']);

-- Seed role_permissions (comprehensive permission matrix)
INSERT INTO public.role_permissions (role, permission_key, is_allowed) VALUES
-- Page Access
('admin', 'page:dashboard', true), ('admin', 'page:team_view', true), ('admin', 'page:plan_config', true), ('admin', 'page:reports', true), ('admin', 'page:data_inputs', true),
('gtm_ops', 'page:dashboard', true), ('gtm_ops', 'page:team_view', true), ('gtm_ops', 'page:plan_config', true), ('gtm_ops', 'page:reports', true), ('gtm_ops', 'page:data_inputs', true),
('finance', 'page:dashboard', true), ('finance', 'page:team_view', true), ('finance', 'page:plan_config', true), ('finance', 'page:reports', true), ('finance', 'page:data_inputs', false),
('executive', 'page:dashboard', true), ('executive', 'page:team_view', true), ('executive', 'page:plan_config', true), ('executive', 'page:reports', true), ('executive', 'page:data_inputs', false),
('sales_head', 'page:dashboard', true), ('sales_head', 'page:team_view', true), ('sales_head', 'page:plan_config', false), ('sales_head', 'page:reports', false), ('sales_head', 'page:data_inputs', false),
('sales_rep', 'page:dashboard', true), ('sales_rep', 'page:team_view', false), ('sales_rep', 'page:plan_config', false), ('sales_rep', 'page:reports', false), ('sales_rep', 'page:data_inputs', false),
-- Admin Tabs
('admin', 'tab:employee_accounts', true), ('admin', 'tab:bulk_upload', true), ('admin', 'tab:role_management', true), ('admin', 'tab:permissions', true), ('admin', 'tab:comp_plans', true), ('admin', 'tab:roles', true),
('gtm_ops', 'tab:employee_accounts', true), ('gtm_ops', 'tab:bulk_upload', true), ('gtm_ops', 'tab:role_management', false), ('gtm_ops', 'tab:permissions', false), ('gtm_ops', 'tab:comp_plans', true), ('gtm_ops', 'tab:roles', false),
('finance', 'tab:employee_accounts', false), ('finance', 'tab:bulk_upload', false), ('finance', 'tab:role_management', false), ('finance', 'tab:permissions', false), ('finance', 'tab:comp_plans', true), ('finance', 'tab:roles', false),
('executive', 'tab:employee_accounts', false), ('executive', 'tab:bulk_upload', false), ('executive', 'tab:role_management', false), ('executive', 'tab:permissions', false), ('executive', 'tab:comp_plans', true), ('executive', 'tab:roles', false),
('sales_head', 'tab:employee_accounts', false), ('sales_head', 'tab:bulk_upload', false), ('sales_head', 'tab:role_management', false), ('sales_head', 'tab:permissions', false), ('sales_head', 'tab:comp_plans', false), ('sales_head', 'tab:roles', false),
('sales_rep', 'tab:employee_accounts', false), ('sales_rep', 'tab:bulk_upload', false), ('sales_rep', 'tab:role_management', false), ('sales_rep', 'tab:permissions', false), ('sales_rep', 'tab:comp_plans', false), ('sales_rep', 'tab:roles', false),
-- Actions
('admin', 'action:create_comp_plan', true), ('admin', 'action:edit_comp_plan', true), ('admin', 'action:delete_comp_plan', true), ('admin', 'action:create_employee', true), ('admin', 'action:edit_employee', true), ('admin', 'action:deactivate_employee', true), ('admin', 'action:create_auth_account', true), ('admin', 'action:manage_roles', true), ('admin', 'action:upload_data', true), ('admin', 'action:edit_actuals', true), ('admin', 'action:edit_exchange_rates', true), ('admin', 'action:export_reports', true),
('gtm_ops', 'action:create_comp_plan', false), ('gtm_ops', 'action:edit_comp_plan', true), ('gtm_ops', 'action:delete_comp_plan', false), ('gtm_ops', 'action:create_employee', true), ('gtm_ops', 'action:edit_employee', true), ('gtm_ops', 'action:deactivate_employee', true), ('gtm_ops', 'action:create_auth_account', true), ('gtm_ops', 'action:manage_roles', false), ('gtm_ops', 'action:upload_data', true), ('gtm_ops', 'action:edit_actuals', true), ('gtm_ops', 'action:edit_exchange_rates', true), ('gtm_ops', 'action:export_reports', true),
('finance', 'action:create_comp_plan', false), ('finance', 'action:edit_comp_plan', false), ('finance', 'action:delete_comp_plan', false), ('finance', 'action:create_employee', false), ('finance', 'action:edit_employee', false), ('finance', 'action:deactivate_employee', false), ('finance', 'action:create_auth_account', false), ('finance', 'action:manage_roles', false), ('finance', 'action:upload_data', false), ('finance', 'action:edit_actuals', false), ('finance', 'action:edit_exchange_rates', false), ('finance', 'action:export_reports', true),
('executive', 'action:create_comp_plan', false), ('executive', 'action:edit_comp_plan', false), ('executive', 'action:delete_comp_plan', false), ('executive', 'action:create_employee', false), ('executive', 'action:edit_employee', false), ('executive', 'action:deactivate_employee', false), ('executive', 'action:create_auth_account', false), ('executive', 'action:manage_roles', false), ('executive', 'action:upload_data', false), ('executive', 'action:edit_actuals', false), ('executive', 'action:edit_exchange_rates', false), ('executive', 'action:export_reports', true),
('sales_head', 'action:create_comp_plan', false), ('sales_head', 'action:edit_comp_plan', false), ('sales_head', 'action:delete_comp_plan', false), ('sales_head', 'action:create_employee', false), ('sales_head', 'action:edit_employee', false), ('sales_head', 'action:deactivate_employee', false), ('sales_head', 'action:create_auth_account', false), ('sales_head', 'action:manage_roles', false), ('sales_head', 'action:upload_data', false), ('sales_head', 'action:edit_actuals', false), ('sales_head', 'action:edit_exchange_rates', false), ('sales_head', 'action:export_reports', false),
('sales_rep', 'action:create_comp_plan', false), ('sales_rep', 'action:edit_comp_plan', false), ('sales_rep', 'action:delete_comp_plan', false), ('sales_rep', 'action:create_employee', false), ('sales_rep', 'action:edit_employee', false), ('sales_rep', 'action:deactivate_employee', false), ('sales_rep', 'action:create_auth_account', false), ('sales_rep', 'action:manage_roles', false), ('sales_rep', 'action:upload_data', false), ('sales_rep', 'action:edit_actuals', false), ('sales_rep', 'action:edit_exchange_rates', false), ('sales_rep', 'action:export_reports', false),
-- Feature tabs
('admin', 'tab:deal_team_spiffs', true), ('finance', 'tab:deal_team_spiffs', true), ('gtm_ops', 'tab:deal_team_spiffs', true),
('admin', 'action:allocate_deal_spiff', true), ('finance', 'action:allocate_deal_spiff', true), ('gtm_ops', 'action:allocate_deal_spiff', true),
('admin', 'action:approve_deal_spiff', true),
('admin', 'tab:support_teams', true), ('finance', 'tab:support_teams', true), ('gtm_ops', 'tab:support_teams', true),
('executive', 'tab:support_teams', false), ('sales_head', 'tab:support_teams', false), ('sales_rep', 'tab:support_teams', false),
('admin', 'tab:fnf_settlements', true), ('finance', 'tab:fnf_settlements', true), ('gtm_ops', 'tab:fnf_settlements', true),
('executive', 'tab:fnf_settlements', false), ('sales_head', 'tab:fnf_settlements', false), ('sales_rep', 'tab:fnf_settlements', false),
('admin', 'page:executive_dashboard', true), ('executive', 'page:executive_dashboard', true),
('gtm_ops', 'page:executive_dashboard', false), ('finance', 'page:executive_dashboard', false), ('sales_head', 'page:executive_dashboard', false), ('sales_rep', 'page:executive_dashboard', false),
('admin', 'tab:sales_functions', true), ('gtm_ops', 'tab:sales_functions', false), ('finance', 'tab:sales_functions', false),
('executive', 'tab:sales_functions', false), ('sales_head', 'tab:sales_functions', false), ('sales_rep', 'tab:sales_functions', false)
ON CONFLICT (role, permission_key) DO NOTHING;

-- ============================================================
-- DONE! 
-- After running this, create your first admin user via the Auth UI,
-- then insert their role:
-- INSERT INTO public.user_roles (user_id, role) VALUES ('<user-uuid>', 'admin');
-- ============================================================
