-- Phase 1.1: Add new columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS employee_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS designation TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS date_of_hire DATE,
ADD COLUMN IF NOT EXISTS group_name TEXT,
ADD COLUMN IF NOT EXISTS business_unit TEXT,
ADD COLUMN IF NOT EXISTS function_area TEXT,
ADD COLUMN IF NOT EXISTS sales_function TEXT;

-- Phase 1.2: Add new columns to user_targets table
ALTER TABLE public.user_targets
ADD COLUMN IF NOT EXISTS target_bonus_percent NUMERIC,
ADD COLUMN IF NOT EXISTS tfp_local_currency NUMERIC,
ADD COLUMN IF NOT EXISTS ote_local_currency NUMERIC,
ADD COLUMN IF NOT EXISTS tfp_usd NUMERIC,
ADD COLUMN IF NOT EXISTS target_bonus_usd NUMERIC,
ADD COLUMN IF NOT EXISTS ote_usd NUMERIC;

-- Phase 1.3: Create app_role enum for permission-based access
CREATE TYPE public.app_role AS ENUM ('admin', 'sales_head', 'sales_rep');

-- Phase 1.4: Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Phase 1.5: Create has_role() security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Phase 1.6: RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Phase 1.7: Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 
  CASE 
    WHEN role::text = 'Admin' THEN 'admin'::app_role
    WHEN role::text = 'Sales_Head' THEN 'sales_head'::app_role
    ELSE 'sales_rep'::app_role
  END
FROM public.profiles
WHERE id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Phase 1.8: Update RLS policies on profiles to use has_role function
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Phase 1.9: Update RLS policies on comp_plans
DROP POLICY IF EXISTS "Admins can manage comp_plans" ON public.comp_plans;
CREATE POLICY "Admins can manage comp_plans"
ON public.comp_plans
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Phase 1.10: Update RLS policies on plan_metrics
DROP POLICY IF EXISTS "Admins can manage plan_metrics" ON public.plan_metrics;
CREATE POLICY "Admins can manage plan_metrics"
ON public.plan_metrics
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Phase 1.11: Update RLS policies on multiplier_grids
DROP POLICY IF EXISTS "Admins can manage multiplier_grids" ON public.multiplier_grids;
CREATE POLICY "Admins can manage multiplier_grids"
ON public.multiplier_grids
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Phase 1.12: Update RLS policies on user_targets
DROP POLICY IF EXISTS "Admins can manage user_targets" ON public.user_targets;
CREATE POLICY "Admins can manage user_targets"
ON public.user_targets
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all targets" ON public.user_targets;
CREATE POLICY "Admins can view all targets"
ON public.user_targets
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Phase 1.13: Update RLS policies on monthly_actuals
DROP POLICY IF EXISTS "Admins can view all actuals" ON public.monthly_actuals;
CREATE POLICY "Admins can view all actuals"
ON public.monthly_actuals
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Phase 1.14: Update RLS policies on exchange_rates
DROP POLICY IF EXISTS "Admins can manage exchange_rates" ON public.exchange_rates;
CREATE POLICY "Admins can manage exchange_rates"
ON public.exchange_rates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Phase 1.15: Remove role column from profiles (keep local_currency)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- Phase 2: Create compensation plans
INSERT INTO public.comp_plans (name, description, is_active) VALUES
('Farmer 2025', 'Account Management - Farmer Plan for existing account growth', true),
('Hunter 2025', 'New Business - Hunter Plan for new customer acquisition', true),
('CSM 2025', 'Customer Success Manager Plan', true),
('Sales Engineering 2025', 'Sales Engineering Team Plan', true),
('Channel Sales 2025', 'Channel/Partner Sales Plan', true),
('Farmer Retain 2025', 'Farmer Retain Plan for customer retention', true),
('Sales Head Farmer 2025', 'Sales Head Farmer Plan for leadership roles', true)
ON CONFLICT DO NOTHING;