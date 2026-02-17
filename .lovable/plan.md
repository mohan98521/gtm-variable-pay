

## Add Closing ARR Sheet to XLSX Export

### What's Missing
The multi-sheet XLSX export in the Payout Run Detail page currently includes: Summary, All Employees, currency sheets, Detailed Workings, and Deal Workings. There is no sheet for Closing ARR project-level data.

### Changes

**File: `src/components/admin/PayoutRunDetail.tsx`**

1. Import the `useClosingArrPayoutDetails` hook at the top of the file.
2. Call the hook inside the `PayoutRunDetail` component to fetch Closing ARR data for the current payout run.
3. In the `handleExportXLSX` function, after the "Deal Workings" sheet block (around line 418), add a new "Closing ARR Workings" sheet with the following columns:
   - Employee Code
   - Employee Name
   - PID
   - Customer Name
   - Customer Code
   - BU
   - Product
   - Category (order_category_2)
   - Month/Year
   - End Date
   - Multi-Year (Yes/No)
   - Renewal Years
   - Closing ARR (USD)
   - Multiplier
   - Adjusted ARR (USD)
   - Eligible (Yes/No)
   - Exclusion Reason

This is a straightforward addition -- one new import, one new hook call, and one new sheet block in the export function.
