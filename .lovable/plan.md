

## Fix Deal-Level Workings: Column Labels, NRR Pro-Rata, and SPIFF Splits

### Problem 1: "Commission %" column is misleading for non-commission components

The `commission_rate_pct` column currently shows:
- Commission: the actual commission rate (correct)
- Variable Pay: the pro-rata proportion % (misleading label)
- NRR: 0 (meaningless)
- SPIFF: 0 (meaningless)

**Fix**: Rename the column to "Rate / Mix %" in both the UI table and XLSX export. This label works for all component types -- commission rate for commissions, pro-rata mix for VP, and can be repurposed for SPIFF rate.

Additionally, for SPIFF deals, store the `spiff_rate_pct` in `commission_rate_pct` instead of 0, so users can see the SPIFF rate applied.

### Problem 2: NRR deal details lack pro-rata payout attribution

Currently, NRR deal records store:
- `gross_commission_usd` = raw eligible value (CR/ER + Impl that passed GP gate)
- `booking_usd` / `collection_usd` / `year_end_usd` = all zeros

This is incorrect. The total NRR payout should be distributed across eligible deals proportionally (same model as Variable Pay), using the formula:

```
Deal NRR Payout = Total NRR Payout * (Deal Eligible Value / Total NRR Actuals)
```

Then apply payout splits (booking/collection/year_end) to each deal's share.

**Fix in `persistPayoutResults`**: After persisting NRR deal details, calculate pro-rata share of the total NRR payout for each eligible deal and apply the NRR booking/collection/year-end split percentages.

### Problem 3: SPIFF deal details missing payout splits

Currently, SPIFF deal records store:
- `gross_commission_usd` = individual deal SPIFF payout (correct)
- `booking_usd` / `collection_usd` / `year_end_usd` = all zeros (incorrect)

**Fix in `persistPayoutResults`**: Apply the SPIFF payout split percentages to each deal's SPIFF payout.

### Technical Details

**Files to modify:**

1. **`src/lib/payoutEngine.ts`** (persistPayoutResults, lines ~2300-2345)
   - NRR section: Calculate each deal's pro-rata share of total NRR payout, apply booking/collection/year-end splits
   - SPIFF section: Apply spiff booking/collection/year-end splits to each deal's payout, store spiff_rate_pct in commission_rate_pct

2. **`src/components/admin/PayoutRunDealWorkings.tsx`** (line 166, 207)
   - Rename column header from "Commission %" to "Rate / Mix %"
   - Conditionally format the display based on component_type

3. **`src/components/admin/PayoutRunDetail.tsx`** (line 411)
   - Rename XLSX export column header from "Commission %" to "Rate / Mix %"

### Column value mapping after fix

| Field | Commission | Variable Pay | NRR | SPIFF |
|---|---|---|---|---|
| commission_rate_pct | Commission rate | Pro-rata % | Pro-rata % of NRR actuals | SPIFF rate % |
| gross_commission_usd | Gross commission | VP split | Pro-rata NRR payout share | Deal SPIFF payout |
| booking_usd | Booking split | Booking split | NRR booking split | SPIFF booking split |
| collection_usd | Collection split | Collection split | NRR collection split | SPIFF collection split |
| year_end_usd | Year-end split | Year-end split | NRR year-end split | SPIFF year-end split |

No changes to core calculation logic -- only the persistence and display layers are updated.
