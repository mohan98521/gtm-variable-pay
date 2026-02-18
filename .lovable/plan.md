

## Add Payout History Report

### What It Does
Adds a new "Payout History" tab under Reports that shows historical payout records from the `monthly_payouts` table. Users can filter by "All months" or a specific month, view values in both USD and local currency, and export the data to Excel.

### Where It Appears
A new tab called "Payout History" will be added to the **Personal Reports** section (visible to all users), placed after "Payout Workings".

### Features
1. **Month Filter**: Dropdown with "All Months" option plus each month that has payout data (derived from payout_runs for the selected fiscal year)
2. **Data Table**: Shows employee-level payout records with columns for both USD and local currency amounts
3. **Export to XLSX**: Single-click export of the filtered data to Excel with dual-currency columns
4. **Role-Based Filtering**: Admin/Finance/GTM Ops see all employees; Sales Heads see their team; Sales Reps see only their own data

### Table Columns
| Column | Description |
|--------|-------------|
| Employee Name | From employees table join |
| Employee ID | employee_id text field |
| Month | month_year formatted |
| Payout Type | Variable Pay, Commission, NRR, SPIFF, etc. |
| Eligible (USD) | calculated_amount_usd |
| Eligible (Local) | calculated_amount_local |
| Upon Booking (USD) | booking_amount_usd |
| Upon Booking (Local) | booking_amount_local |
| Upon Collection (USD) | collection_amount_usd |
| Upon Collection (Local) | collection_amount_local |
| Year-End (USD) | year_end_amount_usd |
| Year-End (Local) | year_end_amount_local |
| Clawback (USD) | clawback_amount_usd |
| Clawback (Local) | clawback_amount_local |
| Currency | local_currency |
| Exchange Rate | exchange_rate_used |

### Technical Changes

#### New File: `src/components/reports/PayoutHistoryReport.tsx`
- Fetches `monthly_payouts` joined with `employees` (for name/employee_id) filtered by fiscal year
- Uses `payout_runs` to populate the month filter dropdown (only finalized/paid runs)
- Client-side role filtering for Sales Head (team) and Sales Rep (self)
- Renders a scrollable table with all dual-currency columns
- Export button using `generateMultiSheetXLSX` / `downloadXLSX` from existing `xlsxExport.ts`

#### Modified File: `src/pages/Reports.tsx`
- Import `PayoutHistoryReport`
- Add a new `TabsTrigger` for "Payout History" in the Personal Reports section
- Add corresponding `TabsContent` rendering `<PayoutHistoryReport />`

### Data Access
- `monthly_payouts` already has RLS policy `mp_view` allowing SELECT for all authenticated users
- Employee data joined via UUID `employee_id` column
- No database changes needed
