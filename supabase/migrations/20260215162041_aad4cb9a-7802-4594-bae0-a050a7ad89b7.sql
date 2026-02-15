
-- Create payout_deal_details table for deal-level commission workings
CREATE TABLE public.payout_deal_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payout_run_id UUID NOT NULL REFERENCES public.payout_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL,
  deal_id UUID NOT NULL REFERENCES public.deals(id),
  project_id TEXT,
  customer_name TEXT,
  commission_type TEXT NOT NULL,
  deal_value_usd NUMERIC NOT NULL DEFAULT 0,
  gp_margin_pct NUMERIC,
  min_gp_margin_pct NUMERIC,
  commission_rate_pct NUMERIC NOT NULL DEFAULT 0,
  is_eligible BOOLEAN NOT NULL DEFAULT true,
  exclusion_reason TEXT,
  gross_commission_usd NUMERIC NOT NULL DEFAULT 0,
  booking_usd NUMERIC NOT NULL DEFAULT 0,
  collection_usd NUMERIC NOT NULL DEFAULT 0,
  year_end_usd NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_payout_deal_details_run ON public.payout_deal_details(payout_run_id);
CREATE INDEX idx_payout_deal_details_employee ON public.payout_deal_details(employee_id);
CREATE INDEX idx_payout_deal_details_deal ON public.payout_deal_details(deal_id);

-- Enable RLS
ALTER TABLE public.payout_deal_details ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as payout_metric_details - admin read/write)
CREATE POLICY "Authenticated users can view payout deal details"
  ON public.payout_deal_details FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert payout deal details"
  ON public.payout_deal_details FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete payout deal details"
  ON public.payout_deal_details FOR DELETE
  USING (auth.uid() IS NOT NULL);
