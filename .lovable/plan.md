

## Add Deal-Level Workings to XLSX Export

### Problem
The "Export XLSX (Multi-sheet)" button in the Payout Run Detail page exports Summary, Employee Breakdown, and Detailed Workings sheets, but does not include the deal-level data from the "Deals" tab. Users cannot export which deals were eligible or excluded.

### Solution
Add a new "Deal Workings" sheet to the existing multi-sheet XLSX export in `PayoutRunDetail.tsx`.

### Technical Details

**File to modify: `src/components/admin/PayoutRunDetail.tsx`**

1. Import `usePayoutDealDetails` hook (already used by the Deals tab component)
2. Call the hook with the current `payoutRunId` to fetch deal-level data
3. After the "Detailed Workings" sheet block (around line 390), add a new "Deal Workings" sheet with the following columns:

| Column Header | Source Field |
|---|---|
| Employee Code | employee_code |
| Employee Name | employee_name |
| Component | component_type |
| Project ID | project_id |
| Customer | customer_name |
| Commission Type | commission_type |
| Deal Value (USD) | deal_value_usd |
| GP Margin % | gp_margin_pct |
| Min GP % | min_gp_margin_pct |
| Eligible | is_eligible (Yes/No) |
| Exclusion Reason | exclusion_reason |
| Commission % | commission_rate_pct |
| Gross Commission (USD) | gross_commission_usd |
| Upon Booking (USD) | booking_usd |
| Upon Collection (USD) | collection_usd |
| At Year End (USD) | year_end_usd |

4. The sheet will export all deal records (both eligible and excluded), matching what the Deals tab shows without filters applied.

This is a small, self-contained change -- just fetching the data and appending one more sheet to the existing export logic.
