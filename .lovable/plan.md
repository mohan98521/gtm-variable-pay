

## Optimize Payout Engine Performance

### Root Cause

The payout engine processes each employee **sequentially**, and each employee triggers **20-30 individual database queries** (plan assignment, blended pro-rata, metrics, commissions, exchange rates, deals, closing ARR, prior months VP/NRR/SPIFF, collections, clawbacks, SPIFF configs, performance targets, etc.). With 30 employees, that's 600-900 sequential round-trips to the database.

For 1,000 deals and 2,000 Closing ARR rows, the data volume itself is manageable, but the **query count per employee** is the bottleneck -- each round-trip adds ~50-150ms of network latency.

### Optimization Strategy

Two complementary approaches:

#### 1. Prefetch shared/bulk data before the employee loop

Instead of each employee independently querying the same tables (deals, closing ARR, performance targets, exchange rates, plan configs), fetch all required data **once** upfront and pass it into the per-employee calculation.

**Data to prefetch (single queries):**

| Data | Current | After |
|---|---|---|
| All deals (fiscal year) | 1 query per employee per metric | 1 bulk query total |
| Closing ARR actuals | 1 query per employee | 1 bulk query total |
| Performance targets | 2-4 queries per employee (per metric + NRR + SPIFF) | 1 bulk query total |
| Exchange rates | 1 query per employee | 1 bulk query total |
| Plan assignments (user_targets + comp_plans) | 2 queries per employee | 1 bulk query total |
| Plan metrics + multiplier grids | 1 query per employee | 1 bulk query total (grouped by plan) |
| Plan commissions | 1 query per employee | 1 bulk query total |
| Plan spiffs | 1 query per employee | 1 bulk query total |
| Prior month payouts | 3 queries per employee (VP, NRR, SPIFF) | 1 bulk query total |
| Deal collections | 1 query per employee | 1 bulk query total |
| Support team memberships | 1 query per employee | 1 bulk query total |
| Deal team SPIFF allocations | 1 query per employee | 1 bulk query total |
| Clawback ledger | 1 query per employee | 1 bulk query total |
| Renewal multipliers | 1 query per employee per plan | 1 bulk query total |

This reduces ~25 queries/employee to **~15 prefetch queries total** + ~2-3 per employee (for remaining employee-specific lookups that are hard to bulk).

#### 2. Parallel employee processing

After prefetching, process employees in **parallel batches of 5** using `Promise.all`. Since each employee's calculation is now mostly in-memory (filtering prefetched data), this provides further speedup.

#### 3. Progress feedback

Add a progress callback to `runPayoutCalculation` so the UI can show "Processing employee 12/30..." instead of appearing frozen. The `PayoutRunManagement` component will display a progress bar during calculation.

### Expected Impact

| Scenario | Current (est.) | After (est.) |
|---|---|---|
| 30 employees, 200 deals | ~45-90 seconds | ~5-10 seconds |
| 50 employees, 1000 deals, 2000 ARR rows | ~120-250 seconds | ~10-20 seconds |

### Technical Details

**Files to modify:**

1. **`src/lib/payoutEngine.ts`** -- Main changes:
   - Add a `PrefetchedData` interface containing all bulk-fetched data
   - Add `prefetchPayoutData(monthYear, fiscalYear)` function that runs ~15 queries and returns the prefetched data object
   - Modify `calculateMonthlyPayout` to accept `PrefetchedData` and filter in-memory instead of querying
   - Modify `calculateEmployeeVariablePay` and `calculateEmployeeCommissions` to use prefetched deals/targets
   - Modify `getPriorMonthsVp/Nrr/Spiff` to filter from prefetched prior payouts
   - Modify `calculateCollectionReleases` to use prefetched collections
   - Modify `getTeamAttributedDealIds` to filter from prefetched team memberships
   - In `executePayoutCalculation`, call `prefetchPayoutData` first, then process employees in batches of 5 with `Promise.all`
   - Add optional `onProgress` callback parameter

2. **`src/hooks/usePayoutRuns.ts`** -- Pass progress callback from the mutation to update state

3. **`src/components/admin/PayoutRunManagement.tsx`** -- Display a progress indicator during calculation (employee count processed / total)

### What does NOT change

- All calculation logic (multipliers, splits, pro-rata, incremental) remains identical
- All persistence logic (monthly_payouts, deal details, metric details, attributions) remains identical
- All existing tests continue to pass
- The only difference is **when** data is fetched (upfront bulk vs per-employee)
