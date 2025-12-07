-- Create employees table for storing employee data without auth.users dependency
-- This allows pre-populating employee info before they create accounts
-- When employees sign up, we'll link their auth.users id to their employee_id

CREATE TABLE public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    designation TEXT,
    country TEXT,
    city TEXT,
    date_of_hire DATE,
    group_name TEXT,
    business_unit TEXT,
    function_area TEXT,
    sales_function TEXT,
    local_currency TEXT NOT NULL DEFAULT 'USD',
    manager_employee_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for employees table
CREATE POLICY "Authenticated users can view employees"
ON public.employees
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage employees"
ON public.employees
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update user_targets foreign key to reference employees instead of auth.users
-- First, drop the existing foreign key if it exists
ALTER TABLE public.user_targets DROP CONSTRAINT IF EXISTS user_targets_user_id_fkey;

-- Add new foreign key to employees table
ALTER TABLE public.user_targets 
ADD CONSTRAINT user_targets_employee_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Update monthly_actuals foreign key similarly
ALTER TABLE public.monthly_actuals DROP CONSTRAINT IF EXISTS monthly_actuals_user_id_fkey;

ALTER TABLE public.monthly_actuals 
ADD CONSTRAINT monthly_actuals_employee_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Create trigger for updated_at
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();