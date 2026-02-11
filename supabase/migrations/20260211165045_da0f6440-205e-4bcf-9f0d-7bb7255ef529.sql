
-- Fix the log_payout_change trigger to set payout_id to NULL on delete
-- (since the record is being deleted, the FK would be violated)
CREATE OR REPLACE FUNCTION public.log_payout_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payout_audit_log (payout_id, action, entity_type, new_values, changed_by)
    VALUES (NEW.id, 'created', 'payout', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.payout_audit_log (payout_id, action, entity_type, old_values, new_values, changed_by)
    VALUES (NEW.id, 'updated', 'payout', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    -- Use NULL for payout_id on delete to avoid FK violation
    INSERT INTO public.payout_audit_log (payout_id, action, entity_type, old_values, changed_by, payout_run_id, employee_id, month_year)
    VALUES (NULL, 'deleted', 'payout', to_jsonb(OLD), auth.uid(), OLD.payout_run_id, OLD.employee_id, OLD.month_year);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;
