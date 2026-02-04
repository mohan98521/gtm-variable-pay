-- Phase A: Add PAID status to payout_runs

-- Add paid_at and paid_by columns
ALTER TABLE payout_runs 
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS paid_by uuid;

-- Add total_clawbacks_usd column for tracking clawbacks in a run
ALTER TABLE payout_runs
  ADD COLUMN IF NOT EXISTS total_clawbacks_usd numeric DEFAULT 0;