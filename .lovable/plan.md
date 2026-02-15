

## Fix: Managed Services GP Margin Threshold Not Enforced

### Root Cause

The payout engine code correctly checks `min_gp_margin_pct` from the `plan_commissions` table before qualifying a Managed Services deal. However, the `min_gp_margin_pct` field is currently **NULL** for all Managed Services commission entries in the database.

When `min_gp_margin_pct` is NULL, the code treats it as "no threshold required," so all three deals (GP margins of 35%, 36%, and 60%) are being included in the commission calculation. Only the deal with 60% GP margin (Omega Bank Global, $100,000) should qualify if the threshold is 55%.

### Evidence

| Deal | Customer | Managed Services USD | GP Margin % | Should Qualify (at 55%) |
|---|---|---|---|---|
| PRJ-MLMGSPTA-M36 | Gamma Wealth Partners | $75,000 | 35% | No |
| PRJ-MLMGSPTA-D1V | Omicron Insurance | $60,000 | 36% | No |
| PRJ-MLMGSPTA-UYS | Omega Bank Global | $100,000 | 60% | Yes |

### Fix

This is a **data configuration fix**, not a code change. A database migration will update all active Managed Services commission entries to set `min_gp_margin_pct = 55`.

**SQL to execute:**
```sql
UPDATE plan_commissions
SET min_gp_margin_pct = 55
WHERE commission_type = 'Managed Services'
  AND is_active = true
  AND min_gp_margin_pct IS NULL;
```

After this update, the existing payout engine logic will correctly filter out deals with GP margin below 55%. The affected plans are: Farmer, Hunter, Sales Head Farmer, Sales Head Hunter, and Team Lead.

### Post-Fix

After applying the data fix, the payout run for January should be re-calculated. The expected result for SA0001/SA0002 on Managed Services should drop from $1,125/$750 (based on $75,000 total from 2 deals attributed to them) to only the commission on the qualifying deal(s) with GP >= 55%.

### No Code Changes Required

The payout engine code at `src/lib/payoutEngine.ts` (lines 829-861) already implements the GP margin check correctly. The Plan Builder UI (`CommissionFormDialog.tsx`) already supports editing this field for future adjustments.
