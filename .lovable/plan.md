

## Revamp Sales Rep Dashboard: Payout Run-Driven with Status Visibility

### Overview

Transform the Dashboard from a real-time calculation view into a **payout-run-sourced** view. All summary cards, metric tables, commission tables, NRR, SPIFF, and monthly breakdowns will pull from the latest payout run data (`monthly_payouts` + `payout_metric_details`). The payout run status (Draft, Review, Approved, Finalized, Paid) will be prominently displayed. Deal-level details and Collection Status will be removed. The Monthly Performance table will be expanded with all metric columns, targets, and YTD Achievement %. The What-If Simulator will be updated to reflect the latest plan structure.

---

### Changes Summary

1. **Show Payout Run Status** -- Display the latest payout run status (Draft / Review / Approved / Finalized / Paid) as a prominent badge in the header, replacing the current "Estimated/Finalized" badge.

2. **Source all data from payout runs** -- Create a new comprehensive hook `useDashboardPayoutRunData` that fetches:
   - Latest payout run status and month coverage
   - YTD summary (aggregated from `monthly_payouts`)
   - Metric-level details (from `payout_metric_details` aggregated across all months)
   - Commission details (from `payout_metric_details` where `component_type = 'commission'`)
   - NRR and SPIFF summaries (from `payout_metric_details` where `component_type` is `nrr` / `spiff`)
   - Monthly actuals breakdown (from `payout_metric_details` pivoted by month)

3. **Remove Collection Status Card** -- Remove `CollectionStatusCard` from the Dashboard entirely.

4. **Remove deal-level details from NRR and SPIFF cards** -- Keep NRR and SPIFF summary metrics but remove the deal breakdown tables within them.

5. **Expand Monthly Performance Table** -- New structure:
   - One column per metric (New Software Booking ARR, Closing ARR, CR/ER, Implementation, etc.)
   - A **Target row** at the top showing annual targets
   - Monthly rows (Jan-Dec) with actuals
   - **YTD Total** row
   - **YTD Ach %** row showing achievement percentage vs target

6. **Update What-If Simulator** -- Source the plan structure (metrics, weights, multiplier grids, commission rates) from the latest `payout_metric_details` to ensure it reflects the current comp plan. Keep the interactive input/projection UX but simplify the layout.

---

### Technical Details

**New file: `src/hooks/useDashboardPayoutRunData.ts`**
- Fetches the current user's employee UUID (same pattern as existing hooks)
- Queries `payout_runs` for the selected fiscal year to get the latest run status and covered months
- Queries `monthly_payouts` for this employee across the fiscal year, aggregating YTD totals for Variable Pay, Commissions, NRR, SPIFF, Booking, Collection Holdback, Year-End Holdback
- Queries `payout_metric_details` for all runs in the fiscal year for this employee, grouping by `component_type` and `metric_name` to produce:
  - VP metric summaries (target, actual, achievement, multiplier, eligible, booking/collection/year-end splits)
  - Commission summaries (deal value, rate, gross payout, splits)
  - NRR/SPIFF summaries (aggregated totals)
  - Monthly actuals pivot (month x metric_name matrix)
- Returns the latest payout run status, all summary data, and the plan structure for the simulator

**Modified file: `src/pages/Dashboard.tsx`**
- Replace `useDashboardPayoutSummary` with `useDashboardPayoutRunData`
- Keep `useCurrentUserCompensation` as fallback only when no payout run data exists
- Add payout run status badge (color-coded: Draft=gray, Review=amber, Approved=blue, Finalized=green, Paid=emerald)
- Remove `CollectionStatusCard` import and usage
- Pass payout-run-sourced data to `MetricsTable`, `CommissionTable`, `NRRSummaryCard`, `SpiffSummaryCard`
- Pass expanded monthly data to a new `MonthlyPerformanceTable`
- Pass updated plan structure to `PayoutSimulator`

**Modified file: `src/components/dashboard/MetricsTable.tsx`**
- Accept data from payout run (same interface but sourced differently)
- No structural changes needed -- the table already shows the right columns

**Modified file: `src/components/dashboard/CommissionTable.tsx`**
- Accept data from payout run (same interface)
- No structural changes needed

**Modified file: `src/components/dashboard/NRRSummaryCard.tsx`**
- Remove the deal breakdown table (lines 61-92)
- Keep only the summary metrics grid (NRR Target, Eligible Actuals, Achievement, Payout) and CR/ER vs Implementation breakdown

**Modified file: `src/components/dashboard/SpiffSummaryCard.tsx`**
- Remove the deal breakdown table (lines 48-81)
- Keep only the summary metrics grid (Total SPIFF Payout, Software Variable OTE, Software Target, Eligible Actuals)

**Modified file: `src/components/dashboard/MonthlyPerformanceTable.tsx`**
- Complete rewrite to support dynamic metric columns
- New props: `monthlyData` (month x metric matrix), `targets` (metric targets map), `metricNames` (list of all metrics)
- Structure:
  - Header row: Month | Metric1 | Metric2 | ... | MetricN
  - Target row (highlighted): "Target" | target values per metric
  - Monthly rows: Jan through Dec with actuals (dash for zero/missing)
  - YTD Total footer row
  - YTD Ach % footer row with color-coded percentages

**Modified file: `src/components/dashboard/PayoutSimulator.tsx`**
- Source plan metrics and commission structure from payout run data when available
- Keep the interactive input cards and projected payouts table
- Add a clear "Your Compensation Structure" summary showing metric weights, logic types, and commission rates before the input section
- Show the payout split percentages (Booking/Collection/Year-End) in the results

