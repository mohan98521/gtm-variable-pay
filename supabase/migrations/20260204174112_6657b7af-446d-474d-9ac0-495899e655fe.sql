-- Phase 1: Database Schema Enhancements for Monthly Payout Process

-- 1. Add compensation_exchange_rate to employees table
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS compensation_exchange_rate numeric DEFAULT 1;

COMMENT ON COLUMN public.employees.compensation_exchange_rate IS 'Fixed exchange rate derived from OTE LC/USD, used for Variable Pay conversions';

-- 2. Create function to auto-calculate compensation exchange rate
CREATE OR REPLACE FUNCTION public.calculate_compensation_exchange_rate()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate rate when OTE values are provided
  IF NEW.ote_usd IS NOT NULL AND NEW.ote_usd > 0 
     AND NEW.ote_local_currency IS NOT NULL THEN
    NEW.compensation_exchange_rate := 
      ROUND((NEW.ote_local_currency / NEW.ote_usd)::numeric, 4);
  ELSE
    -- Default to 1 for USD employees or when data missing
    NEW.compensation_exchange_rate := 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. Create trigger to auto-set compensation exchange rate
DROP TRIGGER IF EXISTS set_compensation_exchange_rate ON public.employees;
CREATE TRIGGER set_compensation_exchange_rate
  BEFORE INSERT OR UPDATE OF ote_usd, ote_local_currency ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_compensation_exchange_rate();

-- 4. Backfill existing employees with calculated rates
UPDATE public.employees
SET compensation_exchange_rate = 
  CASE 
    WHEN ote_usd > 0 AND ote_local_currency IS NOT NULL 
    THEN ROUND((ote_local_currency / ote_usd)::numeric, 4)
    ELSE 1
  END
WHERE compensation_exchange_rate IS NULL OR compensation_exchange_rate = 1;

-- 5. Create payout_runs table - Master record for each monthly payout cycle
CREATE TABLE IF NOT EXISTS public.payout_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_year date NOT NULL,
  run_status text NOT NULL DEFAULT 'draft' CHECK (run_status IN ('draft', 'calculating', 'review', 'approved', 'finalized', 'paid')),
  calculated_by uuid REFERENCES auth.users(id),
  calculated_at timestamp with time zone,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamp with time zone,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamp with time zone,
  finalized_by uuid REFERENCES auth.users(id),
  finalized_at timestamp with time zone,
  is_locked boolean NOT NULL DEFAULT false,
  total_payout_usd numeric DEFAULT 0,
  total_variable_pay_usd numeric DEFAULT 0,
  total_commissions_usd numeric DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(month_year)
);

-- Enable RLS on payout_runs
ALTER TABLE public.payout_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for payout_runs
CREATE POLICY "Admin and GTM Ops can manage payout runs"
ON public.payout_runs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'gtm_ops', 'finance')
  )
);

CREATE POLICY "Employees can view finalized payout runs"
ON public.payout_runs
FOR SELECT
USING (run_status IN ('finalized', 'paid'));

-- 6. Add local currency columns to monthly_payouts
ALTER TABLE public.monthly_payouts
ADD COLUMN IF NOT EXISTS payout_run_id uuid REFERENCES public.payout_runs(id),
ADD COLUMN IF NOT EXISTS calculated_amount_local numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_amount_local numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS booking_amount_local numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS collection_amount_local numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS holdback_amount_local numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS year_end_amount_usd numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS year_end_amount_local numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS clawback_amount_local numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS local_currency text DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS exchange_rate_used numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS exchange_rate_type text DEFAULT 'compensation' CHECK (exchange_rate_type IN ('compensation', 'market'));

-- 7. Add local currency columns to deal_variable_pay_attribution
ALTER TABLE public.deal_variable_pay_attribution
ADD COLUMN IF NOT EXISTS payout_run_id uuid REFERENCES public.payout_runs(id),
ADD COLUMN IF NOT EXISTS local_currency text DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS compensation_exchange_rate numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS variable_pay_split_local numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS payout_on_booking_local numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS payout_on_collection_local numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS payout_on_year_end_local numeric DEFAULT 0;

-- 8. Create payout_adjustments table - For post-lock corrections
CREATE TABLE IF NOT EXISTS public.payout_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payout_run_id uuid NOT NULL REFERENCES public.payout_runs(id),
  employee_id text NOT NULL,
  original_amount_usd numeric NOT NULL DEFAULT 0,
  adjustment_amount_usd numeric NOT NULL DEFAULT 0,
  original_amount_local numeric NOT NULL DEFAULT 0,
  adjustment_amount_local numeric NOT NULL DEFAULT 0,
  local_currency text NOT NULL DEFAULT 'USD',
  exchange_rate_used numeric NOT NULL DEFAULT 1,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('correction', 'clawback_reversal', 'manual_override')),
  reason text NOT NULL,
  supporting_documents jsonb,
  requested_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  applied_to_month date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on payout_adjustments
ALTER TABLE public.payout_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS policies for payout_adjustments
CREATE POLICY "Admin and Finance can manage adjustments"
ON public.payout_adjustments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'finance', 'gtm_ops')
  )
);

-- 9. Create month-lock check function
CREATE OR REPLACE FUNCTION public.check_month_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_is_locked BOOLEAN;
  v_month_year date;
BEGIN
  -- Determine the month to check
  IF TG_OP = 'DELETE' THEN
    v_month_year := date_trunc('month', OLD.month_year)::date;
  ELSE
    v_month_year := date_trunc('month', NEW.month_year)::date;
  END IF;
  
  -- Check if the month is locked
  SELECT is_locked INTO v_is_locked
  FROM public.payout_runs
  WHERE month_year = v_month_year
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_is_locked = TRUE THEN
    RAISE EXCEPTION 'Cannot modify data for locked payout month: %. Use payout adjustments for corrections.', v_month_year;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 10. Apply month-lock trigger to deals table
DROP TRIGGER IF EXISTS check_deals_month_lock ON public.deals;
CREATE TRIGGER check_deals_month_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.check_month_lock();

-- 11. Create function to check month lock for deal_collections
CREATE OR REPLACE FUNCTION public.check_collection_month_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_is_locked BOOLEAN;
  v_month_year date;
BEGIN
  -- Get booking month from deal_collections
  v_month_year := date_trunc('month', NEW.booking_month)::date;
  
  -- Check if the month is locked
  SELECT is_locked INTO v_is_locked
  FROM public.payout_runs
  WHERE month_year = v_month_year
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_is_locked = TRUE THEN
    RAISE EXCEPTION 'Cannot modify collection for locked payout month: %. Use payout adjustments for corrections.', v_month_year;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 12. Apply month-lock trigger to deal_collections table
DROP TRIGGER IF EXISTS check_collections_month_lock ON public.deal_collections;
CREATE TRIGGER check_collections_month_lock
  BEFORE UPDATE ON public.deal_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.check_collection_month_lock();

-- 13. Add updated_at trigger to payout_runs
CREATE TRIGGER update_payout_runs_updated_at
  BEFORE UPDATE ON public.payout_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 14. Add updated_at trigger to payout_adjustments
CREATE TRIGGER update_payout_adjustments_updated_at
  BEFORE UPDATE ON public.payout_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 15. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payout_runs_month_year ON public.payout_runs(month_year);
CREATE INDEX IF NOT EXISTS idx_payout_runs_status ON public.payout_runs(run_status);
CREATE INDEX IF NOT EXISTS idx_payout_runs_is_locked ON public.payout_runs(is_locked);
CREATE INDEX IF NOT EXISTS idx_monthly_payouts_payout_run_id ON public.monthly_payouts(payout_run_id);
CREATE INDEX IF NOT EXISTS idx_deal_vp_attribution_payout_run_id ON public.deal_variable_pay_attribution(payout_run_id);
CREATE INDEX IF NOT EXISTS idx_payout_adjustments_payout_run_id ON public.payout_adjustments(payout_run_id);
CREATE INDEX IF NOT EXISTS idx_payout_adjustments_employee_id ON public.payout_adjustments(employee_id);
CREATE INDEX IF NOT EXISTS idx_payout_adjustments_status ON public.payout_adjustments(status);

-- 16. Enhance payout_audit_log with additional columns
ALTER TABLE public.payout_audit_log
ADD COLUMN IF NOT EXISTS payout_run_id uuid REFERENCES public.payout_runs(id),
ADD COLUMN IF NOT EXISTS month_year date,
ADD COLUMN IF NOT EXISTS employee_id text,
ADD COLUMN IF NOT EXISTS amount_usd numeric,
ADD COLUMN IF NOT EXISTS amount_local numeric,
ADD COLUMN IF NOT EXISTS local_currency text,
ADD COLUMN IF NOT EXISTS exchange_rate_used numeric,
ADD COLUMN IF NOT EXISTS action_type text;