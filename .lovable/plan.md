

# Clawback Exemption for Compensation Plans

## Understanding the Requirement

Certain employee roles (e.g., Pre-Sales, Solution Architects, some Channel partners) get paid their full incentive regardless of whether collections happen. They should not be subject to clawback rules that normally apply when deals fail to collect within the clawback period.

**Current Behavior:**
- All plans follow the same clawback rules
- Payout is split: X% on booking, Y% on collection, Z% at year-end
- If collection doesn't happen within the clawback period, the booking portion is clawed back

**Expected Behavior:**
- Plans with clawback exemption get 100% payout on booking (or per their configured split)
- Collection status doesn't affect their payout eligibility
- No clawback risk for these plans

---

## Design Decision: Where to Add the Flag?

| Option | Location | Pros | Cons |
|--------|----------|------|------|
| **A** | `comp_plans` table (Plan-level) | Simple, one flag affects entire plan | Cannot have mixed behavior within a plan |
| **B** | `plan_metrics` table (Metric-level) | Granular control per metric | More complex to manage |
| **C** | `plan_commissions` table (Commission-level) | Granular control per deal type | Separate from VP metrics |

**Recommended: Option A (Plan-level)** - This aligns with how compensation structures work in practice. An entire role category (e.g., Pre-Sales) is either subject to clawback or exempt. This matches your statement "certain Roles" are exempt.

---

## Database Changes

### Add Column to `comp_plans` Table

```sql
ALTER TABLE comp_plans
ADD COLUMN is_clawback_exempt BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN comp_plans.is_clawback_exempt IS 
  'When true, employees on this plan receive full payout regardless of collection status. No clawback rules apply.';
```

**Default:** `FALSE` (existing plans continue to use standard clawback rules)

---

## UI Changes

### 1. Update PayoutSettingsCard Component

**File:** `src/components/admin/PayoutSettingsCard.tsx`

Add a toggle switch for clawback exemption:

```text
┌─────────────────────────────────────────────────────────────┐
│ Payout Settings                                              │
├─────────────────────────────────────────────────────────────┤
│ Payout Frequency: [Monthly ▼]                                │
│                                                             │
│ Clawback Period: [180] days                                 │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Clawback Exempt                              [Toggle]   │ │
│ │ When enabled, employees on this plan receive full       │ │
│ │ payout on booking regardless of collection status.      │ │
│ │ No clawback rules will apply.                          │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

When clawback exempt is enabled:
- The "Clawback Period (Days)" field becomes disabled/greyed out (not applicable)
- A visual indicator shows this plan is exempt

### 2. Update Plan Overview Display

**File:** `src/pages/PlanBuilder.tsx`

Show exemption status in the plan header with a badge:
- If exempt: `[Clawback Exempt]` badge in green
- If not exempt: No additional indicator (standard behavior)

---

## Payout Calculation Logic Changes

### Files to Update:
- `src/hooks/useMyDealsWithIncentives.ts`
- `src/lib/dealVariablePayAttribution.ts`

### Logic Change:

When calculating payouts for a deal:

```typescript
// Pseudo-code for payout calculation
if (planIsClawbackExempt) {
  // Full payout on booking, no holdback
  actualPaid = eligibleIncentive;  // 100% immediately
  clawbackRisk = 0;
  
  // Override payout split display
  payoutOnBooking = eligibleIncentive;
  payoutOnCollection = 0;
  payoutOnYearEnd = 0;
} else {
  // Standard behavior with collection-based holdback
  payoutOnBooking = eligibleIncentive * (bookingPct / 100);
  payoutOnCollection = eligibleIncentive * (collectionPct / 100);
  payoutOnYearEnd = eligibleIncentive * (yearEndPct / 100);
  
  if (isCollected) {
    actualPaid = eligibleIncentive;
  } else {
    actualPaid = payoutOnBooking;
    clawbackRisk = payoutOnBooking;
  }
}
```

---

## Data Flow Summary

```text
1. Admin creates/edits plan → Sets "Clawback Exempt" toggle
2. Plan saved with is_clawback_exempt = true/false
3. When calculating payouts:
   a. Fetch employee's plan configuration
   b. Check is_clawback_exempt flag
   c. If exempt: Full payout immediately, no clawback tracking
   d. If not exempt: Apply standard booking/collection/year-end split
4. My Deals Report:
   a. Exempt plans: "VP Clawback Risk" column shows $0 or "-"
   b. Non-exempt plans: Shows actual clawback exposure
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/` | Add `is_clawback_exempt` column to `comp_plans` |
| `src/components/admin/PayoutSettingsCard.tsx` | Add clawback exempt toggle, disable period when exempt |
| `src/pages/PlanBuilder.tsx` | Display exemption badge, pass prop to PayoutSettingsCard |
| `src/hooks/useCompPlans.ts` | Include new field in CompPlan interface |
| `src/hooks/useMyDealsWithIncentives.ts` | Check exemption flag when calculating payouts |
| `src/lib/dealVariablePayAttribution.ts` | Respect exemption flag in VP calculations |

---

## Updated Interfaces

### CompPlan Interface
```typescript
export interface CompPlan {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  effective_year: number;
  payout_frequency: string | null;
  clawback_period_days: number | null;
  is_clawback_exempt: boolean;  // NEW
  created_at: string;
  updated_at: string;
}
```

### VP Attribution Update
When fetching plan config for VP calculation, include the exemption flag and adjust payout display accordingly.

---

## Expected Behavior After Implementation

| Plan Type | Collection Status | Payout | Clawback Risk |
|-----------|------------------|--------|---------------|
| Standard (not exempt) | Pending | Booking portion only | = Booking portion |
| Standard (not exempt) | Collected | 100% | $0 |
| Standard (not exempt) | Clawback triggered | $0 | N/A |
| **Clawback Exempt** | Pending | 100% | $0 |
| **Clawback Exempt** | Collected | 100% | $0 |
| **Clawback Exempt** | N/A (no tracking) | 100% | $0 |

---

## UI Behavior Notes

1. **PayoutSettingsCard with Exempt ON:**
   - "Clawback Period" input is disabled with a note: "Not applicable for exempt plans"
   - Visual indication that this plan is exempt

2. **My Deals Report for Exempt Plans:**
   - "VP Clawback Risk" column shows "-" or "$0"
   - "Paid on Booking" shows full eligible amount
   - "Held for Collection" and "Held for Year-End" show $0

3. **Collections Table:**
   - Deals under exempt plans don't show clawback warnings even if overdue

---

## Migration Safety

- Default value is `FALSE`, so existing plans continue with current behavior
- No data loss or breaking changes for existing configurations

