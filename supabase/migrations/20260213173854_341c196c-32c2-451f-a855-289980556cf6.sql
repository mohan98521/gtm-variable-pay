
-- Issue 1: Rewrite check_collection_month_lock to check collection_month instead of booking_month
CREATE OR REPLACE FUNCTION public.check_collection_month_lock()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check when collection-related fields are being modified
  IF (TG_OP = 'UPDATE') THEN
    -- If the collection_month being set matches a locked payout run, block the update
    IF NEW.collection_month IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.payout_runs
        WHERE month_year = NEW.collection_month
        AND is_locked = true
      ) THEN
        RAISE EXCEPTION 'Cannot update collection: the collection month (%) is in a locked payout month. Use payout adjustments for corrections.', NEW.collection_month;
      END IF;
    END IF;

    -- If clearing collection (un-collecting), check if the OLD collection_month is locked
    IF OLD.collection_month IS NOT NULL AND NEW.is_collected = false THEN
      IF EXISTS (
        SELECT 1 FROM public.payout_runs
        WHERE month_year = OLD.collection_month
        AND is_locked = true
      ) THEN
        RAISE EXCEPTION 'Cannot revert collection: the original collection month (%) is in a locked payout month. Use payout adjustments for corrections.', OLD.collection_month;
      END IF;
    END IF;

    -- If triggering clawback, check the collection_month or booking_month is not locked
    IF NEW.is_clawback_triggered = true AND OLD.is_clawback_triggered = false THEN
      -- Clawbacks should only be blocked if the month they'd be applied to is locked
      -- The clawback is applied to the current/future month, so we don't block here
      -- The payout engine will handle this at the payout_runs level
      NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Issue 4: Create clawback_ledger table for carry-forward tracking
CREATE TABLE IF NOT EXISTS public.clawback_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  deal_id UUID NOT NULL REFERENCES public.deals(id),
  deal_collection_id UUID NOT NULL REFERENCES public.deal_collections(id),
  original_amount_usd NUMERIC NOT NULL DEFAULT 0,
  recovered_amount_usd NUMERIC NOT NULL DEFAULT 0,
  remaining_amount_usd NUMERIC GENERATED ALWAYS AS (original_amount_usd - recovered_amount_usd) STORED,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'recovered', 'written_off')),
  triggered_month DATE NOT NULL,
  last_recovery_month DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clawback_ledger ENABLE ROW LEVEL SECURITY;

-- RLS policies - admin/staff can read all, system manages writes
CREATE POLICY "Authenticated users can view clawback ledger"
  ON public.clawback_ledger
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert clawback ledger"
  ON public.clawback_ledger
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update clawback ledger"
  ON public.clawback_ledger
  FOR UPDATE
  TO authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_clawback_ledger_updated_at
  BEFORE UPDATE ON public.clawback_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for efficient lookups
CREATE INDEX idx_clawback_ledger_employee_status ON public.clawback_ledger(employee_id, status);
CREATE INDEX idx_clawback_ledger_deal_collection ON public.clawback_ledger(deal_collection_id);
