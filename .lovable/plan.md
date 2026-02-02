
# Fix: Drop Conflicting Two-Way Payout Split Constraint

## Problem

The database has **two conflicting CHECK constraints** on `plan_metrics`:

| Constraint Name | Definition | Status |
|-----------------|------------|--------|
| `valid_metric_payout_split` (OLD) | `booking + collection = 100` | **Causing the error** |
| `plan_metrics_payout_split_check` (NEW) | `booking + collection + year_end = 100` | Correct |

When saving 75% booking + 0% collection + 25% year_end:
- New constraint passes (75 + 0 + 25 = 100)
- Old constraint **fails** (75 + 0 ≠ 100)

The same issue likely exists on `plan_commissions` table.

## Solution

Create a database migration to drop the old two-way split constraints from both tables:

```sql
-- Drop old two-way split constraint from plan_metrics
ALTER TABLE plan_metrics DROP CONSTRAINT IF EXISTS valid_metric_payout_split;

-- Drop old two-way split constraint from plan_commissions (if exists)
ALTER TABLE plan_commissions DROP CONSTRAINT IF EXISTS valid_commission_payout_split;
```

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| New Migration | CREATE | Drop old `valid_metric_payout_split` and `valid_commission_payout_split` constraints |

## Impact

After this migration:
- The three-way payout split (Booking + Collection + Year End = 100%) will work correctly
- All existing data will continue to be valid
- Users can save metrics with any valid three-way split combination

## Risk Assessment

**Low Risk** - Only removes outdated constraints that conflict with the new three-way split logic. The new constraint already validates the data correctly.
