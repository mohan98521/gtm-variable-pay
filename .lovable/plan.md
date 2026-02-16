

## Show Eligible Payout (Not Actual Paid) in Trend Chart

### What Changes

The Payout Trend chart currently sums ALL payout records including Collection Releases, Year-End Releases, and Clawbacks. This mixes the "eligible/earned" amount with later cash disbursement events, leading to double-counting or distorted monthly figures.

The fix filters payout records to only include **core earning types** whose `calculated_amount_usd` represents the full eligible (gross earned) amount:
- Variable Pay
- Commission types (Managed Services, Perpetual License, CR/ER, Implementation)
- NRR Additional Pay
- SPIFF
- Deal Team SPIFF

Records of type `Collection Release`, `Year-End Release`, and `Clawback` will be excluded from the chart, North Star total, and cumulative YTD line.

### Technical Details

**File: `src/hooks/useExecutiveDashboard.ts`**

1. Define excluded payout types at the top of the `useMemo`:
   ```
   const excludedTypes = new Set(['Collection Release', 'Year-End Release', 'Clawback']);
   ```

2. Create a filtered list of "eligible only" payouts:
   ```
   const eligiblePayouts = payouts.filter(p => !excludedTypes.has(p.payout_type));
   ```

3. Replace all references to `payouts` with `eligiblePayouts` for:
   - `totalPayoutYtd` calculation
   - `activePayeeSet` (eligible employees count)
   - Monthly trend aggregation
   - Payout by function breakdown
   - Per-employee total payout map (top performers)

4. Add cumulative YTD to the `MonthlyTrend` interface:
   - Add `cumulativePayout: number` field
   - After building monthly totals, iterate chronologically and compute running sum

**File: `src/components/executive/PayoutTrendChart.tsx`**

- Add a second `Line` series on the left Y-axis for `cumulativePayout`
- Use a distinct dashed stroke with a warm color (amber/orange) to differentiate from the attainment line
- Update Legend and Tooltip formatters for the new series

### Files Modified
- `src/hooks/useExecutiveDashboard.ts` -- filter to eligible-only payouts, add cumulative YTD
- `src/components/executive/PayoutTrendChart.tsx` -- add cumulative YTD line

