
-- Add payout split columns to comp_plans for NRR
ALTER TABLE public.comp_plans
  ADD COLUMN nrr_payout_on_booking_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN nrr_payout_on_collection_pct numeric NOT NULL DEFAULT 100,
  ADD COLUMN nrr_payout_on_year_end_pct numeric NOT NULL DEFAULT 0;

-- Add payout split columns to plan_spiffs
ALTER TABLE public.plan_spiffs
  ADD COLUMN payout_on_booking_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN payout_on_collection_pct numeric NOT NULL DEFAULT 100,
  ADD COLUMN payout_on_year_end_pct numeric NOT NULL DEFAULT 0;
