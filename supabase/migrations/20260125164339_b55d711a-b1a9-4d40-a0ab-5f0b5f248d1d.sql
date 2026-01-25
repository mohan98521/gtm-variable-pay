-- Create plan_commissions table
CREATE TABLE public.plan_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.comp_plans(id) ON DELETE CASCADE,
  commission_type TEXT NOT NULL,
  commission_rate_pct NUMERIC NOT NULL DEFAULT 0,
  min_threshold_usd NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plan_id, commission_type)
);

-- Enable RLS
ALTER TABLE public.plan_commissions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view plan_commissions"
  ON public.plan_commissions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage plan_commissions"
  ON public.plan_commissions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed Farmer 2026 plan with placeholder commissions
-- First get the plan ID for Farmer 2026
INSERT INTO public.plan_commissions (plan_id, commission_type, commission_rate_pct, min_threshold_usd, is_active)
SELECT 
  id as plan_id,
  unnest(ARRAY['Managed Services', 'Perpetual License', 'CR/ER', 'Implementation']) as commission_type,
  unnest(ARRAY[1.5, 4.0, 0, 0]::numeric[]) as commission_rate_pct,
  unnest(ARRAY[NULL, 50000, NULL, NULL]::numeric[]) as min_threshold_usd,
  true as is_active
FROM public.comp_plans
WHERE name = 'Farmer 2026';