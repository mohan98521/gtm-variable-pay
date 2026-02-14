
-- =============================================
-- F&F Settlements tables
-- =============================================

CREATE TABLE public.fnf_settlements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id text NOT NULL,
  departure_date date NOT NULL,
  fiscal_year integer NOT NULL,
  collection_grace_days integer NOT NULL DEFAULT 90,
  tranche1_status text NOT NULL DEFAULT 'draft',
  tranche1_total_usd numeric DEFAULT 0,
  tranche1_calculated_at timestamptz,
  tranche1_finalized_at timestamptz,
  tranche2_status text NOT NULL DEFAULT 'pending',
  tranche2_eligible_date date,
  tranche2_total_usd numeric DEFAULT 0,
  tranche2_calculated_at timestamptz,
  tranche2_finalized_at timestamptz,
  clawback_carryforward_usd numeric DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fnf_settlement_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  settlement_id uuid NOT NULL REFERENCES public.fnf_settlements(id) ON DELETE CASCADE,
  tranche integer NOT NULL,
  line_type text NOT NULL,
  payout_type text,
  amount_usd numeric NOT NULL DEFAULT 0,
  amount_local numeric DEFAULT 0,
  local_currency text DEFAULT 'USD',
  exchange_rate_used numeric DEFAULT 1,
  deal_id uuid,
  source_payout_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fnf_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fnf_settlement_lines ENABLE ROW LEVEL SECURITY;

-- RLS for fnf_settlements: admin/finance/gtm_ops can manage
CREATE POLICY "fnf_manage" ON public.fnf_settlements FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY(ARRAY['admin','finance','gtm_ops'])
  ));

-- Read-only for finalized/paid
CREATE POLICY "fnf_view_finalized" ON public.fnf_settlements FOR SELECT
  USING (tranche1_status = ANY(ARRAY['finalized','paid']));

-- RLS for fnf_settlement_lines: same as parent
CREATE POLICY "fnfl_manage" ON public.fnf_settlement_lines FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY(ARRAY['admin','finance','gtm_ops'])
  ));

CREATE POLICY "fnfl_view_finalized" ON public.fnf_settlement_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM fnf_settlements s
    WHERE s.id = fnf_settlement_lines.settlement_id
    AND s.tranche1_status = ANY(ARRAY['finalized','paid'])
  ));

-- Updated_at trigger
CREATE TRIGGER update_fnf_settlements_updated_at
  BEFORE UPDATE ON public.fnf_settlements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default permissions for fnf_settlements tab
INSERT INTO public.role_permissions (role, permission_key, is_allowed)
SELECT r.name, 'tab:fnf_settlements', 
  CASE WHEN r.name IN ('admin','finance','gtm_ops') THEN true ELSE false END
FROM public.roles r
ON CONFLICT DO NOTHING;
