
-- Deal Team SPIFF Allocations table
CREATE TABLE public.deal_team_spiff_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid NOT NULL REFERENCES public.deals(id),
  employee_id text NOT NULL,
  allocated_amount_usd numeric NOT NULL DEFAULT 0,
  allocated_amount_local numeric NOT NULL DEFAULT 0,
  local_currency text NOT NULL DEFAULT 'USD',
  exchange_rate_used numeric NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  notes text,
  payout_month date NOT NULL,
  payout_run_id uuid REFERENCES public.payout_runs(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Deal Team SPIFF Config table
CREATE TABLE public.deal_team_spiff_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  spiff_pool_amount_usd numeric NOT NULL DEFAULT 10000,
  min_deal_arr_usd numeric NOT NULL DEFAULT 400000,
  is_active boolean NOT NULL DEFAULT true,
  exclude_roles text[] NOT NULL DEFAULT ARRAY['sales_rep', 'sales_head'],
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default config
INSERT INTO public.deal_team_spiff_config (spiff_pool_amount_usd, min_deal_arr_usd, is_active, exclude_roles)
VALUES (10000, 400000, true, ARRAY['sales_rep', 'sales_head']);

-- Enable RLS
ALTER TABLE public.deal_team_spiff_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_team_spiff_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for allocations (admin-only matching existing payout tables pattern)
CREATE POLICY "Authenticated users can read deal team spiff allocations"
  ON public.deal_team_spiff_allocations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert deal team spiff allocations"
  ON public.deal_team_spiff_allocations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update deal team spiff allocations"
  ON public.deal_team_spiff_allocations FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete deal team spiff allocations"
  ON public.deal_team_spiff_allocations FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- RLS policies for config
CREATE POLICY "Authenticated users can read deal team spiff config"
  ON public.deal_team_spiff_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update deal team spiff config"
  ON public.deal_team_spiff_config FOR UPDATE
  USING (auth.uid() IS NOT NULL);
