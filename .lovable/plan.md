

## Fix Three Critical Issues: Multi-Participant Attribution, Multiplier Logic, and Commission Display

### Issue Analysis

I've investigated all three issues and found the root causes:

---

### Issue 1: Multi-Participant Deal Attribution Not Working

**Root Cause:** The `useIncentiveAuditData.ts` hook only aggregates deals for the **primary sales rep** (`sales_rep_employee_id`), ignoring all other participants.

**Current Code (Lines 125-139):**
```typescript
// 7. Fetch deals actuals (New Software Booking ARR)
const { data: deals } = await supabase
  .from("deals")
  .select("sales_rep_employee_id, new_software_booking_arr_usd")  // ← Only fetches sales_rep
  .in("sales_rep_employee_id", employeeIds)  // ← Only filters by sales_rep
  ...

// Aggregate deals by employee
const dealsActualMap = new Map<string, number>();
(deals || []).forEach(deal => {
  if (deal.sales_rep_employee_id) {  // ← Only credits sales_rep
    const current = dealsActualMap.get(deal.sales_rep_employee_id) || 0;
    dealsActualMap.set(deal.sales_rep_employee_id, current + (deal.new_software_booking_arr_usd || 0));
  }
});
```

**Data Exists:** The deals table has data for all 8 participant roles:
| Role | Example Employee IDs |
|------|---------------------|
| sales_rep_employee_id | DU0001, SA0001 |
| sales_head_employee_id | DU0002, SA0002 |
| sales_engineering_employee_id | IN0001 |
| sales_engineering_head_employee_id | IN0004 |
| product_specialist_employee_id | MY0001 |
| product_specialist_head_employee_id | AF0001 |
| solution_manager_employee_id | IN0005 |
| solution_manager_head_employee_id | MY0010 |

**Fix:** Update the actuals aggregation to credit ALL participant roles, not just the sales rep.

---

### Issue 2: 1.6x Multiplier Not Applied for >120% Achievement

**Root Cause:** Bug in the `getMultiplierFromGrid` function in `compensationEngine.ts` (Line 39).

**Current Code:**
```typescript
// Line 38-42
for (const grid of sortedGrids) {
  if (achievementPercent >= grid.min_pct && achievementPercent < grid.max_pct) {  // ← BUG: uses < instead of <=
    return grid.multiplier_value;
  }
}
```

**Problem:** When achievement is exactly at a boundary (e.g., 120%), the condition `achievementPercent < grid.max_pct` fails for the 100-120% tier, so it falls through to the >120% tier incorrectly, but the real issue is the opposite - for values like 121%, it correctly hits the 120-999 tier.

**Database Configuration (Farmer - New Software Booking ARR):**
| Min % | Max % | Multiplier |
|-------|-------|------------|
| 0 | 100 | 1.00x |
| 100 | 120 | 1.40x |
| 120 | 999 | 1.60x |

The configuration is correct. Let me verify the actual calculation by checking if the achievement percentage is being calculated correctly in the first place. The issue may be that targets or actuals are not properly set.

**Additional Investigation Needed:** The multiplier logic appears correct. The issue may be:
1. Targets not set correctly in `performance_targets` table
2. Achievement calculation showing 0% because target = 0

---

### Issue 3: Commission Calculations Not Visible

**Root Cause:** There is **no UI** to display commission calculations. The `plan_commissions` table has data, and deals have the relevant commission columns (managed_services_usd, implementation_usd, cr_usd, er_usd, tcv_usd), but:

1. The Incentive Audit report only shows **Variable Pay** calculations
2. There is no calculation logic for commissions in the audit hook
3. No display section for commission payouts

**Database Configuration (Farmer Plan - plan_id: ed01c7a6-...):**
| Commission Type | Rate | Min Threshold |
|-----------------|------|---------------|
| Managed Services | 1.5% | None |
| Perpetual License | 4.0% | $50,000 |
| Implementation | 1.0% | None |
| CR/ER | 1.0% | None |

---

### Implementation Plan

#### Step 1: Fix Multi-Participant Attribution

**Files to Modify:** `src/hooks/useIncentiveAuditData.ts`, `src/hooks/useUserActuals.ts`

**Changes:**
- Fetch ALL participant role columns from deals table
- Aggregate deal values to ALL participants (full credit, not split)
- Update both the Incentive Audit hook and the Dashboard's user actuals hook

```typescript
// New query for deals
const { data: deals } = await supabase
  .from("deals")
  .select(`
    new_software_booking_arr_usd,
    sales_rep_employee_id,
    sales_head_employee_id,
    sales_engineering_employee_id,
    sales_engineering_head_employee_id,
    product_specialist_employee_id,
    product_specialist_head_employee_id,
    solution_manager_employee_id,
    solution_manager_head_employee_id
  `)
  .gte("month_year", fiscalYearStart)
  .lte("month_year", fiscalYearEnd);

// Aggregate to ALL participant roles
const participantRoles = [
  'sales_rep_employee_id',
  'sales_head_employee_id',
  'sales_engineering_employee_id',
  'sales_engineering_head_employee_id',
  'product_specialist_employee_id',
  'product_specialist_head_employee_id',
  'solution_manager_employee_id',
  'solution_manager_head_employee_id',
];

(deals || []).forEach(deal => {
  participantRoles.forEach(role => {
    const empId = deal[role];
    if (empId) {
      const current = dealsActualMap.get(empId) || 0;
      dealsActualMap.set(empId, current + (deal.new_software_booking_arr_usd || 0));
    }
  });
});
```

#### Step 2: Verify Multiplier Logic

**File to Review/Fix:** `src/lib/compensationEngine.ts`

The multiplier grid logic appears correct. The issue is likely that:
- Employees don't have `performance_targets` set for "New Software Booking ARR"
- When target = 0, achievement = 0%, so multiplier = 1.0x

**Verification Query:**
```sql
SELECT employee_id, metric_type, target_value_usd 
FROM performance_targets 
WHERE effective_year = 2026;
```

If targets are missing, the UI shows 0% achievement regardless of actuals.

#### Step 3: Add Commission Display to Reports

**Files to Modify:** `src/hooks/useIncentiveAuditData.ts`, `src/pages/Reports.tsx`

**Changes:**
1. Create new commission calculation in the audit data hook
2. Add commission columns to the Incentive Audit UI
3. Calculate commission payouts using the formula: `TCV * Rate` (with holdback split)

**New Interface:**
```typescript
interface IncentiveAuditRow {
  // ... existing fields
  commissions: {
    commissionType: string;
    dealValue: number;
    rate: number;
    grossCommission: number;
    immediatePayout: number;  // 75%
    holdback: number;         // 25%
  }[];
  totalCommission: number;
}
```

---

### Files to Create/Modify

| File | Changes |
|------|---------|
| `src/hooks/useIncentiveAuditData.ts` | Add multi-participant attribution, add commission calculations |
| `src/hooks/useUserActuals.ts` | Add multi-participant attribution for Dashboard |
| `src/pages/Reports.tsx` | Add commission display section to Incentive Audit tab |
| `src/lib/compensationEngine.ts` | Review and potentially fix multiplier boundary logic |

---

### Data Flow After Fix

```text
deals table
├── sales_rep_employee_id ─────────────┐
├── sales_head_employee_id ────────────┤
├── sales_engineering_employee_id ─────┤
├── sales_engineering_head_employee_id ┤
├── product_specialist_employee_id ────┤   ALL credited with
├── product_specialist_head_employee_id┼─→ new_software_booking_arr_usd
├── solution_manager_employee_id ──────┤
└── solution_manager_head_employee_id ─┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│         useIncentiveAuditData.ts            │
│                                             │
│  Variable Pay:                              │
│  ├── Achievement = Actual / Target          │
│  ├── Multiplier from multiplier_grids       │
│  └── Payout = Achievement × Allocation × M  │
│                                             │
│  Commissions:                               │
│  ├── Managed Services: TCV × 1.5%           │
│  ├── Perpetual License: TCV × 4% (if >$50k) │
│  ├── Implementation: TCV × 1%               │
│  └── CR/ER: TCV × 1%                        │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│         Incentive Audit Report              │
│                                             │
│  [Variable Pay Section]                     │
│  Employee | Metric | Target | Actual | %    │
│                                             │
│  [Commission Section] ← NEW                 │
│  Employee | Type | Deal Value | Rate | Paid │
└─────────────────────────────────────────────┘
```

---

### Summary

| Issue | Root Cause | Fix |
|-------|------------|-----|
| 1. Multi-participant not counted | Hook only queries `sales_rep_employee_id` | Query all 8 participant columns and credit each |
| 2. 1.6x multiplier not applied | Likely missing performance targets (target=0 → 0% achievement) | Verify targets exist; fix multiplier boundary logic if needed |
| 3. Commission not visible | No UI or calculation logic for commissions | Add commission calculations to audit hook and display in Reports |

