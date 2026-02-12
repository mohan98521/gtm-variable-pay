
-- Step 1: Drop ALL policies on ALL tables that could reference app_role or user_roles.role

-- payout_runs
DROP POLICY IF EXISTS "Admin and GTM Ops can manage payout runs" ON public.payout_runs;
DROP POLICY IF EXISTS "Employees can view finalized payout runs" ON public.payout_runs;

-- payout_adjustments
DROP POLICY IF EXISTS "Admin and Finance can manage adjustments" ON public.payout_adjustments;

-- payout_audit_log (all possible names)
DROP POLICY IF EXISTS "Admin can view payout audit" ON public.payout_audit_log;
DROP POLICY IF EXISTS "Finance can view payout audit" ON public.payout_audit_log;
DROP POLICY IF EXISTS "GTM Ops can view payout audit" ON public.payout_audit_log;
DROP POLICY IF EXISTS "Executive can view payout audit" ON public.payout_audit_log;
DROP POLICY IF EXISTS "System can insert payout audit" ON public.payout_audit_log;
DROP POLICY IF EXISTS "Admins can view payout_audit_log" ON public.payout_audit_log;
DROP POLICY IF EXISTS "GTM Ops can view payout_audit_log" ON public.payout_audit_log;
DROP POLICY IF EXISTS "Finance can view payout_audit_log" ON public.payout_audit_log;
DROP POLICY IF EXISTS "Executive can view payout_audit_log" ON public.payout_audit_log;
DROP POLICY IF EXISTS "System can insert payout_audit_log" ON public.payout_audit_log;

-- performance_targets
DROP POLICY IF EXISTS "Admins can manage performance_targets" ON public.performance_targets;
DROP POLICY IF EXISTS "Authenticated users can view performance_targets" ON public.performance_targets;

-- system_audit_log
DROP POLICY IF EXISTS "Audit logs viewable by authorized roles" ON public.system_audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.system_audit_log;

-- deal_participants
DROP POLICY IF EXISTS "Admins can manage deal_participants" ON public.deal_participants;
DROP POLICY IF EXISTS "Executive can view deal_participants" ON public.deal_participants;
DROP POLICY IF EXISTS "Finance can view deal_participants" ON public.deal_participants;
DROP POLICY IF EXISTS "GTM Ops can manage deal_participants" ON public.deal_participants;
DROP POLICY IF EXISTS "Sales head can view deal_participants" ON public.deal_participants;

-- closing_arr_actuals
DROP POLICY IF EXISTS "Admins can manage closing_arr_actuals" ON public.closing_arr_actuals;
DROP POLICY IF EXISTS "Executive can view closing_arr_actuals" ON public.closing_arr_actuals;
DROP POLICY IF EXISTS "Finance can view closing_arr_actuals" ON public.closing_arr_actuals;
DROP POLICY IF EXISTS "GTM Ops can manage closing_arr_actuals" ON public.closing_arr_actuals;
DROP POLICY IF EXISTS "Sales head can view closing_arr_actuals" ON public.closing_arr_actuals;
DROP POLICY IF EXISTS "Sales rep can view their closing ARR" ON public.closing_arr_actuals;

-- plan_metrics
DROP POLICY IF EXISTS "Admins can manage plan_metrics" ON public.plan_metrics;
DROP POLICY IF EXISTS "Authenticated users can view plan_metrics" ON public.plan_metrics;

-- commission_structures
DROP POLICY IF EXISTS "Admins can manage commission_structures" ON public.commission_structures;
DROP POLICY IF EXISTS "Authenticated users can view commission_structures" ON public.commission_structures;

-- deal_audit_log
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.deal_audit_log;
DROP POLICY IF EXISTS "Executive can view audit logs" ON public.deal_audit_log;
DROP POLICY IF EXISTS "Finance can view audit logs" ON public.deal_audit_log;
DROP POLICY IF EXISTS "GTM Ops can view audit logs" ON public.deal_audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.deal_audit_log;

-- deals
DROP POLICY IF EXISTS "Admins can manage deals" ON public.deals;
DROP POLICY IF EXISTS "Executive can view deals" ON public.deals;
DROP POLICY IF EXISTS "Finance can view deals" ON public.deals;
DROP POLICY IF EXISTS "GTM Ops can manage deals" ON public.deals;
DROP POLICY IF EXISTS "Sales head can view deals" ON public.deals;
DROP POLICY IF EXISTS "Sales rep can view their deals" ON public.deals;

-- comp_plans
DROP POLICY IF EXISTS "Admins can delete comp_plans" ON public.comp_plans;
DROP POLICY IF EXISTS "Admins can insert comp_plans" ON public.comp_plans;
DROP POLICY IF EXISTS "Admins can update comp_plans" ON public.comp_plans;
DROP POLICY IF EXISTS "Authenticated users can view comp_plans" ON public.comp_plans;

-- employees
DROP POLICY IF EXISTS "Admins can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated users can view employees" ON public.employees;

-- monthly_actuals
DROP POLICY IF EXISTS "Admins can view all actuals" ON public.monthly_actuals;
DROP POLICY IF EXISTS "Executive can view all actuals" ON public.monthly_actuals;
DROP POLICY IF EXISTS "Finance can view all actuals" ON public.monthly_actuals;
DROP POLICY IF EXISTS "GTM Ops can manage actuals" ON public.monthly_actuals;
DROP POLICY IF EXISTS "GTM Ops can view all actuals" ON public.monthly_actuals;
DROP POLICY IF EXISTS "Managers can view their reports actuals" ON public.monthly_actuals;
DROP POLICY IF EXISTS "Users can manage their own actuals" ON public.monthly_actuals;
DROP POLICY IF EXISTS "Users can view their own actuals" ON public.monthly_actuals;

-- closing_arr_targets
DROP POLICY IF EXISTS "Admins can manage closing_arr_targets" ON public.closing_arr_targets;
DROP POLICY IF EXISTS "Authenticated users can view closing_arr_targets" ON public.closing_arr_targets;
DROP POLICY IF EXISTS "GTM Ops can manage closing_arr_targets" ON public.closing_arr_targets;

-- monthly_bookings
DROP POLICY IF EXISTS "Admins can manage monthly_bookings" ON public.monthly_bookings;
DROP POLICY IF EXISTS "Authenticated users can view monthly_bookings" ON public.monthly_bookings;
DROP POLICY IF EXISTS "Finance can view monthly_bookings" ON public.monthly_bookings;
DROP POLICY IF EXISTS "GTM Ops can manage monthly_bookings" ON public.monthly_bookings;

-- plan_commissions
DROP POLICY IF EXISTS "Admins can manage plan_commissions" ON public.plan_commissions;
DROP POLICY IF EXISTS "Authenticated users can view plan_commissions" ON public.plan_commissions;

-- quarterly_targets
DROP POLICY IF EXISTS "Admins can manage quarterly_targets" ON public.quarterly_targets;
DROP POLICY IF EXISTS "Authenticated users can view quarterly_targets" ON public.quarterly_targets;
DROP POLICY IF EXISTS "GTM Ops can manage quarterly_targets" ON public.quarterly_targets;

-- user_roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- deal_variable_pay_attribution
DROP POLICY IF EXISTS "Admins can manage deal_variable_pay_attribution" ON public.deal_variable_pay_attribution;
DROP POLICY IF EXISTS "Executive can view deal_variable_pay_attribution" ON public.deal_variable_pay_attribution;
DROP POLICY IF EXISTS "Finance can view deal_variable_pay_attribution" ON public.deal_variable_pay_attribution;
DROP POLICY IF EXISTS "GTM Ops can manage deal_variable_pay_attribution" ON public.deal_variable_pay_attribution;
DROP POLICY IF EXISTS "Sales head can view deal_variable_pay_attribution" ON public.deal_variable_pay_attribution;
DROP POLICY IF EXISTS "Sales rep can view their attributions" ON public.deal_variable_pay_attribution;

-- currencies
DROP POLICY IF EXISTS "Admins can manage currencies" ON public.currencies;
DROP POLICY IF EXISTS "Authenticated users can view currencies" ON public.currencies;

-- exchange_rates
DROP POLICY IF EXISTS "Admins can manage exchange_rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "Authenticated users can view exchange_rates" ON public.exchange_rates;

-- role_permissions
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Authenticated users can view permissions" ON public.role_permissions;

-- user_targets
DROP POLICY IF EXISTS "Admins can manage user_targets" ON public.user_targets;
DROP POLICY IF EXISTS "Admins can view all targets" ON public.user_targets;
DROP POLICY IF EXISTS "Executive can view all targets" ON public.user_targets;
DROP POLICY IF EXISTS "Finance can view all targets" ON public.user_targets;
DROP POLICY IF EXISTS "GTM Ops can view all targets" ON public.user_targets;
DROP POLICY IF EXISTS "Managers can view their reports targets" ON public.user_targets;
DROP POLICY IF EXISTS "Users can view their own targets" ON public.user_targets;

-- monthly_payouts
DROP POLICY IF EXISTS "Admins can manage monthly_payouts" ON public.monthly_payouts;
DROP POLICY IF EXISTS "Authenticated users can view their payouts" ON public.monthly_payouts;
DROP POLICY IF EXISTS "Finance can manage monthly_payouts" ON public.monthly_payouts;
DROP POLICY IF EXISTS "GTM Ops can manage monthly_payouts" ON public.monthly_payouts;

-- multiplier_grids
DROP POLICY IF EXISTS "Admins can manage multiplier_grids" ON public.multiplier_grids;
DROP POLICY IF EXISTS "Authenticated users can view multiplier_grids" ON public.multiplier_grids;

-- profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Executive can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Finance can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "GTM Ops can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view their reports" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- deal_collections
DROP POLICY IF EXISTS "Admins can manage deal_collections" ON public.deal_collections;
DROP POLICY IF EXISTS "Executive can view deal_collections" ON public.deal_collections;
DROP POLICY IF EXISTS "Finance can manage deal_collections" ON public.deal_collections;
DROP POLICY IF EXISTS "GTM Ops can manage deal_collections" ON public.deal_collections;
DROP POLICY IF EXISTS "Sales head can view deal_collections" ON public.deal_collections;
DROP POLICY IF EXISTS "Sales rep can view their collections" ON public.deal_collections;

-- Step 2: Drop functions that use enum
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;

-- Step 3: Alter columns
ALTER TABLE public.user_roles ALTER COLUMN role TYPE TEXT USING role::TEXT;
ALTER TABLE public.role_permissions ALTER COLUMN role TYPE TEXT USING role::TEXT;

-- Step 4: Drop enum
DROP TYPE IF EXISTS public.app_role;

-- Step 5: Create roles table
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'gray',
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Step 6: Seed
INSERT INTO public.roles (name, label, description, color, is_system_role) VALUES
  ('admin', 'Admin', 'Full system access', 'red', true),
  ('gtm_ops', 'GTM Ops', 'Data operations and plan configuration', 'blue', true),
  ('finance', 'Finance', 'Financial verification and reporting', 'green', true),
  ('executive', 'Executive', 'View-only dashboards across all teams', 'purple', true),
  ('sales_head', 'Sales Head', 'Own team visibility and management', 'orange', true),
  ('sales_rep', 'Sales Rep', 'Personal dashboard access', 'slate', true);

-- Step 7: FK constraints
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_fkey FOREIGN KEY (role) REFERENCES public.roles(name) ON DELETE CASCADE;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_fkey FOREIGN KEY (role) REFERENCES public.roles(name) ON DELETE CASCADE;

-- Step 8: Recreate functions with TEXT
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.role_permissions rp JOIN public.user_roles ur ON ur.role = rp.role WHERE ur.user_id = _user_id AND rp.permission_key = _permission_key AND rp.is_allowed = true) $$;

-- Step 9: Recreate ALL policies with text

-- roles
CREATE POLICY "Authenticated users can read roles" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert roles" ON public.roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.roles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "pr_manage" ON public.payout_runs FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'gtm_ops', 'finance')));
CREATE POLICY "pr_view_finalized" ON public.payout_runs FOR SELECT TO authenticated USING (run_status IN ('finalized', 'paid'));

CREATE POLICY "pa_manage" ON public.payout_adjustments FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'finance', 'gtm_ops')));

CREATE POLICY "pt_admin" ON public.performance_targets FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "pt_view" ON public.performance_targets FOR SELECT TO authenticated USING (true);

CREATE POLICY "sal_view" ON public.system_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance') OR has_role(auth.uid(), 'gtm_ops') OR has_role(auth.uid(), 'executive'));
CREATE POLICY "sal_insert" ON public.system_audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "dp_admin" ON public.deal_participants FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "dp_exec" ON public.deal_participants FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "dp_fin" ON public.deal_participants FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "dp_gtm" ON public.deal_participants FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "dp_sh" ON public.deal_participants FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_head'));

CREATE POLICY "ca_admin" ON public.closing_arr_actuals FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "ca_exec" ON public.closing_arr_actuals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "ca_fin" ON public.closing_arr_actuals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "ca_gtm" ON public.closing_arr_actuals FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "ca_sh" ON public.closing_arr_actuals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_head'));
CREATE POLICY "ca_sr" ON public.closing_arr_actuals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_rep') AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.employee_id IS NOT NULL AND (closing_arr_actuals.sales_rep_employee_id = p.employee_id OR closing_arr_actuals.sales_head_employee_id = p.employee_id)));

CREATE POLICY "pm_admin" ON public.plan_metrics FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "pm_view" ON public.plan_metrics FOR SELECT TO authenticated USING (true);

CREATE POLICY "cs_admin" ON public.commission_structures FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "cs_view" ON public.commission_structures FOR SELECT TO authenticated USING (true);

CREATE POLICY "dal_admin" ON public.deal_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "dal_exec" ON public.deal_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "dal_fin" ON public.deal_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "dal_gtm" ON public.deal_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "dal_insert" ON public.deal_audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "d_admin" ON public.deals FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "d_exec" ON public.deals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "d_fin" ON public.deals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "d_gtm" ON public.deals FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "d_sh" ON public.deals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_head'));
CREATE POLICY "d_sr" ON public.deals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_rep') AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.employee_id IS NOT NULL AND (deals.sales_rep_employee_id = p.employee_id OR deals.sales_head_employee_id = p.employee_id OR deals.sales_engineering_employee_id = p.employee_id OR deals.sales_engineering_head_employee_id = p.employee_id OR deals.product_specialist_employee_id = p.employee_id OR deals.product_specialist_head_employee_id = p.employee_id OR deals.solution_manager_employee_id = p.employee_id OR deals.solution_manager_head_employee_id = p.employee_id)));

CREATE POLICY "cp_del" ON public.comp_plans FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "cp_ins" ON public.comp_plans FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "cp_upd" ON public.comp_plans FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "cp_view" ON public.comp_plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "emp_admin" ON public.employees FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "emp_view" ON public.employees FOR SELECT TO authenticated USING (true);

CREATE POLICY "ma_admin" ON public.monthly_actuals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "ma_exec" ON public.monthly_actuals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "ma_fin" ON public.monthly_actuals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "ma_gtm_all" ON public.monthly_actuals FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "ma_gtm_view" ON public.monthly_actuals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "ma_mgr" ON public.monthly_actuals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = monthly_actuals.user_id AND profiles.manager_id = auth.uid()));
CREATE POLICY "ma_own_all" ON public.monthly_actuals FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ma_own_view" ON public.monthly_actuals FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "cat_admin" ON public.closing_arr_targets FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "cat_view" ON public.closing_arr_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_gtm" ON public.closing_arr_targets FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));

CREATE POLICY "mb_admin" ON public.monthly_bookings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "mb_view" ON public.monthly_bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "mb_fin" ON public.monthly_bookings FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "mb_gtm" ON public.monthly_bookings FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));

CREATE POLICY "pc_admin" ON public.plan_commissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "pc_view" ON public.plan_commissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "qt_admin" ON public.quarterly_targets FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "qt_view" ON public.quarterly_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "qt_gtm" ON public.quarterly_targets FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));

CREATE POLICY "ur_admin_all" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "ur_admin_view" ON public.user_roles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "ur_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "dvpa_admin" ON public.deal_variable_pay_attribution FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "dvpa_exec" ON public.deal_variable_pay_attribution FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "dvpa_fin" ON public.deal_variable_pay_attribution FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "dvpa_gtm" ON public.deal_variable_pay_attribution FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "dvpa_sh" ON public.deal_variable_pay_attribution FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_head'));
CREATE POLICY "dvpa_sr" ON public.deal_variable_pay_attribution FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_rep') AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.employee_id IS NOT NULL AND deal_variable_pay_attribution.employee_id = p.employee_id));

CREATE POLICY "cur_admin" ON public.currencies FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "cur_view" ON public.currencies FOR SELECT TO authenticated USING (true);

CREATE POLICY "er_admin" ON public.exchange_rates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "er_view" ON public.exchange_rates FOR SELECT TO authenticated USING (true);

CREATE POLICY "rp_admin" ON public.role_permissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "rp_view" ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "ut_admin_all" ON public.user_targets FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "ut_admin_view" ON public.user_targets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "ut_exec" ON public.user_targets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "ut_fin" ON public.user_targets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "ut_gtm" ON public.user_targets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "ut_mgr" ON public.user_targets FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = user_targets.user_id AND profiles.manager_id = auth.uid()));
CREATE POLICY "ut_own" ON public.user_targets FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "mp_admin" ON public.monthly_payouts FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "mp_view" ON public.monthly_payouts FOR SELECT TO authenticated USING (true);
CREATE POLICY "mp_fin" ON public.monthly_payouts FOR ALL TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "mp_gtm" ON public.monthly_payouts FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));

CREATE POLICY "mg_admin" ON public.multiplier_grids FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "mg_view" ON public.multiplier_grids FOR SELECT TO authenticated USING (true);

CREATE POLICY "prof_admin" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "prof_exec" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "prof_fin" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "prof_gtm" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "prof_mgr" ON public.profiles FOR SELECT TO authenticated USING (manager_id = auth.uid());
CREATE POLICY "prof_ins" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "prof_upd" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "prof_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "dc_admin" ON public.deal_collections FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "dc_exec" ON public.deal_collections FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "dc_fin" ON public.deal_collections FOR ALL TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "dc_gtm" ON public.deal_collections FOR ALL TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "dc_sh" ON public.deal_collections FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_head'));
CREATE POLICY "dc_sr" ON public.deal_collections FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales_rep') AND EXISTS (SELECT 1 FROM deals d JOIN profiles p ON p.id = auth.uid() WHERE d.id = deal_collections.deal_id AND p.employee_id IS NOT NULL AND (d.sales_rep_employee_id = p.employee_id OR d.sales_head_employee_id = p.employee_id)));

CREATE POLICY "pal_admin" ON public.payout_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "pal_fin" ON public.payout_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'));
CREATE POLICY "pal_gtm" ON public.payout_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'gtm_ops'));
CREATE POLICY "pal_exec" ON public.payout_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'executive'));
CREATE POLICY "pal_insert" ON public.payout_audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Step 10: Add tab:roles permission
INSERT INTO public.role_permissions (role, permission_key, is_allowed)
SELECT r.name, 'tab:roles', CASE WHEN r.name = 'admin' THEN true ELSE false END
FROM public.roles r;

-- Step 11: Auto-generate permissions trigger
CREATE OR REPLACE FUNCTION public.auto_generate_role_permissions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.role_permissions (role, permission_key, is_allowed)
  SELECT NEW.name, dk.permission_key, false
  FROM (SELECT DISTINCT permission_key FROM public.role_permissions) AS dk
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_role_permissions
  AFTER INSERT ON public.roles FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_role_permissions();
