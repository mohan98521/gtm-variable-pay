

## Fixes for Monthly Performance Breakdown

### Issue 1: New Software Booking ARR Actuals Not Flowing

**Root Cause**: The deals query at line 253-254 uses partial date strings:
```
.gte("month_year", `${selectedYear}-01`)   // passes "2026-01"
.lte("month_year", `${selectedYear}-12`)   // passes "2026-12"
```
But `month_year` is a **date** column in the database (not text). Comparing a date against `"2026-01"` causes a silent error/empty result since it's an invalid date format.

The same issue exists for the `closing_arr_actuals` query at lines 261-262.

**Fix in `src/hooks/useDashboardPayoutRunData.ts` (lines 253-254 and 261-262)**:
- Change date filters to use full date format:
  - `.gte("month_year", `${selectedYear}-01-01`)`
  - `.lte("month_year", `${selectedYear}-12-31`)`

---

### Issue 2: "Large Deal SPIFF" and "SPIFF" Showing as Two Separate Columns

**Root Cause**: Two different data sources add SPIFF to the metric names set:
1. `payout_metric_details` records have `metric_name = "SPIFF"` (line 757)
2. `plan_spiffs` config has `spiff_name = "Large Deal SPIFF"` (line 796)

Both get added to `allMetricNames`, creating two columns.

**Fix in `src/hooks/useDashboardPayoutRunData.ts`**:
- Normalize the SPIFF metric name from `payout_metric_details` to use the plan's SPIFF name ("Large Deal SPIFF") instead of the generic "SPIFF". When processing NRR/SPIFF details at line 757, if `component_type === 'spiff'` and a plan SPIFF name exists, use that name instead of `detail.metric_name`.
- This ensures only one SPIFF column appears in the table.

---

### Technical Summary

| File | Changes |
|------|---------|
| `src/hooks/useDashboardPayoutRunData.ts` | (1) Fix date filter format on lines 253-254 and 261-262 from partial dates to full dates. (2) Normalize SPIFF metric_name from payout data to match plan config name, preventing duplicate columns. |

