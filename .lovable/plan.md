

## Add XLSX Export to Payout Workings Report

### What Changes
Add an "Export" button next to the month selector and status badge in the Payout Workings Report. Clicking it will download a multi-sheet XLSX file containing all four sub-views of the selected payout run.

### Export File Structure
The XLSX will contain 4 sheets:

1. **Summary** -- One row per employee (pivoted view): Emp Code, Emp Name, DOJ, LWD, Status, BU, Plan, Total Variable OTE, Incr Eligible, Current Month Payable, Upon Collection (Held), At Year End (Held)
2. **Detailed Workings** -- One row per employee per metric: Employee, Emp Code, Component Type, Metric, Target, Actuals, Ach %, OTE %, Allocated OTE, Multiplier, Commission %, YTD Eligible, Elig Last Month, Incr Eligible, Upon Booking, Upon Collection, At Year End
3. **Deal Workings** -- One row per deal per employee: Employee, Emp Code, Component, Project ID, Customer, Commission Type, Deal Value, GP Margin %, Min GP %, Eligible?, Exclusion Reason, Rate %, Gross Commission, Upon Booking, Upon Collection, At Year End
4. **Closing ARR** -- One row per project per employee: Employee, Emp Code, PID, Customer, BU, Product, Category, End Date, Multi-Year?, Renewal Years, Closing ARR, Multiplier, Adjusted ARR, Eligible?, Exclusion Reason

Filename: `Payout-Workings-{MonthYear}-FY{Year}.xlsx`

### Technical Changes

#### `src/components/reports/PayoutWorkingsReport.tsx`
- Import `Button`, `Download` icon, `generateMultiSheetXLSX`, `downloadXLSX` from existing utilities
- Import hooks: `usePayoutMetricDetails`, `usePayoutDealDetails`, `useClosingArrPayoutDetails`
- Call all three hooks with the `selectedRunId` so data is pre-fetched
- Add a `handleExport` function that builds 4 `SheetData` objects using the fetched data and calls `generateMultiSheetXLSX` + `downloadXLSX`
- Add an Export button in the header bar next to the status badge
- The export respects the same role-based filtering already applied (RLS on detail tables, client-side on summary)

No new files or database changes needed. Uses existing `generateMultiSheetXLSX` and `downloadXLSX` from `src/lib/xlsxExport.ts`.
