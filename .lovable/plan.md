

## Add Plan Assignment Visibility to Payout Statements and Payout Run Details

### Problem

When an employee has mid-year compensation changes (split assignments), the Payout Statement and Payout Run Detail views show generic labels like "Variable Pay" without indicating which plan or target bonus was used for the calculation. This makes it impossible to verify that the correct plan was applied for a given month.

### Gaps to Fix

| Component | Gap | Fix |
|-----------|-----|-----|
| Payout Statement (hook) | VP items show hardcoded `metricName: 'Variable Pay'` with no plan context | Join `monthly_payouts.plan_id` to `comp_plans.name` and include plan name + target bonus |
| Payout Statement (UI) | Statement header shows no plan info | Add "Plan: [Plan Name]" and "Target Bonus: $X" to the header card |
| Payout Run Detail (hook) | `EmployeePayoutSummary` has no plan name field | Add `planName` field by joining `plan_id` to `comp_plans` |
| Payout Run Detail (UI) | Employee table has no Plan column | Add a "Plan" column showing which plan was active for that month |
| Dashboard | No blended target summary for multi-assignment years | Add a small info section when multiple assignments exist, showing each period and its OTE |

---

### Changes

#### 1. `src/hooks/usePayoutStatement.ts` -- Add plan context to statement data

- Add `planName` and `targetBonusUsd` fields to the `PayoutStatementData` interface
- In `fetchPayoutStatementData()`, after fetching `monthly_payouts`, extract the `plan_id` from the first payout record
- Join to `comp_plans` to get the plan name
- Join to `user_targets` to get the `target_bonus_usd` for the active assignment in that month
- Set `metricName` on VP items to the actual plan metric name (or plan name) instead of hardcoded `'Variable Pay'`

#### 2. `src/components/reports/PayoutStatement.tsx` -- Show plan in header

- In `StatementHeader`, display the plan name and target bonus below the employee name/period line
- Example: "Plan: Hunter FY2026 | Target Bonus: $25,000"

#### 3. `src/hooks/useMonthlyPayouts.ts` -- Add plan name to employee breakdown

- In `useEmployeePayoutBreakdown()`, after fetching payouts, collect unique `plan_id` values
- Batch-fetch plan names from `comp_plans`
- Add `planName` to `EmployeePayoutSummary` interface, populated from the first VP payout's `plan_id`

#### 4. `src/components/admin/PayoutRunDetail.tsx` -- Add Plan column

- Add a "Plan" column to the Employee Payouts table between Employee and Currency
- Display the plan name from the enriched `EmployeePayoutSummary`
- Add `planName` to CSV and XLSX exports

#### 5. `src/hooks/useDashboardPayoutSummary.ts` -- Add blended target info

- When fetching YTD payout summary, also query `user_targets` for the current employee in the fiscal year
- If multiple assignments exist, return an array of `{ planName, startDate, endDate, targetBonusUsd }` segments

#### 6. `src/pages/Dashboard.tsx` -- Show blended target info

- When `payoutSummary` contains multiple assignment segments, render a small info card below the summary cards showing:

```text
Assignment Periods:
  Jan - Jun 2026: Hunter FY2026 (OTE $100,000 | Target Bonus $20,000)
  Jul - Dec 2026: Hunter FY2026 (OTE $120,000 | Target Bonus $24,000)
```

---

### Technical Details

**Data flow**: `monthly_payouts.plan_id` (UUID) already stores which plan was used for each payout line. The fix is purely about joining this to `comp_plans.name` and surfacing it in the UI.

**Files to modify**:

| File | Action |
|------|--------|
| `src/hooks/usePayoutStatement.ts` | Add plan_id lookup, enrich VP items with plan name |
| `src/components/reports/PayoutStatement.tsx` | Show plan name + target bonus in header |
| `src/hooks/useMonthlyPayouts.ts` | Add planName to EmployeePayoutSummary |
| `src/components/admin/PayoutRunDetail.tsx` | Add Plan column to table + exports |
| `src/hooks/useDashboardPayoutSummary.ts` | Add multi-assignment segment data |
| `src/pages/Dashboard.tsx` | Render blended target info card |

No database changes are needed -- all required data (`plan_id` on `monthly_payouts`, plan names on `comp_plans`, assignments on `user_targets`) already exists.

