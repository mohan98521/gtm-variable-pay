
## Reset Jan 2026 Payout Run to Draft

### What Will Happen

The January 2026 payout run (currently **Finalized** and locked) will be pushed back to **Draft** status so you can make changes before re-running it.

### Changes

A one-time database migration will:

1. Set `run_status` back to `draft`
2. Unlock the month (`is_locked = false`)
3. Clear all workflow timestamps: `calculated_at`, `reviewed_at`, `approved_at`, `finalized_at` and corresponding `_by` fields
4. Clear the totals so they get recalculated on the next run

This will also unlock the month-lock, allowing you to edit deals, collections, and closing ARR data for January 2026 again.

### Technical Details

| Item | Detail |
|------|--------|
| Table | `payout_runs` |
| Record ID | `b162977c-c084-487a-9543-8aff08113290` |
| Current Status | `finalized` (locked) |
| Target Status | `draft` (unlocked) |

**SQL migration:**
```text
UPDATE public.payout_runs
SET run_status = 'draft',
    is_locked = false,
    total_payout_usd = NULL,
    total_variable_pay_usd = NULL,
    total_commissions_usd = NULL,
    total_clawbacks_usd = NULL,
    calculated_at = NULL, calculated_by = NULL,
    reviewed_at = NULL,  reviewed_by = NULL,
    approved_at = NULL,  approved_by = NULL,
    finalized_at = NULL, finalized_by = NULL,
    paid_at = NULL,      paid_by = NULL,
    updated_at = now()
WHERE id = 'b162977c-c084-487a-9543-8aff08113290';
```

No code file changes are needed -- this is purely a data update.
