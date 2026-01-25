-- Add business_unit column to deals table
ALTER TABLE public.deals ADD COLUMN business_unit text;

-- Create deal_audit_log table for comprehensive audit trail
CREATE TABLE public.deal_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_values jsonb,
  new_values jsonb,
  reason text,
  is_retroactive boolean NOT NULL DEFAULT false,
  period_month date
);

-- Create index for efficient querying
CREATE INDEX idx_deal_audit_log_deal_id ON public.deal_audit_log(deal_id);
CREATE INDEX idx_deal_audit_log_changed_at ON public.deal_audit_log(changed_at DESC);

-- Enable RLS on audit log
ALTER TABLE public.deal_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit log (read-only for most, write via trigger)
CREATE POLICY "Admins can view audit logs"
  ON public.deal_audit_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "GTM Ops can view audit logs"
  ON public.deal_audit_log FOR SELECT
  USING (has_role(auth.uid(), 'gtm_ops'::app_role));

CREATE POLICY "Finance can view audit logs"
  ON public.deal_audit_log FOR SELECT
  USING (has_role(auth.uid(), 'finance'::app_role));

CREATE POLICY "Executive can view audit logs"
  ON public.deal_audit_log FOR SELECT
  USING (has_role(auth.uid(), 'executive'::app_role));

-- Allow service role to insert audit logs
CREATE POLICY "System can insert audit logs"
  ON public.deal_audit_log FOR INSERT
  WITH CHECK (true);

-- Create the audit trigger function
CREATE OR REPLACE FUNCTION public.log_deal_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_period date;
  is_retro boolean;
BEGIN
  -- Determine current period (first day of current month)
  current_period := date_trunc('month', CURRENT_DATE)::date;
  
  IF TG_OP = 'INSERT' THEN
    -- Check if inserting data for a past period
    is_retro := NEW.month_year < current_period;
    
    INSERT INTO public.deal_audit_log (deal_id, action, changed_by, old_values, new_values, is_retroactive, period_month)
    VALUES (NEW.id, 'CREATE', auth.uid(), NULL, to_jsonb(NEW), is_retro, NEW.month_year);
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if the deal's period is in the past
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach the trigger to deals table
CREATE TRIGGER deal_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.log_deal_changes();