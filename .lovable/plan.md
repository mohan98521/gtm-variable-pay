

# Plan: Fix Payout Engine — Variable Pay and Multi-Employee Processing

## Problems Found

### Bug 1: Wrong `metric_type` value (VP = $0 for everyone)
**File**: `src/lib/payoutEngine.ts`, line 293

The query looks for `metric_type = 'new_software_arr'`, but the actual database value is `'New Software Booking ARR'`. This means no performance target is ever found, so `targetUsd = 0`, and VP calculation exits early with $0.

### Bug 2: Only `sales_rep_employee_id` is checked (only 1 employee gets payouts)
**File**: `src/lib/payoutEngine.ts`, lines 306 and 362

Both the VP deals query and the commission deals query filter only by `sales_rep_employee_id`. Per the multi-participant attribution policy, all 8 participant roles (Sales Rep, Sales Head, SE, SE Head, Product Specialist, Product Specialist Head, Solution Manager, Solution Manager Head) should receive full credit for deals they're associated with.

### Bug 3: Only "New Software Booking ARR" metric is calculated
The VP function only handles the "New Software" metric. Plans like "Farmer" have two 50/50 weighted metrics: "New Software Booking ARR" and "Closing ARR". The Closing ARR metric is completely ignored, meaning employees on such plans only get half their potential VP.

## Solution

### Fix 1: Correct metric_type value (line 293)
Change `'new_software_arr'` to `'New Software Booking ARR'` to match the actual database values.

### Fix 2: Multi-participant deal attribution (lines 302-308 and 359-363)
Replace the single `sales_rep_employee_id` filter with an `or()` filter that checks all 8 participant role columns. This ensures every employee assigned to a deal gets credit.

For example, the deals query becomes:
```typescript
const { data: deals } = await supabase
  .from('deals')
  .select('id, new_software_booking_arr_usd, month_year, project_id, customer_name')
  .or(`sales_rep_employee_id.eq.${empId},sales_head_employee_id.eq.${empId},sales_engineering_employee_id.eq.${empId},sales_engineering_head_employee_id.eq.${empId},product_specialist_employee_id.eq.${empId},product_specialist_head_employee_id.eq.${empId},solution_manager_employee_id.eq.${empId},solution_manager_head_employee_id.eq.${empId}`)
  .gte('month_year', `${ctx.fiscalYear}-01-01`)
  .lte('month_year', ctx.monthYear);
```

Same pattern applied to the commission deals query.

### Fix 3: Add Closing ARR metric calculation
Refactor `calculateEmployeeVariablePay` to iterate over ALL plan metrics (not just "New Software"), fetching the correct performance target and actuals for each. For "Closing ARR", actuals come from the `closing_arr_actuals` table instead of `deals`.

## Technical Details

### Changes in `src/lib/payoutEngine.ts`

| Location | Change |
|----------|--------|
| Line 293 | `'new_software_arr'` to `'New Software Booking ARR'` |
| Lines 302-308 | Replace `.eq('sales_rep_employee_id', ...)` with `.or(...)` checking all 8 roles |
| Lines 359-363 | Same multi-role `.or(...)` for commission deals query |
| Lines 267-339 | Refactor VP calculation to loop over all metrics, adding Closing ARR support using `closing_arr_actuals` table |

### Scope
1 file (`src/lib/payoutEngine.ts`), ~50 lines changed. No database migrations. No UI changes.

### Expected Result After Fix
- All 11 active employees should be processed (not just 1)
- Variable Pay should show non-zero values for employees with deals and targets
- Commissions should appear for all employees assigned to deals in any participant role
- Both "New Software Booking ARR" and "Closing ARR" metrics contribute to VP

