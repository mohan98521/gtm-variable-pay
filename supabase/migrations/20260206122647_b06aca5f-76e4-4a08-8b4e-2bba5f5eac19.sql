
-- Create currencies table
CREATE TABLE public.currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  symbol text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can manage currencies
CREATE POLICY "Admins can manage currencies"
ON public.currencies
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Authenticated users can view currencies
CREATE POLICY "Authenticated users can view currencies"
ON public.currencies
FOR SELECT
USING (true);

-- Seed with all currencies referenced across the codebase
INSERT INTO public.currencies (code, name, symbol) VALUES
  ('USD', 'US Dollar', '$'),
  ('INR', 'Indian Rupee', '₹'),
  ('AED', 'UAE Dirham', 'AED'),
  ('KES', 'Kenyan Shilling', 'KSh'),
  ('NGN', 'Nigerian Naira', '₦'),
  ('SAR', 'Saudi Riyal', '﷼'),
  ('MYR', 'Malaysian Ringgit', 'RM'),
  ('SGD', 'Singapore Dollar', 'S$'),
  ('IDR', 'Indonesian Rupiah', 'Rp'),
  ('LBP', 'Lebanese Pound', 'ل.ل'),
  ('GBP', 'British Pound', '£'),
  ('EUR', 'Euro', '€'),
  ('AUD', 'Australian Dollar', 'A$'),
  ('CAD', 'Canadian Dollar', 'C$'),
  ('PHP', 'Philippine Peso', '₱');
