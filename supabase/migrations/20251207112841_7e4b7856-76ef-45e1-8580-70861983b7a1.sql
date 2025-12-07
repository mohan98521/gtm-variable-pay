-- Create performance_targets table for sales quotas
CREATE TABLE public.performance_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  target_value_usd NUMERIC NOT NULL DEFAULT 0,
  effective_year INTEGER NOT NULL DEFAULT 2025,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.performance_targets ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage performance_targets"
ON public.performance_targets FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view performance_targets"
ON public.performance_targets FOR SELECT
USING (true);

-- Index for efficient lookups
CREATE INDEX idx_performance_targets_employee ON public.performance_targets(employee_id);
CREATE INDEX idx_performance_targets_metric ON public.performance_targets(metric_type);