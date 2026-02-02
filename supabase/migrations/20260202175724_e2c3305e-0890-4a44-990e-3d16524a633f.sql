-- =====================================================
-- PAYOUT STRUCTURE REDESIGN - COMPREHENSIVE MIGRATION
-- =====================================================

-- 1. Add payout configuration to comp_plans
ALTER TABLE public.comp_plans 
ADD COLUMN IF NOT EXISTS payout_frequency text DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS clawback_period_days integer DEFAULT 180;

-- Add check constraint for valid payout frequencies
ALTER TABLE public.comp_plans 
ADD CONSTRAINT valid_payout_frequency 
CHECK (payout_frequency IN ('monthly', 'quarterly', 'half_yearly', 'annual'));

-- 2. Add payout split to plan_metrics
ALTER TABLE public.plan_metrics 
ADD COLUMN IF NOT EXISTS payout_on_booking_pct numeric DEFAULT 75,
ADD COLUMN IF NOT EXISTS payout_on_collection_pct numeric DEFAULT 25;

-- Add check constraint for valid payout splits (must sum to 100)
ALTER TABLE public.plan_metrics 
ADD CONSTRAINT valid_metric_payout_split 
CHECK (payout_on_booking_pct + payout_on_collection_pct = 100);

-- 3. Add payout split to plan_commissions
ALTER TABLE public.plan_commissions 
ADD COLUMN IF NOT EXISTS payout_on_booking_pct numeric DEFAULT 75,
ADD COLUMN IF NOT EXISTS payout_on_collection_pct numeric DEFAULT 25;

-- Add check constraint for valid payout splits (must sum to 100)
ALTER TABLE public.plan_commissions 
ADD CONSTRAINT valid_commission_payout_split 
CHECK (payout_on_booking_pct + payout_on_collection_pct = 100);

-- 4. Create deal_collections table for tracking collection status
CREATE TABLE IF NOT EXISTS public.deal_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  booking_month date NOT NULL,
  project_id text NOT NULL,
  customer_name text,
  deal_value_usd numeric NOT NULL DEFAULT 0,
  is_collected boolean DEFAULT false,
  collection_date date,
  collection_amount_usd numeric,
  first_milestone_due_date date,
  is_clawback_triggered boolean DEFAULT false,
  clawback_amount_usd numeric DEFAULT 0,
  clawback_triggered_at timestamptz,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate entries per deal
ALTER TABLE public.deal_collections 
ADD CONSTRAINT unique_deal_collection UNIQUE (deal_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_deal_collections_booking_month ON public.deal_collections(booking_month);
CREATE INDEX IF NOT EXISTS idx_deal_collections_is_collected ON public.deal_collections(is_collected);
CREATE INDEX IF NOT EXISTS idx_deal_collections_is_clawback ON public.deal_collections(is_clawback_triggered);

-- Enable RLS on deal_collections
ALTER TABLE public.deal_collections ENABLE ROW LEVEL SECURITY;

-- RLS policies for deal_collections
CREATE POLICY "Admins can manage deal_collections" 
ON public.deal_collections FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "GTM Ops can manage deal_collections" 
ON public.deal_collections FOR ALL 
USING (has_role(auth.uid(), 'gtm_ops'::app_role));

CREATE POLICY "Finance can manage deal_collections" 
ON public.deal_collections FOR ALL 
USING (has_role(auth.uid(), 'finance'::app_role));

CREATE POLICY "Executive can view deal_collections" 
ON public.deal_collections FOR SELECT 
USING (has_role(auth.uid(), 'executive'::app_role));

CREATE POLICY "Sales head can view deal_collections" 
ON public.deal_collections FOR SELECT 
USING (has_role(auth.uid(), 'sales_head'::app_role));

-- 5. Enhance monthly_payouts table with new columns
ALTER TABLE public.monthly_payouts 
ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.deals(id),
ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.comp_plans(id),
ADD COLUMN IF NOT EXISTS metric_id uuid REFERENCES public.plan_metrics(id),
ADD COLUMN IF NOT EXISTS commission_id uuid REFERENCES public.plan_commissions(id),
ADD COLUMN IF NOT EXISTS booking_amount_usd numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS collection_amount_usd numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS clawback_amount_usd numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS approved_by uuid,
ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Add check constraint for valid approval statuses
ALTER TABLE public.monthly_payouts 
ADD CONSTRAINT valid_approval_status 
CHECK (approval_status IN ('pending', 'approved', 'rejected', 'paid', 'held', 'released', 'clawback'));

-- Create indexes for monthly_payouts
CREATE INDEX IF NOT EXISTS idx_monthly_payouts_deal_id ON public.monthly_payouts(deal_id);
CREATE INDEX IF NOT EXISTS idx_monthly_payouts_plan_id ON public.monthly_payouts(plan_id);
CREATE INDEX IF NOT EXISTS idx_monthly_payouts_approval_status ON public.monthly_payouts(approval_status);

-- 6. Create payout_audit_log table for tracking all payout changes
CREATE TABLE IF NOT EXISTS public.payout_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id uuid REFERENCES public.monthly_payouts(id) ON DELETE SET NULL,
  deal_collection_id uuid REFERENCES public.deal_collections(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'payout',
  old_values jsonb,
  new_values jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

-- Create indexes for payout_audit_log
CREATE INDEX IF NOT EXISTS idx_payout_audit_log_payout_id ON public.payout_audit_log(payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_audit_log_changed_at ON public.payout_audit_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_payout_audit_log_action ON public.payout_audit_log(action);

-- Enable RLS on payout_audit_log
ALTER TABLE public.payout_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for payout_audit_log
CREATE POLICY "Admins can view payout_audit_log" 
ON public.payout_audit_log FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "GTM Ops can view payout_audit_log" 
ON public.payout_audit_log FOR SELECT 
USING (has_role(auth.uid(), 'gtm_ops'::app_role));

CREATE POLICY "Finance can view payout_audit_log" 
ON public.payout_audit_log FOR SELECT 
USING (has_role(auth.uid(), 'finance'::app_role));

CREATE POLICY "Executive can view payout_audit_log" 
ON public.payout_audit_log FOR SELECT 
USING (has_role(auth.uid(), 'executive'::app_role));

CREATE POLICY "System can insert payout_audit_log" 
ON public.payout_audit_log FOR INSERT 
WITH CHECK (true);

-- 7. Create trigger to auto-update updated_at on deal_collections
CREATE OR REPLACE FUNCTION public.update_deal_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_update_deal_collections_updated_at
BEFORE UPDATE ON public.deal_collections
FOR EACH ROW
EXECUTE FUNCTION public.update_deal_collections_updated_at();

-- 8. Create function to auto-create deal_collections from deals
CREATE OR REPLACE FUNCTION public.auto_create_deal_collection()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.deal_collections (
    deal_id,
    booking_month,
    project_id,
    customer_name,
    deal_value_usd,
    is_collected,
    first_milestone_due_date
  ) VALUES (
    NEW.id,
    NEW.month_year,
    NEW.project_id,
    NEW.customer_name,
    COALESCE(NEW.tcv_usd, 0),
    false,
    (date_trunc('month', NEW.month_year) + interval '1 month' - interval '1 day' + interval '180 days')::date
  )
  ON CONFLICT (deal_id) DO UPDATE SET
    booking_month = EXCLUDED.booking_month,
    project_id = EXCLUDED.project_id,
    customer_name = EXCLUDED.customer_name,
    deal_value_usd = EXCLUDED.deal_value_usd,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_auto_create_deal_collection
AFTER INSERT OR UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_deal_collection();

-- 9. Create function to log payout changes
CREATE OR REPLACE FUNCTION public.log_payout_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payout_audit_log (payout_id, action, entity_type, new_values, changed_by)
    VALUES (NEW.id, 'created', 'payout', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.payout_audit_log (payout_id, action, entity_type, old_values, new_values, changed_by)
    VALUES (NEW.id, 'updated', 'payout', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.payout_audit_log (payout_id, action, entity_type, old_values, changed_by)
    VALUES (OLD.id, 'deleted', 'payout', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_log_payout_change
AFTER INSERT OR UPDATE OR DELETE ON public.monthly_payouts
FOR EACH ROW
EXECUTE FUNCTION public.log_payout_change();

-- 10. Create function to log collection changes
CREATE OR REPLACE FUNCTION public.log_collection_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payout_audit_log (deal_collection_id, action, entity_type, new_values, changed_by)
    VALUES (NEW.id, 'created', 'collection', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.payout_audit_log (deal_collection_id, action, entity_type, old_values, new_values, changed_by)
    VALUES (NEW.id, 'updated', 'collection', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_log_collection_change
AFTER INSERT OR UPDATE ON public.deal_collections
FOR EACH ROW
EXECUTE FUNCTION public.log_collection_change();