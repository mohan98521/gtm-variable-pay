
-- ============================================================
-- Phase 1: system_audit_log table + reusable trigger function
-- ============================================================

-- 1. Create the unified system_audit_log table
CREATE TABLE public.system_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_retroactive BOOLEAN NOT NULL DEFAULT false,
  reason TEXT
);

-- 2. Indexes for performance
CREATE INDEX idx_system_audit_log_table_changed_at ON public.system_audit_log (table_name, changed_at DESC);
CREATE INDEX idx_system_audit_log_changed_by ON public.system_audit_log (changed_by);
CREATE INDEX idx_system_audit_log_record_id ON public.system_audit_log (record_id);

-- 3. Enable RLS
ALTER TABLE public.system_audit_log ENABLE ROW LEVEL SECURITY;

-- 4. RLS policy: viewable by admin, finance, gtm_ops, executive
CREATE POLICY "Audit logs viewable by authorized roles"
  ON public.system_audit_log
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'finance') OR
    public.has_role(auth.uid(), 'gtm_ops') OR
    public.has_role(auth.uid(), 'executive')
  );

-- 5. Insert policy for triggers (SECURITY DEFINER functions insert)
CREATE POLICY "System can insert audit logs"
  ON public.system_audit_log
  FOR INSERT
  WITH CHECK (true);

-- 6. Reusable trigger function
CREATE OR REPLACE FUNCTION public.log_system_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
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
END;
$function$;

-- 7. Attach triggers to all 9 unaudited tables

CREATE TRIGGER audit_employees
  AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_comp_plans
  AFTER INSERT OR UPDATE OR DELETE ON public.comp_plans
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_plan_metrics
  AFTER INSERT OR UPDATE OR DELETE ON public.plan_metrics
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_multiplier_grids
  AFTER INSERT OR UPDATE OR DELETE ON public.multiplier_grids
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_performance_targets
  AFTER INSERT OR UPDATE OR DELETE ON public.performance_targets
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_exchange_rates
  AFTER INSERT OR UPDATE OR DELETE ON public.exchange_rates
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_closing_arr_actuals
  AFTER INSERT OR UPDATE OR DELETE ON public.closing_arr_actuals
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_user_targets
  AFTER INSERT OR UPDATE OR DELETE ON public.user_targets
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
