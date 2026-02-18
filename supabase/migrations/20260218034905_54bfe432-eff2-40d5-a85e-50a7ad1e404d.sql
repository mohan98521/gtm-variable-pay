
-- Add audit triggers to all missing tables using the existing log_system_change() function

CREATE TRIGGER audit_support_teams
  AFTER INSERT OR UPDATE OR DELETE ON public.support_teams
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_support_team_members
  AFTER INSERT OR UPDATE OR DELETE ON public.support_team_members
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_sales_functions
  AFTER INSERT OR UPDATE OR DELETE ON public.sales_functions
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_role_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_plan_commissions
  AFTER INSERT OR UPDATE OR DELETE ON public.plan_commissions
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_commission_structures
  AFTER INSERT OR UPDATE OR DELETE ON public.commission_structures
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_closing_arr_renewal_multipliers
  AFTER INSERT OR UPDATE OR DELETE ON public.closing_arr_renewal_multipliers
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_deal_team_spiff_config
  AFTER INSERT OR UPDATE OR DELETE ON public.deal_team_spiff_config
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_deal_team_spiff_allocations
  AFTER INSERT OR UPDATE OR DELETE ON public.deal_team_spiff_allocations
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_fnf_settlements
  AFTER INSERT OR UPDATE OR DELETE ON public.fnf_settlements
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_fnf_settlement_lines
  AFTER INSERT OR UPDATE OR DELETE ON public.fnf_settlement_lines
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_deal_participants
  AFTER INSERT OR UPDATE OR DELETE ON public.deal_participants
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_closing_arr_targets
  AFTER INSERT OR UPDATE OR DELETE ON public.closing_arr_targets
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_quarterly_targets
  AFTER INSERT OR UPDATE OR DELETE ON public.quarterly_targets
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

CREATE TRIGGER audit_currencies
  AFTER INSERT OR UPDATE OR DELETE ON public.currencies
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
