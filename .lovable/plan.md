

## Team Lead Compensation Plan - Implementation

### Overview

Add "Team Lead" as a new sales function with support for **team-aggregate metrics** (prefixed with "Team ") that pull actuals from the Team Lead's direct reports instead of the TL's own deals.

### Changes

#### 1. Add "Team Lead" to SALES_FUNCTION_TO_PLAN (4 files)

Add these entries to the mapping in each file:
- `"Team Lead": "Team Lead"`
- `"Team Lead - Farmer": "Team Lead"`
- `"Team Lead - Hunter": "Team Lead"`

**Files:**
- `src/hooks/useCurrentUserCompensation.ts` (line 8-21)
- `src/hooks/useTeamCompensation.ts` (line 9-22)
- `src/hooks/useMyDealsWithIncentives.ts` (line 254-258)
- `src/lib/payoutEngine.ts` -- not needed here since it uses `user_targets` for plan lookup

#### 2. Team Actuals Aggregation in `useCurrentUserCompensation.ts`

After fetching the employee's own deals (around line 230-255), add logic to:

1. Check if any plan metric name starts with `"Team "` (e.g., "Team New Software Booking ARR")
2. If so, fetch direct reports: `employees.manager_employee_id = employeeId`
3. Query deals where any direct report is a participant
4. Sum their `new_software_booking_arr_usd` as the "Team" metric actual
5. Add to `actualsMap` with the full metric name (e.g., `"Team New Software Booking ARR"`)

For **Closing ARR** specifically: extend the existing closing ARR query to also include records where `sales_rep_employee_id` or `sales_head_employee_id` matches any direct report, giving the combined TL + team portfolio.

#### 3. Team Actuals Aggregation in `useTeamCompensation.ts`

Same logic as above, applied within the `directReports.map()` loop (around line 229-290). When computing compensation for a TL who is someone's direct report:

1. Detect "Team " prefix metrics in the TL's plan
2. Fetch the TL's own subordinates (sub-reports)
3. Aggregate their deals for team metrics
4. Extend closing ARR to include sub-reports

#### 4. Team Actuals Aggregation in `payoutEngine.ts`

In `calculateEmployeeVariablePay` (line 321-496), when iterating over plan metrics:

1. Check if `metric.metric_name` starts with `"Team "`
2. If so, fetch subordinates via `employees.manager_employee_id = empId`
3. For deal-based team metrics: query deals where subordinates are participants (instead of the employee themselves)
4. For closing ARR team inclusion: extend the OR filter to include subordinate employee IDs

### Technical Details

#### Helper function (shared pattern across files)

```typescript
// Fetch direct report employee IDs for team metrics
async function getDirectReportIds(managerEmployeeId: string): Promise<string[]> {
  const { data } = await supabase
    .from("employees")
    .select("employee_id")
    .eq("manager_employee_id", managerEmployeeId)
    .eq("is_active", true);
  return (data || []).map(e => e.employee_id);
}
```

#### Actuals aggregation for "Team " prefix metrics

```typescript
// For each metric prefixed with "Team ", aggregate subordinate deals
const baseMetricName = metricName.replace(/^Team /, "");
// e.g., "Team New Software Booking ARR" -> fetch subordinate deals' new_software_booking_arr_usd
```

#### Key rules
- TL's **own** deals are NOT counted in "Team " metrics -- only subordinates
- Individual metrics (without "Team " prefix) work exactly as before using participant roles
- Closing ARR combines TL + team when the metric name is "Closing ARR" and the employee is a Team Lead (or uses "Team Closing ARR" as a separate metric)
- No database schema changes needed

### Files Modified

| File | Change |
|---|---|
| `src/hooks/useCurrentUserCompensation.ts` | Add TL mapping + team actuals fetch for "Team " prefix metrics |
| `src/hooks/useTeamCompensation.ts` | Add TL mapping + team actuals fetch |
| `src/hooks/useMyDealsWithIncentives.ts` | Add TL mapping |
| `src/lib/payoutEngine.ts` | Add team actuals fetch in `calculateEmployeeVariablePay` |

