
## Report Audit: Broken and Inconsistent Reports

After a thorough review of all 10 report tabs and their underlying hooks, here are the issues found:

---

### Issue 1: Management Summary Misclassifies NRR, SPIFF, and Collection Releases (CRITICAL)

**Problem**: The Management Summary hook (`useManagementSummary.ts`) classifies payouts using simple string matching:
- `payout_type.includes('variable')` for VP
- `payout_type.includes('commission')` for commissions

This means NRR Additional Pay, SPIFF, Deal Team SPIFF, Collection Release, and Year-End Release payout types are **completely ignored** in both VP and Commission totals. They fall through both checks and are only counted toward clawback totals (since `totalClawback += clawback` runs unconditionally but the amounts themselves are skipped).

**Result**: The executive Management Summary report **understates total payouts** by the sum of all NRR, SPIFF, and release payouts. The quarterly and by-function breakdowns are similarly incomplete.

**Fix**: Expand the classification logic to properly categorize all 8 payout types:
- VP: 'Variable Pay'
- Commission: 'Managed Services', 'Implementation', 'CR/ER', 'Perpetual License' (or any type not in the known non-commission set)
- Separate line items for: 'NRR Additional Pay', 'SPIFF', 'Deal Team SPIFF'
- Releases: 'Collection Release', 'Year-End Release' should be added to the appropriate category
- Clawback: 'Clawback' type only

**Files**: `src/hooks/useManagementSummary.ts`, `src/components/reports/ManagementSummary.tsx`

---

### Issue 2: Currency Breakdown Has Same Classification Bug (MAJOR)

**Problem**: `CurrencyBreakdown.tsx` uses the same flawed `payout_type.includes('variable')` check. NRR, SPIFF, and release types are silently dropped from VP totals and incorrectly added to commission totals (since the else branch catches everything non-VP).

**Result**: Currency-level reporting overstates commissions and understates/omits other payout categories.

**Fix**: Align payout type classification with the engine's actual types, matching the fix in Issue 1.

**File**: `src/components/reports/CurrencyBreakdown.tsx`

---

### Issue 3: Year-End Holdback Tracker Same Classification Bug (MAJOR)

**Problem**: `useYearEndHoldbacks.ts` uses `payout_type.includes('variable')` to split VP vs commission holdbacks. NRR and SPIFF year-end holdback amounts are miscategorized as commission holdbacks.

**Fix**: Use exact type matching consistent with Issue 1.

**File**: `src/hooks/useYearEndHoldbacks.ts`

---

### Issue 4: Payout Statement Missing NRR, SPIFF, and Release Types (MAJOR)

**Problem**: The `usePayoutStatement.ts` hook only recognizes three payout types: 'Variable Pay', 'Clawback', and everything else as "commission." This means:
- NRR Additional Pay appears as a commission item (wrong category, no metric breakdown)
- SPIFF and Deal Team SPIFF appear as commission items
- Collection Release and Year-End Release appear as commission items
- These types display without deal value or rate context, showing confusing $0 values

**Fix**: Add dedicated sections or proper categorization for NRR, SPIFF, and release types in the payout statement. At minimum, group them correctly (NRR/SPIFF under VP-adjacent section, releases as a separate section).

**Files**: `src/hooks/usePayoutStatement.ts`, `src/components/reports/PayoutStatement.tsx`

---

### Issue 5: Incentive Audit Missing NRR, SPIFF, and Org-Level Actuals (MODERATE)

**Problem**: The Incentive Audit report (`useIncentiveAuditData.ts`) calculates VP and commissions from live data (not payout runs), but:
- Does not include NRR Additional Pay calculations
- Does not include SPIFF or Deal Team SPIFF calculations
- Does not handle "Org " prefixed metrics (organization-wide rollup actuals)
- The commission table header says "Paid (75%) / Holdback (25%)" which is hardcoded but the actual splits come from the plan configuration and may differ

**Fix**:
- Add NRR and SPIFF sections to the audit report (or note their absence)
- Fix hardcoded "75%/25%" column headers to show "Paid / Holdback" without percentages
- Consider adding Org-level metric support for overlay/executive roles

**Files**: `src/pages/Reports.tsx` (commission table headers), `src/hooks/useIncentiveAuditData.ts`

---

### Issue 6: Incentive Audit Grand Total Missing Year-End Holdback (MINOR)

**Problem**: The Grand Total table at the bottom of the Incentive Audit shows `Commission (Holdback)` but this only includes the collection holdback. The year-end holdback column (`totalCommissionYearEndHoldback`) is calculated but never displayed in the UI table, even though it's included in the CSV export.

**Fix**: Add a "Year-End Holdback" column to the Grand Total table, or combine it into a "Total Holdback" column.

**File**: `src/pages/Reports.tsx`

---

### Issue 7: Compensation Snapshot Missing TVP Column (MINOR)

**Problem**: The Compensation Snapshot table shows OTE, Target Bonus, and Pro-Ration but does not show TVP (Total Variable Pay) in either local currency or USD. The `user_targets` table has `target_bonus_usd` but TVP is on the employee record. The report derives `targetBonusLocal` with a formula `ote_local - tfp_local` which may not match the actual TVP field.

**Fix**: Source TVP directly from the employee/target record rather than calculating it. Add TVP column to the table for completeness.

**File**: `src/pages/Reports.tsx`

---

### Summary of Changes

| # | Issue | Severity | Scope |
|---|---|---|---|
| 1 | Mgmt Summary ignores NRR/SPIFF/Releases | Critical | Hook + Component |
| 2 | Currency Breakdown same classification bug | Major | Component |
| 3 | Holdback Tracker same classification bug | Major | Hook |
| 4 | Payout Statement miscategorizes non-VP/non-commission types | Major | Hook + Component |
| 5 | Incentive Audit missing NRR/SPIFF, hardcoded split labels | Moderate | Hook + Page |
| 6 | Incentive Audit Grand Total missing year-end holdback | Minor | Page |
| 7 | Compensation Snapshot missing TVP, derived formula mismatch | Minor | Page |

### Implementation Approach

Create a shared payout type classification utility (`src/lib/payoutTypes.ts`) to ensure consistent categorization across all reports:

```text
VP_TYPES = ['Variable Pay']
COMMISSION_TYPES = ['Managed Services', 'Implementation', 'CR/ER', 'Perpetual License']
ADDITIONAL_PAY_TYPES = ['NRR Additional Pay', 'SPIFF', 'Deal Team SPIFF']
RELEASE_TYPES = ['Collection Release', 'Year-End Release']
DEDUCTION_TYPES = ['Clawback']
```

All hooks and components will import from this shared module instead of using ad-hoc string matching. The Management Summary, Currency Breakdown, Holdback Tracker, and Payout Statement will be updated to properly handle all payout types with correct aggregation.
