
# Fix Clawback Exemption Logic and Remove Hardcoded Split Assumptions

## Issues Identified

### Issue 1: Incorrect UI Messaging for Clawback Exempt

**File:** `src/components/admin/PayoutSettingsCard.tsx` (lines 191-197)

**Current (Wrong):**
```typescript
✓ No clawback rules will apply to this plan. All payouts are 100% on booking.
```

**Problem:** This incorrectly implies 100% is paid on booking. Clawback exempt means the full amount is paid regardless of collection status - NOT that everything is paid on booking.

---

### Issue 2: Hardcoded Fallback Splits Throughout Codebase

Multiple files use `?? 70` / `?? 25` / `?? 5` fallbacks which assume a standard split. Each plan defines its own splits - no fallback should be assumed.

| File | Line(s) | Current Fallback |
|------|---------|------------------|
| `src/lib/dealVariablePayAttribution.ts` | 150-152 | `?? 70`, `?? 25`, `?? 5` |
| `src/hooks/useMyDealsWithIncentives.ts` | 148-150, 189-191, 572-574 | `?? 70`, `?? 25`, `?? 5` |
| `src/hooks/useCurrentUserCompensation.ts` | 306-309, 337-340, 390-393 | `?? 70`, `?? 25`, `?? 5` |
| `src/hooks/useIncentiveAuditData.ts` | 440-442 | `?? 75`, `?? 25` (inconsistent!) |
| `src/components/dashboard/MetricsTable.tsx` | 29, 31, 123 | `?? 70`, `?? 25`, `?? 5` |
| `src/lib/commissions.ts` | 56-57 | Comment mentions "70/25/5" |

**Problem:** These fallbacks can cause incorrect calculations if the plan doesn't have splits defined. Also, inconsistent fallbacks (70/25/5 vs 75/25) create confusion.

---

## Technical Solution

### Part 1: Fix PayoutSettingsCard Messaging

**File:** `src/components/admin/PayoutSettingsCard.tsx`

**Changes:**
1. Update line 181 description to be accurate
2. Replace lines 191-197 with correct messaging
3. Add validation warning when clawback period is set on exempt plan

**Updated Messaging:**
```typescript
// Line 181: Update description
<p className="text-sm text-muted-foreground">
  When enabled, employees receive their full payout regardless of collection status.
</p>

// Lines 191-197: Replace with correct message
{clawbackExempt && (
  <div className="mt-2 p-3 bg-success/10 rounded-md space-y-2">
    <p className="text-sm text-success font-medium">
      ✓ Clawback Exempt Plan
    </p>
    <p className="text-xs text-muted-foreground">
      Employees receive their full payout regardless of collection status. 
      The payout split percentages defined in each metric and commission 
      still apply for tracking and reporting purposes, but all portions 
      are payable immediately with no clawback risk.
    </p>
    {clawbackDays > 0 && (
      <p className="text-xs text-amber-600 flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        The clawback period setting will be ignored for this exempt plan.
      </p>
    )}
  </div>
)}
```

---

### Part 2: Remove/Handle Hardcoded Split Fallbacks

**Approach:** Instead of removing fallbacks entirely (which could cause runtime errors), we should:
1. Log a warning when fallbacks are used (for debugging)
2. Use consistent fallback values (0/0/0 makes it obvious something is missing)
3. Document that splits MUST come from plan configuration

**Alternative (recommended):** Keep existing fallbacks but ensure splits are always populated in the database. Add NOT NULL constraints with defaults at DB level.

**For now:** Update comments to clarify these are database schema defaults, not business logic defaults.

| File | Change |
|------|--------|
| `src/lib/dealVariablePayAttribution.ts` | Update comment on lines 149-152 to clarify DB default |
| `src/hooks/useMyDealsWithIncentives.ts` | Ensure plan_commissions always have splits defined |
| `src/hooks/useCurrentUserCompensation.ts` | Update fallback comment and consider warning log |
| `src/hooks/useIncentiveAuditData.ts` | Fix inconsistent 75/25 to match DB schema defaults |
| `src/components/dashboard/MetricsTable.tsx` | Update display logic for uniform split detection |

---

### Part 3: Ensure Database Has Split Defaults

**Files:** Check if `plan_metrics` and `plan_commissions` tables have proper defaults

If not already done, add migration to ensure:
- `payout_on_booking_pct` DEFAULT 70
- `payout_on_collection_pct` DEFAULT 25  
- `payout_on_year_end_pct` DEFAULT 5

This ensures new records have valid splits, while existing records maintain their configured values.

---

### Part 4: Add Validation for Plan Split Configuration

**File:** Plan Builder UI should validate:
1. Booking + Collection + Year-End = 100%
2. All three values are populated

This already exists but should be enforced on save.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/PayoutSettingsCard.tsx` | Fix exempt messaging, add clawback period warning |
| `src/lib/dealVariablePayAttribution.ts` | Update comments to clarify fallback is DB default |
| `src/hooks/useMyDealsWithIncentives.ts` | Clarify fallback comments |
| `src/hooks/useCurrentUserCompensation.ts` | Clarify fallback comments |
| `src/hooks/useIncentiveAuditData.ts` | Fix 75/25 inconsistency to 70/25/5 |
| `src/components/dashboard/MetricsTable.tsx` | Clarify uniform split detection uses actual values |

---

## Summary of Behavioral Changes

| Before | After |
|--------|-------|
| UI says "100% on booking" for exempt | UI correctly explains full payout regardless of collection |
| Inconsistent fallback 75/25 in audit | Consistent DB default 70/25/5 across all files |
| No warning for clawback period on exempt | Warning shows clawback period will be ignored |

---

## What Does NOT Change

- **Actual payout calculations** - These already use plan-defined splits correctly when available
- **Database schema** - Splits are already stored per metric/commission
- **VP attribution logic** - Already reads from plan_metrics configuration
- **Clawback risk calculation** - Already correctly shows $0 for exempt plans

The core calculation logic is correct. The issues are:
1. Misleading UI messaging
2. Inconsistent/confusing fallback values in code comments
3. Missing validation warning for conflicting settings
