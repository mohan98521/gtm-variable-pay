-- Add RLS policy for sales_rep to view deals where they are a participant
-- This checks if the user's employee_id matches any of the 8 participant columns

CREATE POLICY "Sales rep can view their deals"
ON public.deals
FOR SELECT
USING (
  has_role(auth.uid(), 'sales_rep'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.employee_id IS NOT NULL
    AND (
      deals.sales_rep_employee_id = p.employee_id OR
      deals.sales_head_employee_id = p.employee_id OR
      deals.sales_engineering_employee_id = p.employee_id OR
      deals.sales_engineering_head_employee_id = p.employee_id OR
      deals.product_specialist_employee_id = p.employee_id OR
      deals.product_specialist_head_employee_id = p.employee_id OR
      deals.solution_manager_employee_id = p.employee_id OR
      deals.solution_manager_head_employee_id = p.employee_id
    )
  )
);

-- Also add similar policy for closing_arr_actuals
CREATE POLICY "Sales rep can view their closing ARR"
ON public.closing_arr_actuals
FOR SELECT
USING (
  has_role(auth.uid(), 'sales_rep'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.employee_id IS NOT NULL
    AND (
      closing_arr_actuals.sales_rep_employee_id = p.employee_id OR
      closing_arr_actuals.sales_head_employee_id = p.employee_id
    )
  )
);