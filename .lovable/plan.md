

## Fix: Closing ARR Payout Details Not Persisting

### Root Cause

The prefetch query for `closing_arr_actuals` (line 134 in `payoutEngine.ts`) only selects a limited set of columns:

```
id, month_year, closing_arr, end_date, is_multi_year, renewal_years, 
sales_rep_employee_id, sales_head_employee_id
```

But the audit capture code (lines 800-817) tries to read `pid`, `customer_name`, `customer_code`, `bu`, `product`, and `order_category_2` from these same records. Since those fields are not fetched, they are all `undefined`.

The `pid` column in `closing_arr_payout_details` is defined as `NOT NULL`, so inserting a record with `pid = undefined` (which becomes `null`) causes the batch insert to fail. The error is logged to console but the UI just shows an empty tab.

### Fix (single change)

Update the prefetch SELECT for `closing_arr_actuals` in `payoutEngine.ts` (line 134) to include the missing columns:

**Before:**
```
.select('id, month_year, closing_arr, end_date, is_multi_year, renewal_years, sales_rep_employee_id, sales_head_employee_id')
```

**After:**
```
.select('id, month_year, closing_arr, end_date, is_multi_year, renewal_years, sales_rep_employee_id, sales_head_employee_id, pid, customer_name, customer_code, bu, product, order_category_2')
```

### Files to modify
- `src/lib/payoutEngine.ts` -- line 134, expand the SELECT columns

After this fix, re-running the payout calculation will correctly persist the project-level details and the "Closing ARR" tab will display data.
