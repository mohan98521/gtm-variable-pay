

## Fix Summary Cards: Split by Correct Payout Categories

### Problem
The summary cards show $236,147 for "Total Eligible" but $0 for Variable Pay, Commissions, and Clawbacks. This happens because the code filters `payout_type === "variable_pay"` and `payout_type === "commission"`, but the actual database values are `"Variable Pay"`, `"Perpetual License"`, `"Managed Services"`, `"NRR Additional Pay"`, `"SPIFF"`, and `"Collection Release"`.

### Solution
Fix the summary calculation logic and add two new cards (NRR and SPIFFs) for a total of 7 summary cards.

### Changes to `src/components/reports/PayoutWorkingsReport.tsx`

**1. Fix the `summaryStats` calculation (lines 141-167)**

Categorize payout types correctly using actual database values:
- **Variable Pay**: `payout_type === "Variable Pay"`
- **Commissions**: `payout_type` in `["Perpetual License", "Managed Services"]` (and any other commission-type values)
- **NRR**: `payout_type === "NRR Additional Pay"`
- **SPIFFs**: `payout_type === "SPIFF"`
- **Clawbacks**: Sum of `clawback_amount_usd` across all rows
- **Total Eligible**: Sum of all `calculated_amount_usd`

**2. Add NRR and SPIFFs cards to the grid (lines 406-452)**

Update from 5 cards to 7 cards:
1. Total Eligible (all payout types summed)
2. Variable Pay
3. Commissions
4. NRR
5. SPIFFs
6. Clawbacks
7. Employees

Update grid from `md:grid-cols-5` to `md:grid-cols-7` (or use a responsive wrap layout).

### No database changes needed
The fix is purely in the frontend calculation logic -- the data is already correct in the database, it just wasn't being categorized properly.

