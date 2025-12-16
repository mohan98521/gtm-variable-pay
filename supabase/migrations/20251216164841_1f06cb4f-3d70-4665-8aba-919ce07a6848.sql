-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage comp_plans" ON public.comp_plans;
DROP POLICY IF EXISTS "Authenticated users can view comp_plans" ON public.comp_plans;

-- Recreate SELECT policy for all authenticated users
CREATE POLICY "Authenticated users can view comp_plans" 
ON public.comp_plans 
FOR SELECT 
TO authenticated
USING (true);

-- Recreate INSERT policy for admins
CREATE POLICY "Admins can insert comp_plans" 
ON public.comp_plans 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Recreate UPDATE policy for admins  
CREATE POLICY "Admins can update comp_plans" 
ON public.comp_plans 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Recreate DELETE policy for admins
CREATE POLICY "Admins can delete comp_plans" 
ON public.comp_plans 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));