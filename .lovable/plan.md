

## Team View Dashboard -- Gap Analysis and Fix Plan

### Gaps Found

The personal Dashboard hook (`useCurrentUserCompensation`) has five capabilities that the Team View hook (`useTeamCompensation`) is completely missing:

| Feature | Personal Dashboard | Team View | Impact |
|---|---|---|---|
| NRR (Net Revenue Retention) payout | Calculated via `calculateNRRPayout()` | Missing entirely | NRR-eligible employees show $0 NRR in team view |
| SPIFF bonuses | Calculated via `calculateAllSpiffs()` | Missing entirely | SPIFF earnings invisible to managers |
| GP Margin gating on commissions | Uses `cr_er_min_gp_margin_pct` and `impl_min_gp_margin_pct` from comp plan + `gp_margin_percent` from deals | Not implemented | Commission payouts may be overstated (no margin check) |
| Clawback amounts | Queries `clawback_ledger` for pending/partial entries | Missing | Managers can't see net payout after clawbacks |
| Deal collection status | Queries `deal_collections` table | Missing | No collection visibility per team member |

### Changes

#### 1. `src/hooks/useTeamCompensation.ts` -- Add missing calculations

**a) Add NRR calculation:**
- Import `calculateNRRPayout` and `NRRCalculationResult` from `@/lib/nrrCalculation`
- Fetch `nrr_ote_percent`, `cr_er_min_gp_margin_pct`, `impl_min_gp_margin_pct` from `comp_plans` (currently only fetching `id, name`)
- For each employee, if their plan has `nrr_ote_percent > 0`, run `calculateNRRPayout()` with their deals
- Add `nrrResult` and `nrrOtePct` to `TeamMemberCompensation` interface

**b) Add SPIFF calculation:**
- Import `calculateAllSpiffs`, `SpiffAggregateResult`, `SpiffConfig`, `SpiffMetric` from `@/lib/spiffCalculation`
- Batch-fetch `plan_spiffs` for all needed plan IDs
- For each employee, run `calculateAllSpiffs()` with their deals
- Add `spiffResult` to `TeamMemberCompensation` interface

**c) Add GP margin gating for commissions:**
- Fetch `gp_margin_percent` from deals (currently not selected)
- Fetch `min_gp_margin_pct` from `plan_commissions` (currently not selected)
- Apply margin check: if deal GP margin is below plan minimum, exclude from commission calculation

**d) Add clawback amounts:**
- Batch-fetch `clawback_ledger` entries for all team member employee UUIDs
- Add `clawbackAmount` to `TeamMemberCompensation` interface

**e) Update team aggregates:**
- Include NRR and SPIFF amounts in `teamTotalEligible` and `teamTotalPaid`

#### 2. `src/components/team/TeamMemberDetail.tsx` -- Show NRR and SPIFF sections

- Add a third section "NRR Additional Pay" (only shown if `nrrResult` exists and has non-zero values)
  - Display CR/ER and Implementation achievement, GP margin filter results, and NRR payout
- Add a fourth section "SPIFF Bonuses" (only shown if `spiffResult` exists with qualifying deals)
  - Show qualifying deal count, total SPIFF earned
- Add clawback row to the totals if `clawbackAmount > 0`

#### 3. `src/components/team/TeamPerformanceTable.tsx` -- Include NRR/SPIFF in totals

- Update `totalEligible` and `totalPaid` calculations to include NRR and SPIFF amounts
- Pass `nrrResult`, `spiffResult`, and `clawbackAmount` to `TeamMemberDetail`

#### 4. `src/components/team/TeamSummaryCards.tsx` -- No structural changes needed

The existing cards already show aggregated totals which will automatically reflect the corrected values from the hook.

#### 5. `src/pages/TeamView.tsx` -- Add NRR/SPIFF columns to CSV export

- Add columns for NRR Payout, SPIFF Earned, and Clawback to the export

### Summary

- 4 files modified: `useTeamCompensation.ts`, `TeamMemberDetail.tsx`, `TeamPerformanceTable.tsx`, `TeamView.tsx`
- No database changes needed
- Brings Team View to full parity with the Personal Dashboard calculation engine
