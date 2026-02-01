

## Connect Dashboard to Real Actuals & Enhance Incentive Audit Report

### Overview

This plan implements two major enhancements:

1. **Dashboard with Real Actuals** - Replace mock data with real actuals from `deals` and `closing_arr_actuals` tables
2. **Database-Driven Incentive Audit** - Replace hardcoded legacy calculation logic with the new `compensationEngine.ts`

---

### Current State Analysis

| Component | Current Implementation | Problem |
|-----------|----------------------|---------|
| **Dashboard** (lines 46-49) | Uses `mockAchievedPct` hardcoded values (0.71, 0.82) | Not reflecting real performance data |
| **Dashboard** (lines 88-98) | Mock monthly trend with hardcoded percentages | No actual monthly breakdown |
| **Incentive Audit** (lines 250-314) | Uses legacy `calculateBonusAllocation`, `getPayoutMultiplier` from `compensation.ts` | Ignores database-driven plan configurations, hardcoded multipliers |

---

### Data Flow Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                  │
├───────────────────────┬────────────────────┬───────────────────────┤
│       deals           │ closing_arr_actuals│  performance_targets  │
│ (new_software_booking)│   (closing_arr)    │    (annual targets)   │
└───────────┬───────────┴─────────┬──────────┴───────────┬───────────┘
            │                     │                      │
            ▼                     ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  NEW HOOKS (to be created)                          │
│   useUserActuals() - aggregates actuals by employee + metric type   │
└─────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   compensationEngine.ts                              │
│    calculateVariablePayFromPlan() - database-driven calculations    │
└─────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────┬─────────────────────────────────────────────┐
│       Dashboard       │            Incentive Audit Report           │
│   (personal view)     │         (all employees view)                │
└───────────────────────┴─────────────────────────────────────────────┘
```

---

### Implementation Steps

#### Step 1: Create `useUserActuals` Hook

New hook to fetch real actuals for the current user from deals and closing_arr_actuals tables.

**File:** `src/hooks/useUserActuals.ts`

```typescript
// Query logic:
// 1. Get current user's employee_id from profiles
// 2. Aggregate deals by month where sales_rep_employee_id matches
// 3. Sum new_software_booking_arr_usd for "New Software Booking ARR"
// 4. Aggregate closing_arr_actuals by month where sales_rep_employee_id matches
// 5. Sum closing_arr for "Closing ARR"
// 6. Return structured data by metric name and month
```

**Interface:**
```typescript
interface UserActuals {
  metricName: string;
  monthlyActuals: { month: string; value: number }[];
  ytdTotal: number;
}
```

---

#### Step 2: Update Dashboard.tsx

**Changes:**

| Section | Current | Updated |
|---------|---------|---------|
| Metric achievement | `mockAchievedPct = 0.71 / 0.82` | Fetch from `useUserActuals()` hook |
| Monthly trend | Hardcoded array of 8 months | Query actual monthly breakdown |
| Payout calculation | Already uses `generatePayoutProjections` | Use `calculateVariablePayFromPlan` for current payout |

**Key Updates:**

1. Import new `useUserActuals` hook
2. Replace mock achievement percentages (lines 46-49) with real actuals
3. Replace mock monthly trend (lines 88-98) with real monthly data
4. Calculate current payout using `calculateVariablePayFromPlan` from compensationEngine

---

#### Step 3: Create `useIncentiveAuditData` Hook

New hook to fetch and calculate incentive audit data for all employees using the database-driven engine.

**File:** `src/hooks/useIncentiveAuditData.ts`

**Logic:**
1. Fetch all employees with their plan assignments from `user_targets` + `comp_plans`
2. For each employee, get their `plan_metrics` with `multiplier_grids`
3. Fetch actuals from `deals` (New Software Booking) and `closing_arr_actuals` (Closing ARR)
4. Fetch targets from `performance_targets`
5. Use `calculateVariablePayFromPlan` to compute each employee's incentive breakdown
6. Return array of fully calculated results with metric-level detail

---

#### Step 4: Update Reports.tsx Incentive Audit Tab

**Changes:**

| Current (lines 250-314) | Updated |
|-------------------------|---------|
| Uses `calculateBonusAllocation` (hardcoded splits) | Uses `calculateMetricBonusAllocation` from compensationEngine |
| Uses `getPayoutMultiplier` (hardcoded multipliers) | Uses `getMultiplierFromGrid` from compensationEngine |
| Only supports "New Software Booking ARR" and "Closing ARR" | Supports any metric defined in plan_metrics |
| Uses `monthly_bookings` table | Uses `deals` and `closing_arr_actuals` directly |

**Updated Data Flow:**

```typescript
// For each employee:
const planConfig = getUserPlanConfiguration(employeeId);
const actuals = getEmployeeActuals(employeeId);
const targets = getPerformanceTargets(employeeId);

const result = calculateVariablePayFromPlan({
  userId: employeeId,
  planId: planConfig.planId,
  planName: planConfig.planName,
  targetBonusUSD: planConfig.targetBonusUsd,
  proRatedTargetBonusUSD: proRation.proRatedTargetBonusUSD,
  proRationFactor: proRation.proRationFactor,
  metrics: planConfig.metrics, // from plan_metrics + multiplier_grids
  metricsActuals: actuals,
});
```

---

### Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useUserActuals.ts` | Fetch current user's actuals from deals + closing_arr_actuals |
| `src/hooks/useIncentiveAuditData.ts` | Fetch all employees' incentive calculations using database-driven engine |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Dashboard.tsx` | Replace mock data with real actuals, use compensationEngine for calculations |
| `src/pages/Reports.tsx` | Refactor Incentive Audit to use new hook and database-driven calculations |

---

### Technical Details

#### Dashboard Actuals Query Logic

**New Software Booking ARR** (from deals table):
```sql
SELECT 
  date_trunc('month', month_year) as month,
  SUM(new_software_booking_arr_usd) as value
FROM deals
WHERE sales_rep_employee_id = :employee_id
  AND month_year >= :fiscal_year_start
  AND month_year <= :fiscal_year_end
GROUP BY date_trunc('month', month_year)
ORDER BY month
```

**Closing ARR** (from closing_arr_actuals table):
```sql
SELECT 
  date_trunc('month', month_year) as month,
  SUM(closing_arr) as value
FROM closing_arr_actuals
WHERE sales_rep_employee_id = :employee_id
  AND month_year >= :fiscal_year_start
  AND month_year <= :fiscal_year_end
GROUP BY date_trunc('month', month_year)
ORDER BY month
```

#### Employee-to-Actuals Mapping

The system maps employees to their actuals using:
- `deals.sales_rep_employee_id` → employee_id
- `closing_arr_actuals.sales_rep_employee_id` → employee_id

This is matched against `employees.employee_id` and then linked to `profiles.email` for user_targets lookup.

---

### Enhanced Incentive Audit Display

The updated Incentive Audit will show:

| Column | Source |
|--------|--------|
| Employee Name | employees.full_name |
| Plan Name | comp_plans.name (via user_targets) |
| Metric | plan_metrics.metric_name (multiple rows per employee) |
| Target | performance_targets.target_value_usd |
| Actual | Aggregated from deals/closing_arr_actuals |
| Achievement % | (Actual / Target) × 100 |
| Multiplier | From multiplier_grids based on achievement |
| Allocation | (target_bonus_usd × weightage_percent / 100) |
| Payout | (Achievement% / 100) × Allocation × Multiplier |

---

### Benefits

1. **Real-Time Data** - Dashboard reflects actual performance from data entry
2. **Database-Driven** - No hardcoded splits or multipliers; all from plan configuration
3. **Flexible Metrics** - Supports any number of metrics defined in plan_metrics
4. **Consistent Calculations** - Both Dashboard and Reports use the same compensationEngine
5. **Plan-Specific Rules** - Each employee's calculations respect their assigned plan's logic (Stepped, Gated, Linear)

