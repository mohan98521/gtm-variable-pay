

## Dashboard Fixes: 3 Issues

### Issue 1: Closing ARR Target Shows Zero

**Root Cause**: When Closing ARR has no data in `payout_metric_details` (no closing_arr_actuals for Jan 2026), the hook fills it from plan config with `targetUsd: 0` (line 561). The target should come from `performance_targets` table, which has a $1,600,000 Closing ARR target.

**Fix in `src/hooks/useDashboardPayoutRunData.ts`**:
- Add a parallel fetch for `performance_targets` for this employee in the selected fiscal year
- When filling missing VP metrics from plan config, look up the target from `performance_targets` instead of defaulting to 0
- Also populate `metricTargetMap` from performance_targets for metrics not present in payout_metric_details (so Monthly Performance table also shows Closing ARR target)

---

### Issue 2: Multiplier Logic Type Shows "Linear" Instead of "Stepped Accelerator"

**Root Cause**: For VP metrics that DO exist in `payout_metric_details`, the logic type is inferred from `detail.notes` string matching (line 404): it checks if notes contain "Gated" or "Stepped". Since notes for this record is null, it falls back to "Linear". The actual plan config correctly has `Stepped_Accelerator`.

**Fix in `src/hooks/useDashboardPayoutRunData.ts`**:
- After building vpMetrics from payout_metric_details AND after fetching planConfig, cross-reference each VP metric with planConfig.metrics to get the correct `logicType`, `gateThreshold`, and `weightagePercent` from the plan definition rather than deriving them from notes or calculating from amounts
- This ensures the dashboard always reflects the plan's actual configuration

---

### Issue 3: Monthly Performance Shows Payout Values Instead of Deal Values; Show Only Months With Data

**Root Cause**: The monthly pivot (line 648) uses `detail.this_month_usd` which is the incremental payout amount for that month, not the deal value. For a sales rep, the monthly breakdown should show deal values (actuals) not payouts.

**Fix in `src/hooks/useDashboardPayoutRunData.ts`**:
- Change the monthly pivot to use `detail.actual_usd` for the month's metric value instead of `this_month_usd`. Since `actual_usd` in payout_metric_details is the YTD cumulative actual, we need to compute the incremental by subtracting prior month's actual. Alternatively, source monthly deal values directly from the `deals` table grouped by month and metric type.
- The cleaner approach: query deals directly for this employee in the fiscal year, sum by month and metric type (new_software_booking_arr_usd, managed_services_usd, cr_usd + er_usd as "CR/ER", implementation_usd, perpetual_license_usd). For Closing ARR, use closing_arr_actuals monthly snapshots. For NRR/SPIFF, keep using payout_metric_details since those are computed values.

**Fix in `src/components/dashboard/MonthlyPerformanceTable.tsx`**:
- Filter to only show months that have any data (at least one metric > 0), instead of showing all 12 months
- Keep the Target row and YTD footer rows visible always

---

### Technical Summary

| File | Changes |
|------|---------|
| `src/hooks/useDashboardPayoutRunData.ts` | (1) Fetch performance_targets for employee to populate correct target values for all metrics including Closing ARR. (2) Cross-reference VP metric logicType/gateThreshold with planConfig instead of deriving from notes. (3) Build monthly actuals from deals table (deal values) instead of payout_metric_details (payout values). Add Closing ARR monthly from closing_arr_actuals. |
| `src/components/dashboard/MonthlyPerformanceTable.tsx` | Only render months that have at least one metric with data > 0. Hide future months with no data. |

