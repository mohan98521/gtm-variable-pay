

## Fix Renewal Multiplier Tier Overlap

### Problem

The current multiplier tiers use inclusive ranges on both ends (`min_years` to `max_years`), causing overlaps at boundaries. For example, if Tier 1 is 1-2 years and Tier 2 is 2-3 years, a 2-year renewal matches both tiers.

### Solution

Two changes to ensure each renewal year maps to exactly one multiplier:

**1. Update `findRenewalMultiplier` logic** (`src/hooks/useClosingArrRenewalMultipliers.ts`)

Sort multipliers by `min_years` descending so the **most specific (highest) matching tier wins**. This means a 2-year renewal will match the "2-3 years" tier (1.1x) instead of the "1-2 years" tier (1.0x), which is the correct business intent.

**2. Add overlap validation in the editor** (`src/components/admin/ClosingArrRenewalMultiplierEditor.tsx`)

When adding or editing a tier, validate that the new range does not overlap with existing tiers. Show an error toast if overlap is detected and prevent the save.

### Technical Details

**File: `src/hooks/useClosingArrRenewalMultipliers.ts`**
- Change `findRenewalMultiplier` to sort multipliers by `min_years` descending before matching, so the narrowest/highest tier is checked first.

**File: `src/components/admin/ClosingArrRenewalMultiplierEditor.tsx`**
- Add a validation function in `handleSubmit` that checks for range overlaps against existing tiers (excluding the one being edited).
- If overlap detected, show a toast error and block submission.

