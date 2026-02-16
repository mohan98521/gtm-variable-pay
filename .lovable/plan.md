
## Exclude Staff Users from Eligible Employees

### Change

Staff users (employees without a `sales_function`) should be excluded from both the "Eligible Employees" count and the "Total Active Employees" denominator on the fourth North Star card.

### File: `src/hooks/useExecutiveDashboard.ts`

Two lines change:

1. **`totalActiveEmployees`** (line 245): Add `sales_function` check
   - Current: `employees.filter((e) => e.is_active).length`
   - New: `employees.filter((e) => e.is_active && e.sales_function).length`

2. **`activePayees`** (around line 164): Filter the payout set to exclude staff employees by checking if the employee has a `sales_function` before counting them
   - Current: counts all unique `employee_id` values from payouts
   - New: only count those whose UUID maps to an employee with a `sales_function`

### No UI changes needed
The NorthStarCards component already displays `activePayees` and `totalActiveEmployees` correctly.
