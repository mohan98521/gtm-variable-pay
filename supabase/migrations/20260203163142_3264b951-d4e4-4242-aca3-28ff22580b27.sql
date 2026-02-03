-- Create deal_variable_pay_attribution table for pro-rata variable pay allocation
CREATE TABLE public.deal_variable_pay_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  plan_id UUID REFERENCES comp_plans(id),
  fiscal_year INTEGER NOT NULL,
  calculation_month DATE NOT NULL,
  
  -- Metric context
  metric_name TEXT NOT NULL,
  deal_value_usd NUMERIC NOT NULL,
  
  -- Aggregate context at calculation time
  total_actual_usd NUMERIC NOT NULL,
  target_usd NUMERIC NOT NULL,
  achievement_pct NUMERIC NOT NULL,
  multiplier NUMERIC NOT NULL,
  total_variable_pay_usd NUMERIC NOT NULL,
  
  -- Pro-rata allocation
  proportion_pct NUMERIC NOT NULL,
  variable_pay_split_usd NUMERIC NOT NULL,
  
  -- Payout split (from plan_metrics config)
  payout_on_booking_usd NUMERIC NOT NULL,
  payout_on_collection_usd NUMERIC NOT NULL,
  payout_on_year_end_usd NUMERIC NOT NULL,
  
  -- Clawback tracking
  clawback_eligible_usd NUMERIC NOT NULL,
  is_clawback_triggered BOOLEAN DEFAULT FALSE,
  clawback_amount_usd NUMERIC DEFAULT 0,
  clawback_date DATE,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(deal_id, employee_id, metric_name, fiscal_year)
);

-- Enable RLS
ALTER TABLE public.deal_variable_pay_attribution ENABLE ROW LEVEL SECURITY;

-- Create indexes for efficient lookups
CREATE INDEX idx_deal_vp_attribution_employee 
  ON deal_variable_pay_attribution(employee_id, fiscal_year);
CREATE INDEX idx_deal_vp_attribution_deal 
  ON deal_variable_pay_attribution(deal_id);
CREATE INDEX idx_deal_vp_attribution_month
  ON deal_variable_pay_attribution(calculation_month);

-- RLS Policies

-- Admins can manage all attributions
CREATE POLICY "Admins can manage deal_variable_pay_attribution"
  ON deal_variable_pay_attribution
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- GTM Ops can manage all attributions
CREATE POLICY "GTM Ops can manage deal_variable_pay_attribution"
  ON deal_variable_pay_attribution
  FOR ALL
  USING (has_role(auth.uid(), 'gtm_ops'::app_role));

-- Finance can view all attributions
CREATE POLICY "Finance can view deal_variable_pay_attribution"
  ON deal_variable_pay_attribution
  FOR SELECT
  USING (has_role(auth.uid(), 'finance'::app_role));

-- Executive can view all attributions
CREATE POLICY "Executive can view deal_variable_pay_attribution"
  ON deal_variable_pay_attribution
  FOR SELECT
  USING (has_role(auth.uid(), 'executive'::app_role));

-- Sales Head can view their own and team attributions
CREATE POLICY "Sales head can view deal_variable_pay_attribution"
  ON deal_variable_pay_attribution
  FOR SELECT
  USING (has_role(auth.uid(), 'sales_head'::app_role));

-- Sales Rep can view their own attributions
CREATE POLICY "Sales rep can view their attributions"
  ON deal_variable_pay_attribution
  FOR SELECT
  USING (
    has_role(auth.uid(), 'sales_rep'::app_role) 
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
        AND p.employee_id IS NOT NULL
        AND deal_variable_pay_attribution.employee_id = p.employee_id
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_deal_vp_attribution_updated_at
  BEFORE UPDATE ON deal_variable_pay_attribution
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();