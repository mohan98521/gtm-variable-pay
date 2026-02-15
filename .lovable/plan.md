

## Populate SPIFF Metric Details with Meaningful Values

### Problem

The SPIFF row in the Detailed Workings report currently shows zeros/blanks for Target, YTD Actuals, Achievement %, OTE %, and Allocated OTE. This is because the payout engine persists the SPIFF metric detail with placeholder zeros instead of computing the meaningful intermediate values.

Looking at the screenshot, the SPIFF row shows `$8,351` misaligned across columns because the underlying data fields are empty, causing the layout to display the total payout in the wrong position.

### Expected Values (per user)

For each SPIFF (e.g., "Large Deal SPIFF"):

| Column | Value | Source |
|---|---|---|
| Target | Software New Booking ARR target (e.g., $600,000) | Same as linked metric's performance target |
| YTD Actuals | Total eligible large deal ARR | Sum of deal ARR values that meet the SPIFF threshold |
| Ach % | Eligible Actuals / Software Target | e.g., 500K / 600K = 83.33% |
| OTE % | SPIFF rate (e.g., 25%) | From `spiff_rate_pct` |
| Allocated OTE | SPIFF rate x Software Variable OTE | e.g., 25% x $48,887 = ~$8,351 (this is the "Software Variable OTE" allocated to SPIFF) |
| Multiplier | 1.0x | SPIFFs have no multiplier grid |
| YTD Eligible | Total SPIFF payout (YTD) | Already calculated correctly |

### Layout Change

Currently, the SPIFF row uses a reduced "spiff" column layout (9 columns: OTE%, Allocated OTE, Actuals, ...). Since we now have Target, Actuals, Ach%, and Multiplier data, the SPIFF row should use the same full `variable_pay` layout (12 columns) -- exactly like NRR does. This keeps the "Additional Pay" section uniform.

### Technical Details

**File 1: `src/lib/spiffCalculation.ts`**

- Update `calculateAllSpiffs` to return additional aggregate data alongside `totalSpiffUsd` and `breakdowns`:
  - `softwareTargetUsd`: the linked metric's target
  - `eligibleActualsUsd`: sum of deal ARR values that passed the SPIFF threshold
  - `softwareVariableOteUsd`: the allocated OTE portion (variableOTE x metric weightage)
  - `spiffRatePct`: the SPIFF rate applied

**File 2: `src/lib/payoutEngine.ts`** (lines 1517-1538)

- Populate the SPIFF metric detail row with real values:
  - `targetBonusUsd` = employee's target bonus (already available)
  - `allocatedOteUsd` = softwareVariableOteUsd x spiffRatePct / 100 (the "Allocated OTE" for SPIFF)
  - `targetUsd` = linked metric's software target
  - `actualUsd` = eligible large deal actuals total
  - `achievementPct` = eligible actuals / software target x 100
  - `multiplier` = 1.0 (SPIFFs have no multiplier)

**File 3: `src/components/admin/PayoutRunWorkings.tsx`**

- Change SPIFF rows to use the `variable_pay` layout instead of the custom `spiff` layout
- Update `getRowLayout`: return `'variable_pay'` for `'spiff'` component type (keep `'spiff'` only for `'deal_team_spiff'`)
- Update `getGroupLayout`: when the additional group has both NRR and SPIFF, both now use variable_pay layout; only fall back to spiff layout for deal_team_spiff-only groups
- Remove the separate "spiff" header/row columns since SPIFF will reuse the VP/NRR 12-column layout

### What does NOT change

- SPIFF calculation logic (thresholds, formula, payout splits) remains identical
- Deal Team SPIFF continues to use the reduced layout (it has no target/achievement concept)
- NRR row is already correct and unchanged
- All existing tests continue to pass
