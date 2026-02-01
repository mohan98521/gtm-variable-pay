-- Add perpetual_license_usd column to deals table for explicit capture
ALTER TABLE deals ADD COLUMN perpetual_license_usd numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN deals.perpetual_license_usd IS 'Perpetual license deal value in USD for commission calculation';