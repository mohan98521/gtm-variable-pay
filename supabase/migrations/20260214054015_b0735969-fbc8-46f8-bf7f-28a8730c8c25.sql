
-- Create employee_change_log table for tracking compensation changes
CREATE TABLE public.employee_change_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES auth.users(id),
  change_type TEXT NOT NULL CHECK (change_type IN ('hike', 'promotion', 'transfer', 'correction', 'new_joiner', 'departure')),
  change_reason TEXT,
  field_changes JSONB NOT NULL DEFAULT '{}',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Enable RLS
ALTER TABLE public.employee_change_log ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can read (admin/finance/gtm_ops filtering done in app)
CREATE POLICY "Authenticated users can read employee change log"
  ON public.employee_change_log FOR SELECT
  TO authenticated
  USING (true);

-- RLS: Authenticated users can insert
CREATE POLICY "Authenticated users can insert employee change log"
  ON public.employee_change_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_employee_change_log_employee_id ON public.employee_change_log(employee_id);
CREATE INDEX idx_employee_change_log_effective_date ON public.employee_change_log(effective_date);
