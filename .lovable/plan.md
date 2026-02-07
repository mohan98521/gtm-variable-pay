

# Plan: Build Real Team View for Managers

## Overview

Replace the current mock/static Team View page with a fully data-driven manager's dashboard that mirrors the Employee Dashboard's real compensation engine. The logged-in manager will see an employee-wise breakdown of all direct reports, with per-employee metrics, achievement, and payout details -- all pulled from live database tables.

## How It Works

The system identifies the logged-in user's `employee_id` from their profile, then finds all employees in the `employees` table whose `manager_employee_id` matches. For each direct report, it runs the same compensation calculation logic used in the personal Dashboard (targets, actuals from deals, plan metrics, multipliers, commissions) to produce a per-employee performance summary.

## Page Layout

```text
+-------------------------------------------------------------+
|  Team View                              FY 2026  |  Export   |
|  Monitor your direct reports' performance                    |
+-------------------------------------------------------------+
|                                                              |
|  [Team Members: 5]  [Team Achievement: 87.3%]  [Total TVP]  |
|  [Total Eligible]   [Total Paid (75%)]                       |
|                                                              |
+-------------------------------------------------------------+
|                                                              |
|  TEAM PERFORMANCE OVERVIEW (table)                           |
|  Employee | Plan | Target Bonus | Actual Achiev. | Eligible  |
|           |      |    (TVP)     |   Payout  %    |  Payout   |
|  ---------+------+--------------+----------------+-----------+
|  [Avatar] Farming Sales Rep | Farmer | $81K | 85% | $68K     |
|  [Avatar] Hunting Sales Rep | Hunter | $89K | 92% | $82K     |
|  ...expandable rows with metric breakdown...                 |
|                                                              |
+-------------------------------------------------------------+
|                                                              |
|  EMPLOYEE DETAIL (expandable per row)                        |
|  Metric-wise breakdown identical to Dashboard's MetricsTable |
|  + Commission breakdown if applicable                        |
|                                                              |
+-------------------------------------------------------------+
```

## Key Data Sources

| Data | Source Table | Join Key |
|------|-------------|----------|
| Direct reports list | `employees` (where `manager_employee_id` = manager's `employee_id`) | `employee_id` |
| Employee compensation config | `employees` (`tvp_usd`, `sales_function`) | `employee_id` |
| Plan mapping | `comp_plans` (matched by `sales_function` mapping) | `name` + `effective_year` |
| Plan metrics + multipliers | `plan_metrics` + `multiplier_grids` | `plan_id` |
| Plan commissions | `plan_commissions` | `plan_id` |
| Performance targets | `performance_targets` | `employee_id` + `effective_year` |
| Deal actuals (New SW Booking) | `deals` (participant role match) | `employee_id` across 8 participant columns |
| Closing ARR actuals | `closing_arr_actuals` | `sales_rep_employee_id` or `sales_head_employee_id` |

## Files to Create

### 1. `src/hooks/useTeamCompensation.ts` (New Hook)

The core data hook that:
- Gets the logged-in user's `employee_id` from their profile
- Queries all active employees where `manager_employee_id` matches
- For each direct report, runs the same compensation calculation logic as `useCurrentUserCompensation`:
  - Maps `sales_function` to plan name
  - Looks up plan metrics, multiplier grids, and commissions
  - Fetches performance targets
  - Aggregates deal actuals (New Software Booking ARR across all participant roles)
  - Aggregates Closing ARR actuals (latest month snapshot, eligibility filter)
  - Calculates achievement %, multipliers, eligible payouts, booking/collection/year-end splits
  - Calculates commission payouts
- Returns an array of `TeamMemberCompensation` objects (one per direct report)
- Also returns team-level aggregates (total TVP, total eligible, total paid, team achievement %)

**Interface:**
```text
TeamMemberCompensation {
  employeeId, employeeName, designation, salesFunction,
  planName, targetBonusUsd,
  metrics: MetricCompensation[],   -- same shape as Dashboard
  commissions: CommissionCompensation[],
  totalEligiblePayout, totalPaid, totalHoldback,
  totalCommissionPayout, totalCommissionPaid,
  overallAchievementPct
}
```

### 2. `src/components/team/TeamSummaryCards.tsx` (New Component)

Summary cards row showing:
- **Team Members**: count of direct reports
- **Team Target (TVP)**: sum of all reports' `tvp_usd`
- **Team Achievement**: weighted average achievement %
- **Total Eligible Payout**: sum of all eligible payouts (variable + commission)
- **Total Paid**: sum of all booking-split amounts

Uses the same Card styling as the Dashboard summary cards.

### 3. `src/components/team/TeamPerformanceTable.tsx` (New Component)

Main table with one row per direct report showing:
- Employee name + designation (with Avatar)
- Comp Plan name (Badge)
- Target Bonus (TVP USD)
- Overall Achievement % (color-coded: green/amber/red)
- Eligible Payout
- Amount Paid (booking split)
- Holdback (collection split)
- Status badge (On Track / At Risk / Behind based on achievement thresholds)

Each row is **expandable** (using Collapsible or Accordion) to reveal:
- A mini MetricsTable showing the metric-by-metric breakdown (Target, Actual, Achievement %, Multiplier, Eligible Payout)
- Commission summary if the employee has commission earnings

### 4. `src/components/team/TeamMemberDetail.tsx` (New Component)

The expandable detail panel rendered inside each table row. Reuses the same tabular format as `MetricsTable` and `CommissionTable` from the Dashboard but in a compact, embedded form.

## Files to Modify

### 5. `src/pages/TeamView.tsx` (Major Rewrite)

Replace all mock data with:
- `useTeamCompensation()` hook call
- Loading / empty / error states (matching Dashboard patterns)
- Render `TeamSummaryCards` + `TeamPerformanceTable`
- Export button triggers CSV download of team data
- Fiscal year context integration (data responds to year selector)

### 6. `src/App.tsx` (Minor Update)

Wrap the `/team` route with `ProtectedRoute` using `permissionKey="page:team_view"` to enforce access control (currently it's unprotected).

## Calculation Logic

The hook reuses the existing `compensationEngine.ts` functions:
- `calculateAchievementPercent(actual, target)` for per-metric achievement
- `getMultiplierFromGrid(achievementPct, planMetric)` for multiplier lookup
- Same payout formula: `(achievement% / 100) * allocation * multiplier`
- Same booking/collection/year-end split logic from plan metric config

**Status Determination:**
- Achievement >= 90%: "On Track" (green)
- Achievement >= 70%: "At Risk" (amber)
- Achievement < 70%: "Behind" (red)

## Edge Cases Handled

- **No direct reports**: Shows a friendly empty state ("No team members reporting to you")
- **Employee without a plan**: Shows "No Plan" badge; metrics/payouts display as zero
- **Employee with no targets**: Achievement shows 0%, payout calculations return 0
- **Employee with no deals**: Actuals show $0, achievement is 0%
- **Manager not linked**: If the logged-in user has no `employee_id` in their profile, shows an informational message

## No Database Changes Required

All necessary data relationships already exist:
- `employees.manager_employee_id` links reports to managers
- `profiles.employee_id` links auth users to employee records
- RLS policies on `employees`, `performance_targets`, `comp_plans`, `plan_metrics` already allow authenticated users to read
- RLS on `deals` allows `sales_head` role to read all deals (managers typically have this role)

## Technical Notes

- The hook batches all direct report calculations into a single `useQuery` call to minimize re-renders
- Deal attribution uses the same 8-participant-role matching as the personal Dashboard
- Closing ARR uses the same "latest month snapshot" logic with end_date eligibility filter
- The `SALES_FUNCTION_TO_PLAN` mapping is shared from the existing compensation engine constants

