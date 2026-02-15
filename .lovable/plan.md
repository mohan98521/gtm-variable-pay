

## Extend Deal-Level Workings to All Metrics

### Current Gap

The "Deals" tab in Payout Run Workings currently only shows **Commission** deals. Variable Pay, NRR, and SPIFF deals are calculated by the engine but not persisted to `payout_deal_details`. Users cannot validate which deals contributed to those components.

### What Data Exists Today

| Component | Deal Data Available in Engine | Persisted to payout_deal_details? |
|---|---|---|
| Commission | Every deal with eligibility + exclusion reason | Yes |
| Variable Pay | Pro-rata attribution per deal (vpAttributions) | No (stored in separate `deal_variable_pay_attribution` table) |
| NRR | Only aggregate totals returned; individual deal eligibility not tracked | No |
| SPIFF | Qualifying deals with payouts (spiffBreakdowns); excluded deals silently skipped | No |

### Solution

#### 1. Add `component_type` column to `payout_deal_details`

Add a new column to distinguish deal records by incentive type. This avoids creating separate tables and keeps the UI simple with one unified Deals tab.

```
ALTER TABLE payout_deal_details 
  ADD COLUMN component_type TEXT NOT NULL DEFAULT 'commission';
```

#### 2. Enhance NRR calculation to return deal-level breakdowns

Currently `calculateNRRPayout()` returns only aggregate totals. Modify it to also return per-deal eligibility records, including deals excluded due to GP margin thresholds.

**New output per deal:**
- Deal ID, CR/ER value, Implementation value, GP margin
- Whether eligible (passed GP margin threshold)
- Exclusion reason if not eligible (e.g., "GP margin 30% below CR/ER minimum 35%")

#### 3. Enhance SPIFF calculation to track excluded deals

Currently `calculateSpiffPayout()` silently skips deals below the minimum value threshold. Modify to also return excluded deals with reasons (e.g., "Deal ARR $40,000 below minimum $50,000").

#### 4. Persist all deal types in `persistPayoutResults`

Extend the deal details persistence block to write records for:

- **Variable Pay deals**: From `vpAttributions` -- project_id, customer_name, deal value (ARR), proportion %, VP split, booking/collection/year-end amounts. All VP deals are "eligible" (no exclusion gate).
- **NRR deals**: From the enhanced NRR result -- deal value (CR/ER + Impl), GP margin, threshold, eligibility, exclusion reason, and the deal's contribution to NRR payout.
- **SPIFF deals**: From enhanced SPIFF result -- deal ARR, SPIFF name, payout amount, eligibility, exclusion reason (min value threshold).

#### 5. Update UI components

- **`PayoutRunDealWorkings.tsx`**: Add a component_type filter dropdown (All / Variable Pay / Commission / NRR / SPIFF). Show component type as a badge on each row.
- **`usePayoutDealDetails.ts`**: No schema change needed -- the hook already does `select('*')` so the new column will be included automatically.

### Technical Details

**Files to modify:**

1. **New migration** -- Add `component_type` column to `payout_deal_details`
2. **`src/lib/nrrCalculation.ts`** -- Add `NRRDealBreakdown` interface and return per-deal eligibility from `calculateNRRPayout`
3. **`src/lib/spiffCalculation.ts`** -- Add excluded deals tracking to `calculateSpiffPayout` and `calculateAllSpiffs`
4. **`src/lib/payoutEngine.ts`** -- In `persistPayoutResults`, extend the deal details block to also write VP, NRR, and SPIFF deal records using the new `component_type` value
5. **`src/components/admin/PayoutRunDealWorkings.tsx`** -- Add component_type filter and badge display
6. **`src/hooks/usePayoutDealDetails.ts`** -- Add `component_type` to the interface

**Column mapping per component type:**

| Column | Commission | Variable Pay | NRR | SPIFF |
|---|---|---|---|---|
| component_type | "commission" | "variable_pay" | "nrr" | "spiff" |
| deal_value_usd | TCV | ARR | CR/ER + Impl | ARR |
| commission_rate_pct | Rate % | -- | -- | SPIFF Rate % |
| gp_margin_pct | GP% | -- | GP% | -- |
| min_gp_margin_pct | Threshold | -- | Threshold | Min deal value |
| is_eligible | GP gate | Always true | GP gate | Min value gate |
| exclusion_reason | GP reason | null | GP reason | Min value reason |
| gross_commission_usd | Commission | VP Split | NRR contribution | SPIFF payout |
| booking/collection/year_end | Payout splits | Payout splits | Payout splits | Payout splits |

### No changes to existing calculation logic

All payout amounts remain identical. This only adds observability by persisting deal-level audit data that the engine already computes (or will compute with the NRR/SPIFF enhancements).
