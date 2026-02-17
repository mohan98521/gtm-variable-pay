

## Add Multiplier and Adjusted Closing ARR Columns to Data Inputs Table

### What You'll See

The Closing ARR table on the Data Inputs page will get two new columns:

1. **Multiplier** -- Shows the renewal multiplier applied (e.g., 1.0x, 1.1x, 1.2x) based on the renewal years
2. **Adjusted Closing ARR** -- Shows the Closing ARR value after applying the multiplier (Closing ARR x Multiplier). This is the value actually used for payout computation

These columns will appear between the existing "Renewal Yrs" and "End Date" columns. Non-multi-year records will show "1.0x" and the unchanged Closing ARR value.

The summary section will also be updated to show the **Adjusted Eligible Closing ARR** total so you can see the aggregate impact of multipliers at a glance.

### How Multipliers Are Determined

Since all farming plans use the same multiplier tiers, the table will compute multipliers directly from the record data:

| Renewal Years | Multiplier |
|--------------|------------|
| 1 (or not multi-year) | 1.0x |
| 2 | 1.1x |
| 3+ | 1.2x |

### Changes

**File: `src/components/data-inputs/ClosingARRTable.tsx`**
- Import `findRenewalMultiplier` and `useClosingArrRenewalMultipliers` (or compute inline since tiers are consistent)
- Add "Multiplier" column header after "Renewal Yrs" showing values like "1.0x", "1.1x", "1.2x"
- Add "Adjusted ARR" column header after "Multiplier" showing `closing_arr x multiplier`
- Highlight adjusted values differently from raw closing ARR when multiplier > 1
- Include both new columns in the CSV export

**File: `src/components/data-inputs/ClosingARRSummary.tsx`**
- Add a new summary card: "Adjusted Eligible ARR" showing the sum of (eligible closing ARR x multiplier) for all eligible records
- This card will be styled distinctly (e.g., amber/gold accent) to differentiate from the raw "Eligible Closing ARR" card

**File: `src/components/reports/MyClosingARRReport.tsx`**
- Add the same "Multiplier" and "Adjusted Closing ARR" columns to the My Closing ARR report table
- Update the export columns to include multiplier and adjusted values

### Technical Details

- The multiplier is computed client-side using the `findRenewalMultiplier` utility from `useClosingArrRenewalMultipliers.ts`
- To avoid needing a plan context, we'll fetch all multiplier tiers and use the first matching set (they're identical across plans)
- For records where `is_multi_year = false`, multiplier defaults to 1.0
- Adjusted ARR = `closing_arr x multiplier`
- No database changes are needed -- this is purely a UI enhancement

