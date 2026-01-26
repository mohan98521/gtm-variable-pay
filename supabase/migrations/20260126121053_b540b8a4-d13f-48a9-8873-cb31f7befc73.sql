
-- Phase 1: Complete Deals Schema Redesign
-- Drop existing tables in order (respecting foreign keys)
DROP TRIGGER IF EXISTS log_deal_changes_trigger ON deals;
DROP TABLE IF EXISTS deal_audit_log CASCADE;
DROP TABLE IF EXISTS deal_participants CASCADE;
DROP TABLE IF EXISTS deals CASCADE;

-- Create new deals table with comprehensive schema
CREATE TABLE public.deals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id text NOT NULL,
  customer_code text NOT NULL,
  region text NOT NULL,
  country text NOT NULL,
  bu text NOT NULL,
  product text NOT NULL,
  type_of_proposal text NOT NULL,
  gp_margin_percent numeric,
  month_year date NOT NULL,
  first_year_amc_usd numeric DEFAULT 0,
  first_year_subscription_usd numeric DEFAULT 0,
  new_software_booking_arr_usd numeric GENERATED ALWAYS AS (COALESCE(first_year_amc_usd, 0) + COALESCE(first_year_subscription_usd, 0)) STORED,
  managed_services_usd numeric DEFAULT 0,
  implementation_usd numeric DEFAULT 0,
  cr_usd numeric DEFAULT 0,
  er_usd numeric DEFAULT 0,
  tcv_usd numeric DEFAULT 0,
  sales_rep_employee_id text,
  sales_rep_name text,
  sales_head_employee_id text,
  sales_head_name text,
  sales_engineering_employee_id text,
  sales_engineering_name text,
  sales_engineering_head_employee_id text,
  sales_engineering_head_name text,
  channel_sales_employee_id text,
  channel_sales_name text,
  product_specialist_employee_id text,
  product_specialist_name text,
  linked_to_impl boolean DEFAULT false,
  eligible_for_perpetual_incentive boolean DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create new deal_participants table
CREATE TABLE public.deal_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  employee_id text NOT NULL,
  participant_role text NOT NULL,
  split_percent numeric NOT NULL DEFAULT 100,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create new deal_audit_log table
CREATE TABLE public.deal_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  action text NOT NULL,
  changed_by uuid,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  old_values jsonb,
  new_values jsonb,
  is_retroactive boolean NOT NULL DEFAULT false,
  period_month date,
  reason text
);

-- Enable RLS on all tables
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deals table
CREATE POLICY "Admins can manage deals" ON public.deals FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "GTM Ops can manage deals" ON public.deals FOR ALL USING (has_role(auth.uid(), 'gtm_ops'::app_role));
CREATE POLICY "Finance can view deals" ON public.deals FOR SELECT USING (has_role(auth.uid(), 'finance'::app_role));
CREATE POLICY "Sales head can view deals" ON public.deals FOR SELECT USING (has_role(auth.uid(), 'sales_head'::app_role));
CREATE POLICY "Executive can view deals" ON public.deals FOR SELECT USING (has_role(auth.uid(), 'executive'::app_role));

-- RLS Policies for deal_participants table
CREATE POLICY "Admins can manage deal_participants" ON public.deal_participants FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "GTM Ops can manage deal_participants" ON public.deal_participants FOR ALL USING (has_role(auth.uid(), 'gtm_ops'::app_role));
CREATE POLICY "Finance can view deal_participants" ON public.deal_participants FOR SELECT USING (has_role(auth.uid(), 'finance'::app_role));
CREATE POLICY "Sales head can view deal_participants" ON public.deal_participants FOR SELECT USING (has_role(auth.uid(), 'sales_head'::app_role));
CREATE POLICY "Executive can view deal_participants" ON public.deal_participants FOR SELECT USING (has_role(auth.uid(), 'executive'::app_role));

-- RLS Policies for deal_audit_log table
CREATE POLICY "Admins can view audit logs" ON public.deal_audit_log FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "GTM Ops can view audit logs" ON public.deal_audit_log FOR SELECT USING (has_role(auth.uid(), 'gtm_ops'::app_role));
CREATE POLICY "Finance can view audit logs" ON public.deal_audit_log FOR SELECT USING (has_role(auth.uid(), 'finance'::app_role));
CREATE POLICY "Executive can view audit logs" ON public.deal_audit_log FOR SELECT USING (has_role(auth.uid(), 'executive'::app_role));
CREATE POLICY "System can insert audit logs" ON public.deal_audit_log FOR INSERT WITH CHECK (true);

-- Create updated_at trigger for deals
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Recreate the audit logging trigger function
CREATE OR REPLACE FUNCTION public.log_deal_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_period date;
  is_retro boolean;
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
END;
$function$;

-- Create the audit trigger on deals table
CREATE TRIGGER log_deal_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_deal_changes();

-- Create indexes for performance
CREATE INDEX idx_deals_month_year ON public.deals(month_year);
CREATE INDEX idx_deals_type_of_proposal ON public.deals(type_of_proposal);
CREATE INDEX idx_deals_status ON public.deals(status);
CREATE INDEX idx_deals_project_id ON public.deals(project_id);
CREATE INDEX idx_deal_participants_deal_id ON public.deal_participants(deal_id);
CREATE INDEX idx_deal_participants_employee_id ON public.deal_participants(employee_id);
