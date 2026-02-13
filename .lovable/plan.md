

## Fix: Commission Payout Split Missing Year-End Percentage

### The Problem

When adding a commission with payout split **0/100/0**, the database rejects it because `payout_on_year_end_pct` is never passed from `PlanCommissionEditor.tsx` to the mutation hook. The hook then defaults it to **5**, making the total **105%** instead of 100%.

### Root Cause

In `src/components/admin/PlanCommissionEditor.tsx`, the `handleSubmit` function's type signature (line 59-66) is missing `payout_on_year_end_pct`. It only forwards `payout_on_booking_pct` and `payout_on_collection_pct` to both the create and update mutations.

### The Fix

**File: `src/components/admin/PlanCommissionEditor.tsx`**

1. Add `payout_on_year_end_pct` to the `handleSubmit` values type (line 65)
2. Pass it through in both the create mutation call (line 93) and update mutation call (line 76)

This ensures all three payout split values from the dialog form reach the database insert/update, preserving the user's intended split.

### Result

- Payout split 0/100/0 will insert correctly (sum = 100)
- Payout split 70/25/5 will continue to work
- Any valid combination summing to 100% will succeed

