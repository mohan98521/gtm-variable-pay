
-- Create quarterly_targets table for quarterly breakdown of performance targets
CREATE TABLE public.quarterly_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT NOT NULL,
  effective_year INTEGER NOT NULL DEFAULT 2025,
  quarter INTEGER NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
  metric_type TEXT NOT NULL,
  target_value_usd NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (employee_id, effective_year, quarter, metric_type)
);

-- Create closing_arr_targets table for Farmer roles
CREATE TABLE public.closing_arr_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT NOT NULL,
  effective_year INTEGER NOT NULL DEFAULT 2025,
  opening_arr_usd NUMERIC NOT NULL DEFAULT 0,
  software_bookings_target_usd NUMERIC NOT NULL DEFAULT 0,
  msps_bookings_target_usd NUMERIC NOT NULL DEFAULT 0,
  software_churn_allowance_usd NUMERIC NOT NULL DEFAULT 0,
  ms_churn_allowance_usd NUMERIC NOT NULL DEFAULT 0,
  net_price_increase_target_usd NUMERIC NOT NULL DEFAULT 0,
  closing_arr_target_usd NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (employee_id, effective_year)
);

-- Create commission_structures table for commission rates by role
CREATE TABLE public.commission_structures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_function TEXT NOT NULL,
  commission_type TEXT NOT NULL,
  commission_rate_pct NUMERIC NOT NULL DEFAULT 0,
  min_arr_threshold_usd NUMERIC DEFAULT NULL,
  requires_100_pct_achievement BOOLEAN NOT NULL DEFAULT false,
  effective_year INTEGER NOT NULL DEFAULT 2025,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (sales_function, commission_type, effective_year)
);

-- Create monthly_bookings table for detailed monthly actuals
CREATE TABLE public.monthly_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT NOT NULL,
  month_year DATE NOT NULL,
  booking_type TEXT NOT NULL,
  booking_value_usd NUMERIC NOT NULL DEFAULT 0,
  booking_value_local NUMERIC DEFAULT NULL,
  local_currency TEXT DEFAULT 'USD',
  tcv_value_usd NUMERIC DEFAULT NULL,
  deal_type TEXT DEFAULT NULL,
  first_year_amc_arr_usd NUMERIC DEFAULT NULL,
  deal_name TEXT DEFAULT NULL,
  client_name TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'booked',
  collection_date DATE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create monthly_payouts table to track actual payouts
CREATE TABLE public.monthly_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT NOT NULL,
  month_year DATE NOT NULL,
  payout_type TEXT NOT NULL,
  calculated_amount_usd NUMERIC NOT NULL DEFAULT 0,
  paid_amount_usd NUMERIC DEFAULT 0,
  holdback_amount_usd NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'calculated',
  paid_date DATE DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.quarterly_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closing_arr_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_payouts ENABLE ROW LEVEL SECURITY;

-- RLS policies for quarterly_targets
CREATE POLICY "Authenticated users can view quarterly_targets" ON public.quarterly_targets FOR SELECT USING (true);
CREATE POLICY "Admins can manage quarterly_targets" ON public.quarterly_targets FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "GTM Ops can manage quarterly_targets" ON public.quarterly_targets FOR ALL USING (has_role(auth.uid(), 'gtm_ops'::app_role));

-- RLS policies for closing_arr_targets
CREATE POLICY "Authenticated users can view closing_arr_targets" ON public.closing_arr_targets FOR SELECT USING (true);
CREATE POLICY "Admins can manage closing_arr_targets" ON public.closing_arr_targets FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "GTM Ops can manage closing_arr_targets" ON public.closing_arr_targets FOR ALL USING (has_role(auth.uid(), 'gtm_ops'::app_role));

-- RLS policies for commission_structures
CREATE POLICY "Authenticated users can view commission_structures" ON public.commission_structures FOR SELECT USING (true);
CREATE POLICY "Admins can manage commission_structures" ON public.commission_structures FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for monthly_bookings
CREATE POLICY "Authenticated users can view monthly_bookings" ON public.monthly_bookings FOR SELECT USING (true);
CREATE POLICY "Admins can manage monthly_bookings" ON public.monthly_bookings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "GTM Ops can manage monthly_bookings" ON public.monthly_bookings FOR ALL USING (has_role(auth.uid(), 'gtm_ops'::app_role));
CREATE POLICY "Finance can view monthly_bookings" ON public.monthly_bookings FOR SELECT USING (has_role(auth.uid(), 'finance'::app_role));

-- RLS policies for monthly_payouts
CREATE POLICY "Authenticated users can view their payouts" ON public.monthly_payouts FOR SELECT USING (true);
CREATE POLICY "Admins can manage monthly_payouts" ON public.monthly_payouts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "GTM Ops can manage monthly_payouts" ON public.monthly_payouts FOR ALL USING (has_role(auth.uid(), 'gtm_ops'::app_role));
CREATE POLICY "Finance can manage monthly_payouts" ON public.monthly_payouts FOR ALL USING (has_role(auth.uid(), 'finance'::app_role));

-- Create indexes for better performance
CREATE INDEX idx_quarterly_targets_employee ON public.quarterly_targets(employee_id);
CREATE INDEX idx_quarterly_targets_year_quarter ON public.quarterly_targets(effective_year, quarter);
CREATE INDEX idx_closing_arr_targets_employee ON public.closing_arr_targets(employee_id);
CREATE INDEX idx_monthly_bookings_employee ON public.monthly_bookings(employee_id);
CREATE INDEX idx_monthly_bookings_month ON public.monthly_bookings(month_year);
CREATE INDEX idx_monthly_payouts_employee ON public.monthly_payouts(employee_id);
CREATE INDEX idx_monthly_payouts_month ON public.monthly_payouts(month_year);

-- Create trigger for updated_at on monthly_bookings
CREATE TRIGGER update_monthly_bookings_updated_at
BEFORE UPDATE ON public.monthly_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on monthly_payouts
CREATE TRIGGER update_monthly_payouts_updated_at
BEFORE UPDATE ON public.monthly_payouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default commission structures based on the letters analyzed
INSERT INTO public.commission_structures (sales_function, commission_type, commission_rate_pct, min_arr_threshold_usd, requires_100_pct_achievement, effective_year) VALUES
-- Farmer roles
('Farmer', 'Perpetual License', 4.0, 50000, false, 2025),
('Farmer', 'Premium Support', 2.0, NULL, false, 2025),
('Farmer', 'Managed Services', 1.5, NULL, false, 2025),
-- Hunter roles
('Hunter', 'Perpetual License', 4.0, 50000, false, 2025),
('Hunter', 'Premium Support', 2.0, NULL, false, 2025),
('Hunter', 'Managed Services', 1.5, NULL, false, 2025),
-- Sales Head roles
('Sales head - Farmer', 'Perpetual License', 4.0, 50000, false, 2025),
('Sales head - Farmer', 'Premium Support', 2.0, NULL, false, 2025),
('Sales head - Farmer', 'Managed Services', 1.5, NULL, false, 2025),
('Sales Head - Hunter', 'Perpetual License', 4.0, 50000, false, 2025),
('Sales Head - Hunter', 'Premium Support', 2.0, NULL, false, 2025),
('Sales Head - Hunter', 'Managed Services', 1.5, NULL, false, 2025);
