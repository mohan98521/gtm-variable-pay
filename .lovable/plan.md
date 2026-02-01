

## Complete Dashboard Redesign: Fix Data Flow and Add New Features

### Root Cause Analysis

The dashboard shows all zeros because:

1. **Missing Plan Assignment**: The `user_targets` table is **empty** - there are no plan assignments for any users. The `useUserPlanConfiguration` hook depends on `user_targets` to link users to their compensation plans.

2. **Current Data Flow (Broken)**:
```text
user_targets (EMPTY!) 
    → useUserPlanConfiguration returns null
    → planConfig?.metrics = undefined
    → Dashboard shows "No Plan Assigned" and all $0 values
```

3. **Data That EXISTS**:
   - `performance_targets` table has targets for DU0001 (Farming Sales Rep):
     - New Software Booking ARR: $600,000
     - Closing ARR: $1,600,000
   - `employees` table has compensation data (tvp_usd: $81,477.65)
   - `deals` table has actual transactions (total ~$793K in New Software Booking ARR for DU0001)
   - `comp_plans` table has plans (Farmer plan exists: ed01c7a6-...)

### Solution: Bypass user_targets and Build Dashboard from Source Tables

Instead of relying on the empty `user_targets` table, redesign the dashboard to:
1. Get plan assignment from `employees.sales_function` → map to `comp_plans`
2. Get targets from `performance_targets` table
3. Get target bonus from `employees.tvp_usd`
4. Get actuals from `deals` and `closing_arr_actuals` (already working via useUserActuals)

---

### Implementation Plan

#### Part 1: Create New Hook - useCurrentUserCompensation

**File**: `src/hooks/useCurrentUserCompensation.ts` (NEW)

This hook will bypass `user_targets` and source data directly:

```typescript
// Data flow:
// 1. Get current user's profile (with employee_id)
// 2. Get employee master data (tvp_usd, sales_function)
// 3. Map sales_function to comp_plan
// 4. Get performance_targets for employee_id
// 5. Get plan_metrics and multiplier_grids for the plan
// 6. Return complete compensation configuration
```

Key mappings:
| Sales Function | Comp Plan Name |
|----------------|----------------|
| Farmer | Farmer |
| Hunter | Hunter |
| Farmer - Retain | Farmer Retain |
| Sales Head - Farmer | Sales Head Farmer |
| Sales Head - Hunter | Sales Head Hunter |
| CSM | CSM |
| Sales Engineering | Sales Engineering |

#### Part 2: Redesign Dashboard Layout

**File**: `src/pages/Dashboard.tsx` - Complete rewrite

**New Layout Structure**:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Dashboard Header                                      FY 2026  Farmer │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Table 1: Metric-wise Performance Summary                      │ │
│  │ ┌─────────┬────────┬────────┬────────┬────────┬───────┬──────┐│ │
│  │ │ Metric  │ Target │ Actual │ Achiev.│ Elig.  │ Paid  │ Hold.││ │
│  │ │         │        │        │   %    │ Payout │       │      ││ │
│  │ ├─────────┼────────┼────────┼────────┼────────┼───────┼──────┤│ │
│  │ │ New SW  │ $600K  │ $793K  │ 132.2% │ $86K   │ $64K  │ $22K ││ │
│  │ │ ClosARR │ $1.6M  │ $0     │ 0%     │ $0     │ $0    │ $0   ││ │
│  │ └─────────┴────────┴────────┴────────┴────────┴───────┴──────┘│ │
│  │ Totals                              $86K     $64K      $22K   │ │
│  │ Clawback (if any)                   $0                        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Table 2: Monthly Performance Breakdown                        │ │
│  │ ┌──────┬─────────────────────┬─────────────────────┐          │ │
│  │ │ Month│ New Software ARR    │ Closing ARR          │          │ │
│  │ ├──────┼─────────────────────┼─────────────────────┤          │ │
│  │ │ Jan  │ $429,986            │ $0                   │          │ │
│  │ │ Feb  │ $363,173            │ $0                   │          │ │
│  │ │ ...  │ ...                 │ ...                  │          │ │
│  │ └──────┴─────────────────────┴─────────────────────┘          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Table 3: What-If Payout Simulator                             │ │
│  │                                                                │ │
│  │ New Software Booking ARR     Closing ARR                      │ │
│  │ ┌───────────────────────┐   ┌───────────────────────┐         │ │
│  │ │ Achievement % [slider]│   │ Achievement % [slider]│         │ │
│  │ │ 80% ──●───────── 200% │   │ 80% ────●───── 200%   │         │ │
│  │ │ Current: 132%         │   │ Current: 0%           │         │ │
│  │ └───────────────────────┘   └───────────────────────┘         │ │
│  │                                                                │ │
│  │ Projected Payout Table:                                       │ │
│  │ ┌─────────┬────────┬────────┬──────┬──────────┬────────────┐  │ │
│  │ │ Metric  │ Sim %  │ Alloc  │ Mult │ Payout   │ Logic       │  │ │
│  │ ├─────────┼────────┼────────┼──────┼──────────┼────────────┤  │ │
│  │ │ New SW  │ 150%   │ $48.9K │ 1.6x │ $117,317 │ Stepped    │  │ │
│  │ │ ClosARR │ 100%   │ $32.6K │ 1.2x │ $39,119  │ Gated      │  │ │
│  │ ├─────────┼────────┼────────┼──────┼──────────┼────────────┤  │ │
│  │ │ TOTAL   │        │        │      │ $156,436 │            │  │ │
│  │ └─────────┴────────┴────────┴──────┴──────────┴────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

#### Part 3: Implementation Details

**New Hook (useCurrentUserCompensation.ts)**:
```typescript
interface CurrentUserCompensation {
  employeeId: string;
  employeeName: string;
  targetBonusUsd: number;
  planId: string;
  planName: string;
  metrics: {
    metricName: string;
    targetValue: number;
    actualValue: number;
    achievementPct: number;
    weightagePercent: number;
    allocation: number;
    multiplier: number;
    eligiblePayout: number;
    amountPaid: number;      // 75% of eligible
    holdback: number;        // 25% of eligible
    logicType: string;
    gateThreshold: number | null;
  }[];
  monthlyBreakdown: {
    month: string;
    newSoftwareArr: number;
    closingArr: number;
  }[];
  clawbackAmount: number;
  totalEligiblePayout: number;
  totalPaid: number;
  totalHoldback: number;
}
```

**Dashboard Component Changes**:
1. Replace `useUserPlanConfiguration` with new `useCurrentUserCompensation`
2. Replace existing cards with Table 1 (Metrics Summary)
3. Replace Monthly Performance chart with Table 2 (Monthly by Metric)
4. Replace Payout Projection with Interactive Simulator (Table 3)

**Simulator Logic**:
- Sliders for each metric (range: 80% to 200%)
- Real-time calculation using `calculateVariablePayFromPlan`
- Shows multiplier tier and logic type per metric
- Shows 75/25 split calculation

---

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useCurrentUserCompensation.ts` | CREATE | New hook that bypasses user_targets |
| `src/pages/Dashboard.tsx` | MODIFY | Complete redesign with 3 tables |
| `src/components/dashboard/MetricsTable.tsx` | CREATE | Reusable metrics summary table |
| `src/components/dashboard/MonthlyPerformanceTable.tsx` | CREATE | Monthly breakdown by metric |
| `src/components/dashboard/PayoutSimulator.tsx` | CREATE | Interactive what-if simulator |

---

### Data Sourcing Strategy

```text
Current User logs in
        │
        ▼
┌──────────────────────────┐
│   profiles table         │
│   (get employee_id)      │
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐     ┌──────────────────────┐
│   employees table        │     │  comp_plans table    │
│   (tvp_usd, sales_func)  │────▶│  (match by name)     │
└──────────────────────────┘     └──────────────────────┘
        │                               │
        ▼                               ▼
┌──────────────────────────┐     ┌──────────────────────┐
│   performance_targets    │     │  plan_metrics        │
│   (targets by metric)    │     │  (weightage, logic)  │
└──────────────────────────┘     └──────────────────────┘
        │                               │
        ▼                               ▼
┌──────────────────────────┐     ┌──────────────────────┐
│   deals table            │     │  multiplier_grids    │
│   (actuals)              │     │  (multiplier tiers)  │
└──────────────────────────┘     └──────────────────────┘
        │                               │
        └───────────────┬───────────────┘
                        ▼
              ┌─────────────────┐
              │   Dashboard     │
              │   (calculated)  │
              └─────────────────┘
```

---

### Technical Notes

1. **Plan Mapping Logic**:
   - Map `employees.sales_function` → `comp_plans.name`
   - Handle edge cases (null sales_function, unknown mappings)

2. **Monthly Breakdown**:
   - Already available in `useUserActuals` as `monthlyActuals` array
   - Split by metric type for the new table format

3. **What-If Simulator**:
   - Use Slider components from shadcn/ui
   - Call `getMultiplierFromGrid()` and `calculateMetricPayoutFromPlan()` on each change
   - Show live updates without database calls

4. **Holdback/Paid Split**:
   - 75% immediate payment
   - 25% holdback
   - Already implemented in commission calculations, now apply to variable pay

---

### Expected Results

| Before | After |
|--------|-------|
| "No Plan Assigned" | "Farmer" |
| Annual Target: $0 | Annual Target: $600,000 (New SW) + $1,600,000 (Closing ARR) |
| YTD Achieved: $0 | YTD Achieved: $793,159 (from deals) |
| Estimated Payout: $0 | Eligible Payout: ~$86,000 (calculated with 1.6x multiplier) |
| Static projections | Interactive what-if sliders per metric |

