-- Add year-end payout split to plan_metrics
ALTER TABLE plan_metrics 
ADD COLUMN payout_on_year_end_pct numeric DEFAULT 0;

-- Add year-end payout split to plan_commissions
ALTER TABLE plan_commissions 
ADD COLUMN payout_on_year_end_pct numeric DEFAULT 0;

-- Add constraint to ensure three-way split sums to 100% for plan_metrics
ALTER TABLE plan_metrics 
ADD CONSTRAINT plan_metrics_payout_split_check 
CHECK (COALESCE(payout_on_booking_pct, 75) + COALESCE(payout_on_collection_pct, 25) + COALESCE(payout_on_year_end_pct, 0) = 100);

-- Add constraint to ensure three-way split sums to 100% for plan_commissions
ALTER TABLE plan_commissions 
ADD CONSTRAINT plan_commissions_payout_split_check 
CHECK (COALESCE(payout_on_booking_pct, 75) + COALESCE(payout_on_collection_pct, 25) + COALESCE(payout_on_year_end_pct, 0) = 100);