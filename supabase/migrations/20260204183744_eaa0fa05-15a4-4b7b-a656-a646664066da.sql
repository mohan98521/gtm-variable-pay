-- Extend payout_audit_log for comprehensive tracking
ALTER TABLE public.payout_audit_log
  ADD COLUMN IF NOT EXISTS audit_category text,
  ADD COLUMN IF NOT EXISTS compensation_rate numeric,
  ADD COLUMN IF NOT EXISTS market_rate numeric,
  ADD COLUMN IF NOT EXISTS rate_type text,
  ADD COLUMN IF NOT EXISTS rate_variance_pct numeric,
  ADD COLUMN IF NOT EXISTS is_rate_mismatch boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Create index for efficient audit queries
CREATE INDEX IF NOT EXISTS idx_payout_audit_log_category 
  ON public.payout_audit_log(audit_category);
CREATE INDEX IF NOT EXISTS idx_payout_audit_log_month 
  ON public.payout_audit_log(month_year);
CREATE INDEX IF NOT EXISTS idx_payout_audit_log_changed_at 
  ON public.payout_audit_log(changed_at);

-- Trigger function to log payout run changes
CREATE OR REPLACE FUNCTION public.log_payout_run_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payout_audit_log (
      payout_run_id, action, entity_type, audit_category, 
      new_values, changed_by, month_year
    )
    VALUES (
      NEW.id, 'created', 'payout_run', 'run_lifecycle',
      to_jsonb(NEW), auth.uid(), NEW.month_year
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.run_status IS DISTINCT FROM NEW.run_status THEN
      INSERT INTO public.payout_audit_log (
        payout_run_id, action, entity_type, audit_category,
        old_values, new_values, changed_by, month_year
      )
      VALUES (
        NEW.id, 
        CASE 
          WHEN NEW.run_status = 'finalized' THEN 'finalized'
          WHEN NEW.run_status = 'paid' THEN 'paid'
          ELSE 'status_changed'
        END,
        'payout_run', 'run_lifecycle',
        jsonb_build_object('run_status', OLD.run_status),
        jsonb_build_object('run_status', NEW.run_status),
        auth.uid(), NEW.month_year
      );
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger on payout_runs
DROP TRIGGER IF EXISTS log_payout_run_changes ON public.payout_runs;
CREATE TRIGGER log_payout_run_changes
  AFTER INSERT OR UPDATE ON public.payout_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_payout_run_change();

-- Trigger function to log payout adjustments
CREATE OR REPLACE FUNCTION public.log_adjustment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_month_year date;
BEGIN
  -- Get month from payout run
  SELECT month_year INTO v_month_year
  FROM public.payout_runs
  WHERE id = COALESCE(NEW.payout_run_id, OLD.payout_run_id);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payout_audit_log (
      payout_run_id, action, entity_type, audit_category,
      employee_id, amount_usd, amount_local, local_currency,
      exchange_rate_used, new_values, changed_by, month_year, reason
    )
    VALUES (
      NEW.payout_run_id, 'adjustment_created', 'adjustment', 'adjustment',
      NEW.employee_id, NEW.adjustment_amount_usd, NEW.adjustment_amount_local,
      NEW.local_currency, NEW.exchange_rate_used,
      to_jsonb(NEW), auth.uid(), v_month_year, NEW.reason
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.payout_audit_log (
        payout_run_id, action, entity_type, audit_category,
        employee_id, amount_usd, amount_local, local_currency,
        old_values, new_values, changed_by, month_year, reason
      )
      VALUES (
        NEW.payout_run_id,
        CASE NEW.status
          WHEN 'approved' THEN 'adjustment_approved'
          WHEN 'rejected' THEN 'adjustment_rejected'
          WHEN 'applied' THEN 'adjustment_applied'
          ELSE 'adjustment_updated'
        END,
        'adjustment', 'adjustment',
        NEW.employee_id, NEW.adjustment_amount_usd, NEW.adjustment_amount_local,
        NEW.local_currency,
        jsonb_build_object('status', OLD.status),
        jsonb_build_object('status', NEW.status, 'applied_to_month', NEW.applied_to_month),
        auth.uid(), v_month_year, NEW.reason
      );
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger on payout_adjustments
DROP TRIGGER IF EXISTS log_adjustment_changes ON public.payout_adjustments;
CREATE TRIGGER log_adjustment_changes
  AFTER INSERT OR UPDATE ON public.payout_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_adjustment_change();