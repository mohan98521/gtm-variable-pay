
CREATE TABLE public.payout_metric_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payout_run_id UUID NOT NULL REFERENCES public.payout_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  component_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  plan_id UUID REFERENCES public.comp_plans(id),
  plan_name TEXT,
  target_bonus_usd NUMERIC DEFAULT 0,
  allocated_ote_usd NUMERIC DEFAULT 0,
  target_usd NUMERIC DEFAULT 0,
  actual_usd NUMERIC DEFAULT 0,
  achievement_pct NUMERIC DEFAULT 0,
  multiplier NUMERIC DEFAULT 0,
  ytd_eligible_usd NUMERIC DEFAULT 0,
  prior_paid_usd NUMERIC DEFAULT 0,
  this_month_usd NUMERIC DEFAULT 0,
  booking_usd NUMERIC DEFAULT 0,
  collection_usd NUMERIC DEFAULT 0,
  year_end_usd NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_payout_metric_details_run ON public.payout_metric_details(payout_run_id);
CREATE INDEX idx_payout_metric_details_employee ON public.payout_metric_details(employee_id);

-- Enable RLS
ALTER TABLE public.payout_metric_details ENABLE ROW LEVEL SECURITY;

-- Policies matching existing payout tables pattern
CREATE POLICY "Authenticated users can view payout metric details"
  ON public.payout_metric_details FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert payout metric details"
  ON public.payout_metric_details FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete payout metric details"
  ON public.payout_metric_details FOR DELETE
  USING (auth.role() = 'authenticated');
