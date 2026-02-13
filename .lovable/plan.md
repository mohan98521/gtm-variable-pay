

## Broken Systems Identified in Payout Engine

After a comprehensive audit of `payoutEngine.ts`, `useCollections.ts`, and related calculation modules, here are the issues found:

---

### Issue 1: NRR and SPIFF Payouts Are Double-Counted Every Month (CRITICAL)

**Problem**: Variable Pay correctly uses incremental logic -- it calculates YTD total, then subtracts the sum of prior finalized months to get the monthly increment. NRR Additional Pay and SPIFF payouts do NOT do this. They calculate the full YTD amount every month and persist it as the month's payout.

**Example**: If an employee's YTD SPIFF payout is $5,000 by March:
- January run: $2,000 (correct)
- February run: $3,500 YTD (should pay $1,500 incremental, currently pays $3,500)
- March run: $5,000 YTD (should pay $1,500 incremental, currently pays $5,000)
- Total paid: $10,500 instead of $5,000

**Fix**: Add `getPriorMonthsNrr` and `getPriorMonthsSpiff` functions (mirroring the existing `getPriorMonthsVp` pattern). Subtract prior months' NRR and SPIFF totals from the YTD calculation before persisting.

**File**: `src/lib/payoutEngine.ts`

---

### Issue 2: Clawback Carry-Forward Recovery Is Never Applied (CRITICAL)

**Problem**: The `applyClawbackRecoveries()` function was created to deduct outstanding clawback ledger balances from an employee's payable amount. However, it is **never called** anywhere in the calculation pipeline. The function exists but `calculateMonthlyPayout` and `executePayoutCalculation` both skip it entirely. The `payableThisMonthUsd` is calculated without any clawback ledger deduction.

**Impact**: If a clawback exceeds the employee's earnings in the trigger month, the unrecovered balance sits in the ledger forever and is never deducted from future payouts.

**Fix**: Call `applyClawbackRecoveries(employee.id, payableThisMonthUsd, monthYear)` inside `calculateMonthlyPayout` before returning the final result. Use the adjusted amount for `payableThisMonthUsd`. Store the recovery amount for audit trail purposes.

**File**: `src/lib/payoutEngine.ts`

---

### Issue 3: Commission Collection Releases Are Always $0 (MAJOR)

**Problem**: When a deal is collected, the engine tries to release commission holdbacks by querying `monthly_payouts` records filtered by `.in('deal_id', collectedDealIds)`. However, commission payout records are persisted **without a `deal_id`** -- they are aggregated by commission type (e.g., "Managed Services", "Implementation"). Since `deal_id` is never set on commission records, the filter `.in('deal_id', collectedDealIds)` matches nothing.

**Result**: Commission holdbacks (the "Upon Collection" portion) are never released, even when the deal is collected and the employee is owed that money.

**Fix**: Two options:
- **Option A** (Recommended): Persist commission records per-deal (with `deal_id`) instead of aggregating by type. This enables correct collection release matching.
- **Option B**: Change the commission release query to look up commission holdback amounts from `deal_variable_pay_attribution` or a dedicated commission holdback tracking table instead of relying on `deal_id` in `monthly_payouts`.

**File**: `src/lib/payoutEngine.ts` (both `persistPayoutResults` and `calculateCollectionReleases`)

---

### Issue 4: Bulk Update Hook Missing `collection_month` (MINOR)

**Problem**: The `useBulkUpdateCollections` mutation in `useCollections.ts` does not derive or set the `collection_month` field from `collection_date`. The single-record `useUpdateCollectionStatus` and `useBulkImportCollections` both correctly calculate `collection_month = format(parseISO(collection_date), "yyyy-MM-01")`, but the bulk update skips this.

**Impact**: Deals updated via bulk operations may have no `collection_month`, causing the payout engine to miss them when calculating collection releases (since it queries by `collection_month`).

**Fix**: Add `collection_month` derivation to `useBulkUpdateCollections`, matching the pattern already used in the other two mutations.

**File**: `src/hooks/useCollections.ts`

---

### Summary

| # | Issue | Severity | Impact |
|---|---|---|---|
| 1 | NRR/SPIFF double-counted monthly | Critical | Overpayment -- employees paid full YTD amount every month |
| 2 | Clawback carry-forward never applied | Critical | Unrecovered clawbacks never deducted from future payouts |
| 3 | Commission holdbacks never released | Major | Employees never receive commission collection portion |
| 4 | Bulk update missing collection_month | Minor | Bulk-updated collections invisible to payout engine |

### Implementation Plan

1. Add `getPriorMonthsNrr()` and `getPriorMonthsSpiff()` helper functions
2. Apply incremental logic to NRR and SPIFF in `calculateMonthlyPayout`
3. Integrate `applyClawbackRecoveries()` call into the payable calculation flow
4. Persist commission records per-deal with `deal_id` for correct collection release
5. Add `collection_month` derivation to `useBulkUpdateCollections`

All changes are in two files: `src/lib/payoutEngine.ts` and `src/hooks/useCollections.ts`.

