
-- Add multi-year renewal columns to closing_arr_actuals
ALTER TABLE public.closing_arr_actuals
  ADD COLUMN is_multi_year boolean NOT NULL DEFAULT false,
  ADD COLUMN renewal_years integer NOT NULL DEFAULT 1;

-- Create renewal multipliers table
CREATE TABLE public.closing_arr_renewal_multipliers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.comp_plans(id) ON DELETE CASCADE,
  min_years integer NOT NULL,
  max_years integer,
  multiplier_value numeric NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.closing_arr_renewal_multipliers ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can read renewal multipliers"
  ON public.closing_arr_renewal_multipliers FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert renewal multipliers"
  ON public.closing_arr_renewal_multipliers FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update renewal multipliers"
  ON public.closing_arr_renewal_multipliers FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete renewal multipliers"
  ON public.closing_arr_renewal_multipliers FOR DELETE
  TO authenticated USING (true);
