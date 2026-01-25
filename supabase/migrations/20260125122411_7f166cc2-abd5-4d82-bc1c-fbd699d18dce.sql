-- Create role_permissions table
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_key text NOT NULL,
  is_allowed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (role, permission_key)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view permissions"
ON public.role_permissions FOR SELECT
USING (true);

CREATE POLICY "Admins can manage permissions"
ON public.role_permissions FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create security definer function to check permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role = rp.role
    WHERE ur.user_id = _user_id
      AND rp.permission_key = _permission_key
      AND rp.is_allowed = true
  )
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default permissions based on current access matrix
INSERT INTO public.role_permissions (role, permission_key, is_allowed) VALUES
-- Page Access - Admin
('admin', 'page:dashboard', true),
('admin', 'page:team_view', true),
('admin', 'page:plan_config', true),
('admin', 'page:reports', true),
('admin', 'page:data_inputs', true),
-- Page Access - GTM Ops
('gtm_ops', 'page:dashboard', true),
('gtm_ops', 'page:team_view', true),
('gtm_ops', 'page:plan_config', true),
('gtm_ops', 'page:reports', true),
('gtm_ops', 'page:data_inputs', true),
-- Page Access - Finance
('finance', 'page:dashboard', true),
('finance', 'page:team_view', true),
('finance', 'page:plan_config', true),
('finance', 'page:reports', true),
('finance', 'page:data_inputs', false),
-- Page Access - Executive
('executive', 'page:dashboard', true),
('executive', 'page:team_view', true),
('executive', 'page:plan_config', true),
('executive', 'page:reports', true),
('executive', 'page:data_inputs', false),
-- Page Access - Sales Head
('sales_head', 'page:dashboard', true),
('sales_head', 'page:team_view', true),
('sales_head', 'page:plan_config', false),
('sales_head', 'page:reports', false),
('sales_head', 'page:data_inputs', false),
-- Page Access - Sales Rep
('sales_rep', 'page:dashboard', true),
('sales_rep', 'page:team_view', false),
('sales_rep', 'page:plan_config', false),
('sales_rep', 'page:reports', false),
('sales_rep', 'page:data_inputs', false),

-- Admin Tabs - Admin
('admin', 'tab:employee_accounts', true),
('admin', 'tab:bulk_upload', true),
('admin', 'tab:role_management', true),
('admin', 'tab:permissions', true),
('admin', 'tab:comp_plans', true),
-- Admin Tabs - GTM Ops
('gtm_ops', 'tab:employee_accounts', true),
('gtm_ops', 'tab:bulk_upload', true),
('gtm_ops', 'tab:role_management', false),
('gtm_ops', 'tab:permissions', false),
('gtm_ops', 'tab:comp_plans', true),
-- Admin Tabs - Finance
('finance', 'tab:employee_accounts', false),
('finance', 'tab:bulk_upload', false),
('finance', 'tab:role_management', false),
('finance', 'tab:permissions', false),
('finance', 'tab:comp_plans', true),
-- Admin Tabs - Executive
('executive', 'tab:employee_accounts', false),
('executive', 'tab:bulk_upload', false),
('executive', 'tab:role_management', false),
('executive', 'tab:permissions', false),
('executive', 'tab:comp_plans', true),
-- Admin Tabs - Sales Head
('sales_head', 'tab:employee_accounts', false),
('sales_head', 'tab:bulk_upload', false),
('sales_head', 'tab:role_management', false),
('sales_head', 'tab:permissions', false),
('sales_head', 'tab:comp_plans', false),
-- Admin Tabs - Sales Rep
('sales_rep', 'tab:employee_accounts', false),
('sales_rep', 'tab:bulk_upload', false),
('sales_rep', 'tab:role_management', false),
('sales_rep', 'tab:permissions', false),
('sales_rep', 'tab:comp_plans', false),

-- Actions - Admin
('admin', 'action:create_comp_plan', true),
('admin', 'action:edit_comp_plan', true),
('admin', 'action:delete_comp_plan', true),
('admin', 'action:create_employee', true),
('admin', 'action:edit_employee', true),
('admin', 'action:deactivate_employee', true),
('admin', 'action:create_auth_account', true),
('admin', 'action:manage_roles', true),
('admin', 'action:upload_data', true),
('admin', 'action:edit_actuals', true),
('admin', 'action:edit_exchange_rates', true),
('admin', 'action:export_reports', true),
-- Actions - GTM Ops
('gtm_ops', 'action:create_comp_plan', false),
('gtm_ops', 'action:edit_comp_plan', true),
('gtm_ops', 'action:delete_comp_plan', false),
('gtm_ops', 'action:create_employee', true),
('gtm_ops', 'action:edit_employee', true),
('gtm_ops', 'action:deactivate_employee', true),
('gtm_ops', 'action:create_auth_account', true),
('gtm_ops', 'action:manage_roles', false),
('gtm_ops', 'action:upload_data', true),
('gtm_ops', 'action:edit_actuals', true),
('gtm_ops', 'action:edit_exchange_rates', true),
('gtm_ops', 'action:export_reports', true),
-- Actions - Finance
('finance', 'action:create_comp_plan', false),
('finance', 'action:edit_comp_plan', false),
('finance', 'action:delete_comp_plan', false),
('finance', 'action:create_employee', false),
('finance', 'action:edit_employee', false),
('finance', 'action:deactivate_employee', false),
('finance', 'action:create_auth_account', false),
('finance', 'action:manage_roles', false),
('finance', 'action:upload_data', false),
('finance', 'action:edit_actuals', false),
('finance', 'action:edit_exchange_rates', false),
('finance', 'action:export_reports', true),
-- Actions - Executive
('executive', 'action:create_comp_plan', false),
('executive', 'action:edit_comp_plan', false),
('executive', 'action:delete_comp_plan', false),
('executive', 'action:create_employee', false),
('executive', 'action:edit_employee', false),
('executive', 'action:deactivate_employee', false),
('executive', 'action:create_auth_account', false),
('executive', 'action:manage_roles', false),
('executive', 'action:upload_data', false),
('executive', 'action:edit_actuals', false),
('executive', 'action:edit_exchange_rates', false),
('executive', 'action:export_reports', true),
-- Actions - Sales Head
('sales_head', 'action:create_comp_plan', false),
('sales_head', 'action:edit_comp_plan', false),
('sales_head', 'action:delete_comp_plan', false),
('sales_head', 'action:create_employee', false),
('sales_head', 'action:edit_employee', false),
('sales_head', 'action:deactivate_employee', false),
('sales_head', 'action:create_auth_account', false),
('sales_head', 'action:manage_roles', false),
('sales_head', 'action:upload_data', false),
('sales_head', 'action:edit_actuals', false),
('sales_head', 'action:edit_exchange_rates', false),
('sales_head', 'action:export_reports', false),
-- Actions - Sales Rep
('sales_rep', 'action:create_comp_plan', false),
('sales_rep', 'action:edit_comp_plan', false),
('sales_rep', 'action:delete_comp_plan', false),
('sales_rep', 'action:create_employee', false),
('sales_rep', 'action:edit_employee', false),
('sales_rep', 'action:deactivate_employee', false),
('sales_rep', 'action:create_auth_account', false),
('sales_rep', 'action:manage_roles', false),
('sales_rep', 'action:upload_data', false),
('sales_rep', 'action:edit_actuals', false),
('sales_rep', 'action:edit_exchange_rates', false),
('sales_rep', 'action:export_reports', false);