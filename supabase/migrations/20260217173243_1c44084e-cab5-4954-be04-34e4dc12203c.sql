
CREATE TABLE public.closing_arr_payout_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id uuid NOT NULL,
  employee_id text NOT NULL,
  closing_arr_actual_id uuid NOT NULL,
  pid text NOT NULL,
  customer_name text,
  customer_code text,
  bu text,
  product text,
  month_year date,
  end_date date,
  is_multi_year boolean NOT NULL DEFAULT false,
  renewal_years integer NOT NULL DEFAULT 1,
  closing_arr_usd numeric NOT NULL DEFAULT 0,
  multiplier numeric NOT NULL DEFAULT 1.0,
  adjusted_arr_usd numeric NOT NULL DEFAULT 0,
  is_eligible boolean NOT NULL DEFAULT true,
  exclusion_reason text,
  order_category_2 text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.closing_arr_payout_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capd_manage" ON public.closing_arr_payout_details
  FOR ALL USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'finance') OR
    has_role(auth.uid(), 'gtm_ops')
  );

CREATE POLICY "capd_own_view" ON public.closing_arr_payout_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.employee_id IS NOT NULL
        AND closing_arr_payout_details.employee_id = p.employee_id
    )
  );

CREATE INDEX idx_capd_payout_run ON public.closing_arr_payout_details(payout_run_id);
CREATE INDEX idx_capd_employee ON public.closing_arr_payout_details(employee_id);
