-- Create closing_arr_actuals table for monthly project-level ARR tracking
CREATE TABLE public.closing_arr_actuals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_year date NOT NULL,
  bu text NOT NULL,
  product text NOT NULL,
  pid text NOT NULL,
  customer_code text NOT NULL,
  customer_name text NOT NULL,
  order_category text,
  status text,
  order_category_2 text,
  opening_arr numeric DEFAULT 0,
  cr numeric DEFAULT 0,
  als_others numeric DEFAULT 0,
  new numeric DEFAULT 0,
  inflation numeric DEFAULT 0,
  discount_decrement numeric DEFAULT 0,
  churn numeric DEFAULT 0,
  adjustment numeric DEFAULT 0,
  closing_arr numeric GENERATED ALWAYS AS (
    COALESCE(opening_arr, 0) + 
    COALESCE(cr, 0) + 
    COALESCE(als_others, 0) + 
    COALESCE(new, 0) + 
    COALESCE(inflation, 0) - 
    COALESCE(discount_decrement, 0) - 
    COALESCE(churn, 0) + 
    COALESCE(adjustment, 0)
  ) STORED,
  country text,
  revised_region text,
  start_date date,
  end_date date,
  renewal_status text,
  sales_rep_employee_id text,
  sales_rep_name text,
  sales_head_employee_id text,
  sales_head_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Unique constraint: one record per project per month
  CONSTRAINT closing_arr_actuals_month_pid_unique UNIQUE (month_year, pid)
);

-- Create index for faster queries
CREATE INDEX idx_closing_arr_actuals_month ON public.closing_arr_actuals(month_year);
CREATE INDEX idx_closing_arr_actuals_pid ON public.closing_arr_actuals(pid);
CREATE INDEX idx_closing_arr_actuals_sales_rep ON public.closing_arr_actuals(sales_rep_employee_id);

-- Enable RLS
ALTER TABLE public.closing_arr_actuals ENABLE ROW LEVEL SECURITY;

-- RLS Policies (same as deals table)
CREATE POLICY "Admins can manage closing_arr_actuals"
ON public.closing_arr_actuals
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "GTM Ops can manage closing_arr_actuals"
ON public.closing_arr_actuals
FOR ALL
USING (has_role(auth.uid(), 'gtm_ops'::app_role));

CREATE POLICY "Finance can view closing_arr_actuals"
ON public.closing_arr_actuals
FOR SELECT
USING (has_role(auth.uid(), 'finance'::app_role));

CREATE POLICY "Sales head can view closing_arr_actuals"
ON public.closing_arr_actuals
FOR SELECT
USING (has_role(auth.uid(), 'sales_head'::app_role));

CREATE POLICY "Executive can view closing_arr_actuals"
ON public.closing_arr_actuals
FOR SELECT
USING (has_role(auth.uid(), 'executive'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_closing_arr_actuals_updated_at
BEFORE UPDATE ON public.closing_arr_actuals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();