

## Commission Eligibility Modifications

### Overview
Two changes to how commission eligibility is determined:
1. **Managed Services**: Add a GP Margin threshold filter -- only deals with GP margin >= configured % qualify
2. **Perpetual License**: Replace TCV threshold with the existing "Eligible for Perpetual Incentive" flag from the deal record

---

### Change 1: Managed Services GP Margin Filter

**Database Migration**
- Add `min_gp_margin_pct` column (numeric, default NULL) to the `plan_commissions` table
- This allows each plan's commission entry to optionally require a minimum GP margin

**Payout Engine** (`src/lib/payoutEngine.ts`)
- Update the deal query in `calculateEmployeeCommissions` to also fetch `gp_margin_percent`
- In the Managed Services commission block (~line 747), add a check: if `min_gp_margin_pct` is set on the commission config and `deal.gp_margin_percent < min_gp_margin_pct`, skip the deal

**Commission Form UI** (`src/components/admin/CommissionFormDialog.tsx`)
- Add a new form field "Min GP Margin (%)" that appears for all commission types (but is most relevant for Managed Services)
- Wire it through `PlanCommissionEditor` and `usePlanCommissions` hook

**Commission Interface** (`src/lib/commissions.ts`)
- Add `min_gp_margin_pct` to the `PlanCommission` interface

---

### Change 2: Perpetual License Uses Deal Flag

**Payout Engine** (`src/lib/payoutEngine.ts`)
- Update the deal query to also fetch `eligible_for_perpetual_incentive`
- In the Perpetual License commission block (~line 718), replace the TCV threshold check with: if `deal.eligible_for_perpetual_incentive !== true`, skip the deal
- The `min_threshold_usd` on the Perpetual License commission config will be ignored in favor of this flag

---

### Technical Details

**Files to modify:**

| File | Change |
|------|--------|
| Database migration | Add `min_gp_margin_pct` to `plan_commissions` |
| `src/lib/commissions.ts` | Add `min_gp_margin_pct` to `PlanCommission` interface |
| `src/lib/payoutEngine.ts` | Fetch `gp_margin_percent` and `eligible_for_perpetual_incentive` in commission deal query; add GP margin check for Managed Services; replace threshold check with flag check for Perpetual License |
| `src/hooks/usePlanCommissions.ts` | Include `min_gp_margin_pct` in select/create/update |
| `src/components/admin/CommissionFormDialog.tsx` | Add "Min GP Margin (%)" field |
| `src/components/admin/PlanCommissionEditor.tsx` | Display GP margin column in the table |

**Calculation logic changes:**

```text
MANAGED SERVICES (before):
  if deal.managed_services_usd > 0 AND deal.tcv_usd >= min_threshold_usd
    -> commission = managed_services_usd * rate%

MANAGED SERVICES (after):
  if deal.managed_services_usd > 0
    AND (min_gp_margin_pct is NULL OR deal.gp_margin_percent >= min_gp_margin_pct)
    -> commission = managed_services_usd * rate%

PERPETUAL LICENSE (before):
  if deal.perpetual_license_usd > 0 AND deal.tcv_usd >= min_threshold_usd
    -> commission = perpetual_license_usd * rate%

PERPETUAL LICENSE (after):
  if deal.perpetual_license_usd > 0 AND deal.eligible_for_perpetual_incentive = true
    -> commission = perpetual_license_usd * rate%
    (min_threshold_usd ignored for this type)
```

