

## Detailed Workings: One-Row-Per-Employee Summary View

### What Changes

Add a new **Summary** view to the Detailed Workings tab that displays a flat, horizontally scrollable table where each employee occupies exactly one row. All metrics are represented as column groups across the row. A toggle lets users switch between this new Summary view and the existing Detail (accordion) view.

### Layout Mockup

```text
| Emp Code | Emp Name | Plan | Ccy | -- New Software Booking ARR (VP) -- | -- Closing ARR (VP) -- | -- Managed Services (Comm) -- | -- NRR Additional Pay -- | -- SPIFF -- | ... | Grand Total |
|          |          |      |     | Tgt | Act | Ach% | OTE% | Alloc OTE | Mult | YTD Elig | Elig Last Mo | Incr Elig | Bkg | Coll | YE |  (same 12 cols repeated)  |             | Incr Elig | Bkg | Coll | YE |
| IN0004   | Farmer 2 | Farmer | USD | $450K | $400K | 88.89% | 60% | $26,666 | 1.00x | $23,703 | $0 | $23,703 | ... | ... | ... | ...repeated... | $X | $Y | $Z | $W |
| SA0001   | Hunting Sales Rep | Hunter | USD | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | $X | $Y | $Z | $W |
```

- Metrics are discovered dynamically from the data (not hardcoded), so any new component types added to the payout engine will automatically appear as new column groups.
- Employees missing a particular metric will show dashes in those columns.
- The table uses a two-row header: top row shows metric names (with colSpan), bottom row shows the 12 sub-column labels.

### Toggle Between Views

A segmented toggle ("Summary" / "Detail") above the search bar lets users switch:
- **Summary** (new, default): Flat one-row-per-employee table
- **Detail** (existing): Accordion with per-employee metric breakdown

### Technical Details

**File to modify:** `src/components/admin/PayoutRunWorkings.tsx`

1. **Discover all distinct metrics** across all employees in the payout run, ordered by component type group (VP first, then Commissions, then NRR/SPIFF/Deal Team SPIFF, then Releases/Adjustments), then alphabetically within each group.

2. **Build a pivoted data structure**: For each employee, create a map of metric_name to its detail row. This allows O(1) lookup when rendering each column group.

3. **Render the summary table** with:
   - A two-level header: top row has metric names spanning 12 columns each, bottom row has the 12 field labels repeated
   - One data row per employee with values filled from the pivot map (or dashes if that metric doesn't apply)
   - A Grand Total column group at the end summing all metrics

4. **Add a view toggle** using Tabs or a simple button group above the search input to switch between "Summary" and "Detail" views.

5. **Keep the existing `EmployeeWorkingsCard` and accordion code** intact for the Detail view -- no changes needed there.

**No database, hook, or engine changes required.** All data is already available from the existing `usePayoutMetricDetails` hook.

