
-- Add NRR configuration columns to comp_plans
ALTER TABLE public.comp_plans
  ADD COLUMN nrr_ote_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN cr_er_min_gp_margin_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN impl_min_gp_margin_pct numeric NOT NULL DEFAULT 0;

-- Create plan_spiffs table
CREATE TABLE public.plan_spiffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.comp_plans(id) ON DELETE CASCADE,
  spiff_name text NOT NULL,
  description text,
  linked_metric_name text NOT NULL,
  spiff_rate_pct numeric NOT NULL DEFAULT 0,
  min_deal_value_usd numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plan_spiffs ENABLE ROW LEVEL SECURITY;

-- RLS: Read for authenticated users
CREATE POLICY "Authenticated users can read plan_spiffs"
  ON public.plan_spiffs FOR SELECT
  TO authenticated
  USING (true);

-- RLS: Insert for admin/gtm_ops
CREATE POLICY "Admin and GTM Ops can insert plan_spiffs"
  ON public.plan_spiffs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gtm_ops')
  );

-- RLS: Update for admin/gtm_ops
CREATE POLICY "Admin and GTM Ops can update plan_spiffs"
  ON public.plan_spiffs FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gtm_ops')
  );

-- RLS: Delete for admin/gtm_ops
CREATE POLICY "Admin and GTM Ops can delete plan_spiffs"
  ON public.plan_spiffs FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gtm_ops')
  );

-- Audit trigger for plan_spiffs
CREATE TRIGGER audit_plan_spiffs_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.plan_spiffs
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
