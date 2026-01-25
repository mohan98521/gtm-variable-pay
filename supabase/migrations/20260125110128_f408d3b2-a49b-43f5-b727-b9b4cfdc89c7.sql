-- Add new columns to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS departure_date date,
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS region text;