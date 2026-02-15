
## Restructure Detailed Workings by Component Type

### Problem
Currently, all component types (Variable Pay, Commission, SPIFF) share the same 12 sub-columns. Commissions and SPIFFs do not have meaningful targets/multipliers, so displaying those columns is misleading and wastes space.

### Column Layout by Component Type

```text
Variable Pay:   Target | Actuals | Ach% | OTE% | Allocated OTE | Multiplier | YTD Eligible | Elig Last Mo | Incr Eligible | Booking | Collection | Year-End
Commission:     Commission % | Actuals (TCV) | YTD Eligible | Elig Last Mo | Incr Eligible | Booking | Collection | Year-End
SPIFF:          OTE% | Allocated OTE | Actuals | YTD Eligible | Elig Last Mo | Incr Eligible | Booking | Collection | Year-End
NRR/Other:      (keep same as Variable Pay -- has targets/multipliers)
```

### Changes Required

**1. Database: Add `commission_rate_pct` column to `payout_metric_details`**
- New nullable numeric column to persist the commission rate for commission rows
- No impact on existing rows (defaults to NULL)

**2. `src/lib/payoutEngine.ts`**
- Add `commissionRatePct` to `MetricPayoutDetail` interface (optional field)
- When building commission detail rows (~line 1421-1439), populate `commissionRatePct: c.commissionRatePct`
- When persisting to DB (~line 2164-2185), include `commission_rate_pct: md.commissionRatePct ?? null`

**3. `src/hooks/usePayoutMetricDetails.ts`**
- Add `commission_rate_pct` to `PayoutMetricDetailRow` interface

**4. `src/components/admin/PayoutRunWorkings.tsx` (Detail/Accordion view)**
- Replace the single fixed column header with a component-type-aware renderer
- For **Variable Pay / NRR** rows: render all 13 columns (Metric, Target, Actuals, Ach%, OTE%, Allocated OTE, Multiplier, YTD Eligible, Elig Last Mo, Incr Eligible, Booking, Collection, Year-End)
- For **Commission** rows: render Metric, Commission %, Actuals (TCV), then the 6 payout columns (YTD Eligible through Year-End)
- For **SPIFF** rows: render Metric, OTE%, Allocated OTE, Actuals, then the 6 payout columns
- Since each group has its own sub-header row already, display group-specific column headers within each group section
- Adjust SubtotalRow and Grand Total column spans accordingly

**5. `src/components/admin/PayoutRunWorkingsSummary.tsx` (Summary/Pivot view)**
- Replace the uniform `SUB_COLS` array with per-metric-type column definitions
- For each discovered metric, generate sub-columns based on its `componentType`:
  - `variable_pay` / `nrr`: 12 columns (Target through Year-End)
  - `commission`: 8 columns (Commission %, Actuals, YTD Eligible, Elig Last Mo, Incr Eligible, Booking, Collection, Year-End)
  - `spiff` / `deal_team_spiff`: 9 columns (OTE%, Allocated OTE, Actuals, YTD Eligible, Elig Last Mo, Incr Eligible, Booking, Collection, Year-End)
- Update `renderSubCells` to accept the metric's componentType and render only relevant cells
- Update the `colSpan` in the top header row to match the dynamic sub-column count per metric

**6. `src/components/admin/PayoutRunDetail.tsx` (XLSX Export)**
- Update the Detailed Workings sheet generation (~lines 274-347)
- Use component-type-aware sub-labels when building columns for each metric
- For commission metrics, output "Commission %" instead of Target/Ach%/OTE%/Allocated OTE/Multiplier
- For SPIFF metrics, omit Target/Ach%/Multiplier columns
- Populate the commission rate value from the `commission_rate_pct` field

### Impact
- Summary and Detail views will show only relevant columns per component type, making the data easier to validate
- Commission % will be visible for audit/validation purposes
- SPIFF rows retain OTE% and Allocated OTE (the Software Variable OTE used in the formula) for transparency
- XLSX export mirrors the updated layout
- No changes to the payout calculation engine logic itself -- only how data is displayed and what additional field is persisted
