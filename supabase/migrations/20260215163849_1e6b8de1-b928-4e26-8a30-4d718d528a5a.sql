ALTER TABLE public.payout_deal_details 
  ADD COLUMN component_type TEXT NOT NULL DEFAULT 'commission';