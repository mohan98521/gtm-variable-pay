

## Fix: Management Summary "By Sales Function" showing all as "Unknown"

### Root Cause
The `useManagementSummary` hook fetches employees and builds a lookup map keyed by `employees.employee_id` (a text field like "IN0001", "SA0002"). However, the `monthly_payouts.employee_id` column stores **UUIDs** (the `employees.id` column). Since the keys never match, every payout maps to "Unknown".

### Fix
In `src/hooks/useManagementSummary.ts`, change the employee query to select the UUID `id` field instead of the text `employee_id` field, and use that as the map key.

### Technical Details

**File: `src/hooks/useManagementSummary.ts`**

1. Change the employee query from:
   ```typescript
   .select("employee_id, sales_function")
   ```
   to:
   ```typescript
   .select("id, sales_function")
   ```

2. Change the map population from:
   ```typescript
   employeeFunctionMap.set(e.employee_id, e.sales_function || "Unknown");
   ```
   to:
   ```typescript
   employeeFunctionMap.set(e.id, e.sales_function || "Unknown");
   ```

Additionally, the query filters by `is_active = true`, which means employees who were deactivated mid-year would also show as "Unknown". We should remove the `is_active` filter so historical payouts for former employees are correctly attributed too.

No database changes needed. Single file fix.
