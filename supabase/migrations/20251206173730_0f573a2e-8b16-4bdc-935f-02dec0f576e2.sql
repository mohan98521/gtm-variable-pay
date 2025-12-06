-- Create enum types for the application
CREATE TYPE public.user_role AS ENUM ('Admin', 'Sales_Head', 'Sales_Rep');
CREATE TYPE public.logic_type AS ENUM ('Stepped_Accelerator', 'Gated_Threshold', 'Linear');

-- Create users/profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'Sales_Rep',
  local_currency TEXT NOT NULL DEFAULT 'USD',
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create comp_plans table
CREATE TABLE public.comp_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create plan_metrics table
CREATE TABLE public.plan_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.comp_plans(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  weightage_percent DECIMAL(5,2) NOT NULL CHECK (weightage_percent >= 0 AND weightage_percent <= 100),
  logic_type logic_type NOT NULL DEFAULT 'Linear',
  gate_threshold_percent DECIMAL(5,2) DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create multiplier_grids table
CREATE TABLE public.multiplier_grids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_metric_id UUID NOT NULL REFERENCES public.plan_metrics(id) ON DELETE CASCADE,
  min_pct DECIMAL(5,2) NOT NULL,
  max_pct DECIMAL(5,2) NOT NULL,
  multiplier_value DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_targets table (temporal)
CREATE TABLE public.user_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.comp_plans(id) ON DELETE CASCADE,
  effective_start_date DATE NOT NULL,
  effective_end_date DATE NOT NULL,
  target_value_annual DECIMAL(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create monthly_actuals table
CREATE TABLE public.monthly_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month_year DATE NOT NULL,
  metric_id UUID NOT NULL REFERENCES public.plan_metrics(id) ON DELETE CASCADE,
  achieved_value_local_currency DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create exchange_rates table
CREATE TABLE public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code TEXT NOT NULL,
  month_year DATE NOT NULL,
  rate_to_usd DECIMAL(10,6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(currency_code, month_year)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comp_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiplier_grids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

CREATE POLICY "Managers can view their reports"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    manager_id = auth.uid()
  );

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for comp_plans (viewable by all authenticated, editable by admins)
CREATE POLICY "Authenticated users can view comp_plans"
  ON public.comp_plans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage comp_plans"
  ON public.comp_plans FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- RLS Policies for plan_metrics
CREATE POLICY "Authenticated users can view plan_metrics"
  ON public.plan_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage plan_metrics"
  ON public.plan_metrics FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- RLS Policies for multiplier_grids
CREATE POLICY "Authenticated users can view multiplier_grids"
  ON public.multiplier_grids FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage multiplier_grids"
  ON public.multiplier_grids FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- RLS Policies for user_targets
CREATE POLICY "Users can view their own targets"
  ON public.user_targets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all targets"
  ON public.user_targets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

CREATE POLICY "Managers can view their reports targets"
  ON public.user_targets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = user_id AND manager_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage user_targets"
  ON public.user_targets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- RLS Policies for monthly_actuals
CREATE POLICY "Users can view their own actuals"
  ON public.monthly_actuals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own actuals"
  ON public.monthly_actuals FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all actuals"
  ON public.monthly_actuals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

CREATE POLICY "Managers can view their reports actuals"
  ON public.monthly_actuals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = user_id AND manager_id = auth.uid()
    )
  );

-- RLS Policies for exchange_rates (viewable by all, editable by admins)
CREATE POLICY "Authenticated users can view exchange_rates"
  ON public.exchange_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage exchange_rates"
  ON public.exchange_rates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_comp_plans_updated_at
  BEFORE UPDATE ON public.comp_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_actuals_updated_at
  BEFORE UPDATE ON public.monthly_actuals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();