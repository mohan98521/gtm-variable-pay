-- Allow NULL values on the symbol column
ALTER TABLE public.currencies ALTER COLUMN symbol DROP NOT NULL;
ALTER TABLE public.currencies ALTER COLUMN symbol SET DEFAULT '';