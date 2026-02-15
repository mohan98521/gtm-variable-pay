

## Fix Detailed Workings Export to Match Summary View

### Problem
The XLSX export still uses the old `flatMap` approach, generating multiple rows per employee (one per metric). The UI now shows a pivoted one-row-per-employee summary, but the export doesn't match.

### Solution
Replace the "Detailed Workings" sheet in the XLSX export with a pivoted layout that mirrors the Summary view -- one row per employee, with dynamically generated metric column groups.

### Export Layout

```text
Emp Code | Emp Name | Plan | Ccy | [Metric 1] Target | [Metric 1] Actuals | [Metric 1] Ach% | ... (12 cols per metric) | Grand Total Incr Eligible | Grand Total Booking | Grand Total Collection | Grand Total Year-End
```

Each metric gets 12 columns with the header format: `[Metric Name] - Target`, `[Metric Name] - Actuals`, etc.

### Technical Details

**File: `src/components/admin/PayoutRunDetail.tsx`** (lines 252-299)

1. Reuse the `discoverMetrics` function from `PayoutRunWorkingsSummary.tsx` (or extract it as a shared utility) to determine the dynamic metric columns in the same order as the UI.

2. Replace the current `flatMap` logic with a pivoted export builder:
   - For each employee, create a single flat object with keys like `[MetricName]_Target`, `[MetricName]_Actuals`, etc.
   - Build the columns array dynamically: 4 fixed columns (Code, Name, Plan, Ccy) + 12 columns per metric + 4 grand total columns.

3. Update column headers to match the UI labels: "Eligible Till Last Month" and "Incremental Eligible" (not "Prior Paid" / "This Month").

4. The 12 sub-columns per metric will be: Target, Actuals, Ach %, OTE %, Allocated OTE, Multiplier, YTD Eligible, Eligible Till Last Month, Incremental Eligible, Booking, Collection, Year-End.

**No new files or dependencies needed.** The metric discovery logic from `PayoutRunWorkingsSummary.tsx` will be extracted into a shared helper or inlined in the export function.

