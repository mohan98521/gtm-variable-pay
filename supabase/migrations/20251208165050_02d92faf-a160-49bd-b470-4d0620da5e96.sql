-- Add unique constraint for upsert support on performance_targets
ALTER TABLE public.performance_targets 
ADD CONSTRAINT performance_targets_employee_metric_year_unique 
UNIQUE (employee_id, metric_type, effective_year);