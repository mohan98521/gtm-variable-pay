

## Org-Level Rollup Actuals for Overlay/Executive Roles

### The Scenario

Certain employees (e.g., COO, VP Sales, GTM Ops leaders) carry a single metric target for "New Software Booking ARR" at the **overall organizational level**. Their target is the sum of all individual sales reps' targets, and their actuals should be the **total of ALL deals across the organization** -- not filtered by participant role or team hierarchy.

### Design Approach

Introduce a new metric name prefix: **"Org "** (e.g., "Org New Software Booking ARR"). When the engine encounters this prefix, it fetches ALL deals without any participant or manager filter, giving the full organizational total.

```text
+-----------------------------+-------------------------------------------+
| Metric Name                 | Actuals Logic                             |
+-----------------------------+-------------------------------------------+
| New Software Booking ARR    | Individual (participant-based)             |
| Team New Software Booking   | Direct reports only (manager hierarchy)    |
| Org New Software Booking    | ALL deals, no filter (org-wide total)      |
+-----------------------------+-------------------------------------------+
```

### Setup (No Code Changes -- Use Existing UI)

1. **Create a comp plan** (e.g., "Overlay" or "Executive") in Plan Builder with one metric: **"Org New Software Booking ARR"** (100% weightage, Linear or Stepped logic)
2. **Assign** the employee to this plan via Plan Assignments
3. **Set performance target**: metric_type = "Org New Software Booking ARR", target = org-wide number (e.g., $50M)
4. **Set employee's sales_function** to match the plan mapping (e.g., "Overlay" or "Executive")

### Code Changes

#### 1. Add Sales Function Mappings (3 files)

Add to `SALES_FUNCTION_TO_PLAN` in:
- `src/hooks/useCurrentUserCompensation.ts`
- `src/hooks/useTeamCompensation.ts`
- `src/hooks/useMyDealsWithIncentives.ts`

New entries:
```
"Overlay": "Overlay"
"Executive": "Executive"
```

#### 2. Org Actuals Aggregation in `useCurrentUserCompensation.ts`

After the existing team metrics block (around line 260-286), add a new block:

- Detect metrics starting with `"Org "`
- For `"Org New Software Booking ARR"`: sum ALL deals' `new_software_booking_arr_usd` without any participant filter
- Store in `orgNewBookingYtd`
- Add to `actualsMap` with the full metric name

#### 3. Org Actuals in `useUserActuals.ts`

In `useEmployeeActuals`, when computing actuals for an employee with an "Org " metric, sum all deals without participant filtering.

#### 4. Org Actuals in `payoutEngine.ts`

In `calculateEmployeeVariablePay` (around line 362-379), extend the existing `isTeamMetric` check to also handle `isOrgMetric`:

- When `metric.metric_name.startsWith("Org ")`: skip participant filtering entirely
- Sum ALL deals' `new_software_booking_arr_usd` for the fiscal year as the actual

#### 5. Org Actuals in `useTeamCompensation.ts`

Same logic in the team view computation loop -- if one of a manager's reports is an "Org " metric holder, their actuals should reflect the org total.

### Summary of Changes

| File | Change |
|---|---|
| `src/hooks/useCurrentUserCompensation.ts` | Add "Overlay"/"Executive" mapping; add "Org " prefix actuals (unfiltered deal sum) |
| `src/hooks/useTeamCompensation.ts` | Add mapping; add "Org " prefix actuals |
| `src/hooks/useMyDealsWithIncentives.ts` | Add mapping |
| `src/lib/payoutEngine.ts` | Add "Org " prefix detection in VP calculation -- fetch all deals unfiltered |
| `src/hooks/useUserActuals.ts` | Add "Org " prefix support in `useEmployeeActuals` |

### Key Rules

- `"Org "` prefix = ALL deals in the org, no participant or hierarchy filter
- Only `new_software_booking_arr_usd` is aggregated (single metric use case)
- No database schema changes needed
- Comp plan, targets, and assignments all use the existing UI
- The "Org " convention is clean and extensible (e.g., "Org Closing ARR" could be added later)

