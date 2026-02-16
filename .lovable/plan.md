

## Sales Rep Dashboard Fixes -- 4 Issues

### Issue 1: Top Summary Cards Restructure

**Current**: Target Bonus | Total Eligible | Amount Paid | Holding | Commission
**Problem**: "Total Eligible" is unclear; missing bifurcation into booking/collection/year-end across all components.
**Fix**: Change the 5 cards to:
- **Target Bonus** (unchanged)
- **YTD Total Eligible** -- sum of ALL eligible payouts (VP + Commission + NRR + SPIFF)
- **Payable (Booking)** -- total booking amounts across all components
- **Payable Upon Collection** -- total collection holdback across all components
- **Hold Till Year End** -- total year-end holdback across all components

**File**: `src/pages/Dashboard.tsx` -- update the summary card section to aggregate VP + commission + NRR + SPIFF booking/collection/year-end amounts from `payoutData`.

---

### Issue 2: SPIFF Rate Display Fix

**Current**: Shows `achievement_pct` (68.33% = eligible actuals / software target) as "Rate".
**Actual**: SPIFF rate is 25% (from `plan_spiffs.spiff_rate_pct`). The 68.33% is the achievement percentage, not the rate.
**Fix**:
- In `useDashboardPayoutRunData.ts`, the SPIFF summary currently maps `detail.achievement_pct` to `spiffRatePct` (line 428). Change this to extract the actual SPIFF rate from the plan configuration.
- Fetch `plan_spiffs` for the employee's plan and use `spiff_rate_pct` (25%) as the rate.
- Also display the SPIFF achievement % separately in the `SpiffSummaryCard` for clarity. Add fields like "Achievement %" alongside "SPIFF Rate".

**Files**: `src/hooks/useDashboardPayoutRunData.ts`, `src/components/dashboard/SpiffSummaryCard.tsx`

---

### Issue 3: Monthly Performance -- Add All Metrics

**Current**: Only shows `variable_pay` and `commission` component types in the monthly pivot. Missing Closing ARR (which is a VP metric but may not have monthly deal data), NRR, Managed Services, Perpetual License.
**Root Cause**: The monthly pivot in the hook (line 451) filters to `variable_pay` or `commission` only, excluding `nrr` and `spiff`. Additionally, Closing ARR is a VP metric but may not have `this_month_usd` populated if data isn't flowing.
**Fix**:
- In `useDashboardPayoutRunData.ts`, expand the monthly pivot to include ALL `component_type` values (`variable_pay`, `commission`, `nrr`, `spiff`).
- Ensure `metricNames` and `metricTargets` include entries for NRR, SPIFF, and all commission types.
- In `MonthlyPerformanceTable`, no changes needed -- it already renders dynamically from `metricNames`.

**File**: `src/hooks/useDashboardPayoutRunData.ts`

---

### Issue 4: Payout Simulator -- Show Full Comp Structure

**Current**: Simulator only shows metrics/commissions that have actuals in payout runs. If no deals exist for a metric (e.g., Closing ARR, Managed Services), it doesn't appear.
**Fix**: Fetch the employee's full plan configuration (plan_metrics, plan_commissions, plan_spiffs, nrr_ote_percent) and merge with payout run data. Show ALL configured metrics even if actuals are zero.

For the Farmer plan, the full structure is:
- **Variable Pay**: New Software Booking ARR (60% weight), Closing ARR (40% weight)
- **Commissions**: Managed Services (1.5%), Perpetual License (4%)
- **NRR Additional Pay**: 20% of Variable OTE
- **Large Deal SPIFF**: 25% rate, min deal value $400K

**Changes**:
1. In `useDashboardPayoutRunData.ts`, add a parallel fetch for `plan_metrics`, `plan_commissions`, `plan_spiffs`, and `comp_plans.nrr_ote_percent` for the employee's assigned plan. Merge these with payout run data, filling in zero actuals for any metric not yet in payout runs.
2. Update the `PayoutSimulator` component to accept NRR and SPIFF simulation inputs alongside VP metrics and commissions. Add NRR simulation (formula: Variable OTE x NRR OTE % x Achievement) and SPIFF simulation (formula: Software Variable OTE x SPIFF Rate x eligible deals above threshold / target).
3. Pass full plan config (including multiplier grids) to the simulator so computations match the designed comp structure.

**Files**: `src/hooks/useDashboardPayoutRunData.ts`, `src/pages/Dashboard.tsx`, `src/components/dashboard/PayoutSimulator.tsx`

---

### Technical Summary

| File | Change |
|------|--------|
| `src/hooks/useDashboardPayoutRunData.ts` | Fetch plan config; fix SPIFF rate; expand monthly pivot to all components; merge plan metrics with payout data for full coverage |
| `src/pages/Dashboard.tsx` | Restructure 5 summary cards to Target Bonus / YTD Eligible / Booking / Collection / Year-End; pass full plan config to simulator |
| `src/components/dashboard/SpiffSummaryCard.tsx` | Show actual SPIFF rate (25%) and achievement % separately |
| `src/components/dashboard/PayoutSimulator.tsx` | Add NRR and SPIFF simulation sections; show all plan metrics even without actuals; compute payouts per comp structure formulas |

