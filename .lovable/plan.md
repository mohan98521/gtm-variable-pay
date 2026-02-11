
# Plan: Fix Duplicate Payout Records and Ensure Correct Totals

## Root Cause

The `persistPayoutResults` function in `src/lib/payoutEngine.ts` (lines 1029-1033) deletes existing records before inserting new ones:

```typescript
await supabase
  .from('monthly_payouts')
  .delete()
  .eq('payout_run_id', payoutRunId)
  .neq('payout_type', 'Clawback');
```

This delete is silently failing (likely due to RLS policies or race conditions from rapid re-calculations), leaving old records in place while new ones are added. The result: every re-calculation **doubles** the amounts.

**Evidence from the database:**
- "Farming Sales Rep" has 2 VP records ($29,195.24 each) and 3 Managed Services records ($1,603.13 each) -- all with the same `payout_run_id`
- Records were created at 3 different timestamps (Feb 9 18:17, Feb 9 18:23, Feb 11 02:49), confirming multiple calculation runs stacked on top of each other
- 7+ employees across the system have duplicate VP records

## Fix

### Change 1: Use upsert or delete-with-verification in `persistPayoutResults`

**File:** `src/lib/payoutEngine.ts` (lines 1022-1147)

Replace the delete-then-insert pattern with a more robust approach:

1. **Verify the delete actually removed rows** before inserting. Check the response from the delete call.
2. **Add a safety check**: if delete returns no rows affected and records exist, use a direct RPC call or alternative delete approach.
3. **Add a debounce/lock** mechanism: before starting calculation, check if a calculation is already in progress for this run (e.g., set a `calculating` flag on the payout_run record).

Specifically:
- After the delete call, query to verify records were actually deleted
- If records still exist, throw an error rather than silently inserting duplicates
- Add a `calculating` status check at the start of `runPayoutCalculation` to prevent concurrent runs

### Change 2: Add calculation lock to `runPayoutCalculation`

**File:** `src/lib/payoutEngine.ts` (around line 955)

At the start of `runPayoutCalculation`:
- Update the payout_run status to 'calculating' with a CAS (compare-and-swap) pattern
- Only proceed if the update succeeds (meaning no other calculation is running)
- Reset status if calculation fails

### Change 3: Disable Calculate button while running

**File:** `src/components/admin/PayoutRunManagement.tsx`

- Track a `isCalculating` state
- Disable the Calculate button while computation is in progress
- Show a loading indicator during calculation

### Change 4: Clean up existing duplicate data

After the code fix, the next calculation run will properly delete old records. But for immediate cleanup, I'll add logic to deduplicate on read in the `useEmployeePayoutBreakdown` hook as a safety net.

**File:** `src/hooks/useMonthlyPayouts.ts`

- When aggregating payout records, deduplicate by (employee_id, payout_type, payout_run_id) taking only the latest record by `created_at`

## Technical Details

### Files to Change

| File | Changes |
|------|---------|
| `src/lib/payoutEngine.ts` | 1. Add delete verification (check response, retry or error if delete fails). 2. Add concurrent calculation prevention (status lock). 3. Wrap delete+insert in a transaction-like pattern. |
| `src/hooks/useMonthlyPayouts.ts` | Add deduplication safety net when aggregating records. |
| `src/components/admin/PayoutRunManagement.tsx` | Disable Calculate button during active calculation. |

### Calculation Verification

After fixing duplicates, the correct values for "Farming Sales Rep" (DU0001) for Jan 2026 would be:

| Component | Amount (USD) |
|-----------|-------------|
| VP (New Software Booking ARR) | $29,195.24 |
| VP (Closing ARR - gated at 11.33% < 85%) | $0.00 |
| Commission (Managed Services: $106,875 x 1.5%) | $1,603.13 |
| **Total Eligible** | **$30,798.37** |
| Upon Booking (VP: 75% = $21,896) | $21,896.44 |
| Upon Collection (VP: 25% = $7,299 + Comm: 100% = $1,603) | $8,901.94 |
| At Year End | $0.00 |
| **Payable This Month** | **$21,896.44** |

### Expected Outcome

- No duplicate records in monthly_payouts
- Calculate button cannot be clicked while a calculation is running
- Totals reflect single, correct calculation per employee
- Safety net prevents inflated totals even if duplicates somehow occur
