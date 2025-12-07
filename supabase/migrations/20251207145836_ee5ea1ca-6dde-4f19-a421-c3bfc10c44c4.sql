-- Add RLS policies for new roles: gtm_ops, finance, executive

-- GTM Ops can view all profiles
CREATE POLICY "GTM Ops can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'gtm_ops'::app_role));

-- Finance can view all profiles
CREATE POLICY "Finance can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'finance'::app_role));

-- Executive can view all profiles
CREATE POLICY "Executive can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'executive'::app_role));

-- GTM Ops can view all user_targets
CREATE POLICY "GTM Ops can view all targets" 
ON public.user_targets 
FOR SELECT 
USING (has_role(auth.uid(), 'gtm_ops'::app_role));

-- Finance can view all user_targets
CREATE POLICY "Finance can view all targets" 
ON public.user_targets 
FOR SELECT 
USING (has_role(auth.uid(), 'finance'::app_role));

-- Executive can view all user_targets
CREATE POLICY "Executive can view all targets" 
ON public.user_targets 
FOR SELECT 
USING (has_role(auth.uid(), 'executive'::app_role));

-- GTM Ops can view all monthly_actuals
CREATE POLICY "GTM Ops can view all actuals" 
ON public.monthly_actuals 
FOR SELECT 
USING (has_role(auth.uid(), 'gtm_ops'::app_role));

-- GTM Ops can manage monthly_actuals (INSERT, UPDATE, DELETE)
CREATE POLICY "GTM Ops can manage actuals" 
ON public.monthly_actuals 
FOR ALL 
USING (has_role(auth.uid(), 'gtm_ops'::app_role));

-- Finance can view all monthly_actuals
CREATE POLICY "Finance can view all actuals" 
ON public.monthly_actuals 
FOR SELECT 
USING (has_role(auth.uid(), 'finance'::app_role));

-- Executive can view all monthly_actuals  
CREATE POLICY "Executive can view all actuals" 
ON public.monthly_actuals 
FOR SELECT 
USING (has_role(auth.uid(), 'executive'::app_role));