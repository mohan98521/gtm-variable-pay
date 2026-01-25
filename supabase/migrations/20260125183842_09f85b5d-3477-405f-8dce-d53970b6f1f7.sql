-- Create deals table for deal-level actuals tracking
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL UNIQUE,
  deal_name text NOT NULL,
  client_name text NOT NULL,
  metric_type text NOT NULL,
  month_year date NOT NULL,
  deal_value_usd numeric NOT NULL DEFAULT 0,
  deal_value_local numeric,
  local_currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create deal_participants table for tracking multiple sales participants per deal
CREATE TABLE public.deal_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  employee_id text NOT NULL,
  participant_role text NOT NULL,
  split_percent numeric NOT NULL DEFAULT 100,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT valid_participant_role CHECK (participant_role IN ('sales_rep', 'sales_head', 'se', 'channel_rep', 'product_specialist')),
  CONSTRAINT valid_split_percent CHECK (split_percent >= 0 AND split_percent <= 100)
);

-- Create indexes for better query performance
CREATE INDEX idx_deals_month_year ON public.deals(month_year);
CREATE INDEX idx_deals_metric_type ON public.deals(metric_type);
CREATE INDEX idx_deals_status ON public.deals(status);
CREATE INDEX idx_deal_participants_deal_id ON public.deal_participants(deal_id);
CREATE INDEX idx_deal_participants_employee_id ON public.deal_participants(employee_id);

-- Enable RLS on both tables
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deals table
CREATE POLICY "Admins can manage deals"
  ON public.deals
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "GTM Ops can manage deals"
  ON public.deals
  FOR ALL
  USING (has_role(auth.uid(), 'gtm_ops'::app_role));

CREATE POLICY "Finance can view deals"
  ON public.deals
  FOR SELECT
  USING (has_role(auth.uid(), 'finance'::app_role));

CREATE POLICY "Executive can view deals"
  ON public.deals
  FOR SELECT
  USING (has_role(auth.uid(), 'executive'::app_role));

CREATE POLICY "Sales head can view deals"
  ON public.deals
  FOR SELECT
  USING (has_role(auth.uid(), 'sales_head'::app_role));

-- RLS Policies for deal_participants table
CREATE POLICY "Admins can manage deal_participants"
  ON public.deal_participants
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "GTM Ops can manage deal_participants"
  ON public.deal_participants
  FOR ALL
  USING (has_role(auth.uid(), 'gtm_ops'::app_role));

CREATE POLICY "Finance can view deal_participants"
  ON public.deal_participants
  FOR SELECT
  USING (has_role(auth.uid(), 'finance'::app_role));

CREATE POLICY "Executive can view deal_participants"
  ON public.deal_participants
  FOR SELECT
  USING (has_role(auth.uid(), 'executive'::app_role));

CREATE POLICY "Sales head can view deal_participants"
  ON public.deal_participants
  FOR SELECT
  USING (has_role(auth.uid(), 'sales_head'::app_role));

-- Create trigger for updated_at on deals table
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();