

## Exclude Staff Users from Compensation and Payout Logic

### Summary
Staff users (employees with `sales_function = null`) should be excluded from all compensation-related calculations, validations, counts, and settlement workflows. This ensures they don't appear as missing-plan warnings, inflate headcount numbers, or show up in F&F settlement eligibility.

---

### Change 1: Payout Engine -- Validation (HIGH)

**File:** `src/lib/payoutEngine.ts` (lines 219-222)

The `validatePayoutRunPrerequisites()` function fetches all active employees without filtering out staff. This causes staff users to appear in "missing plan assignment" warnings and "missing compensation rate" errors.

**Fix:** Add `.not('sales_function', 'is', null)` to the employee query at line 222, so the validation only checks sales-eligible employees.

---

### Change 2: Payout Engine -- Calculation (HIGH)

**File:** `src/lib/payoutEngine.ts` (lines 1570-1573)

The `runPayoutCalculation()` function fetches all active employees for the payout loop. Staff users get iterated over unnecessarily (they would be skipped due to having no plan assignment, but they still consume processing time and could cause edge-case errors).

**Fix:** Add `.not('sales_function', 'is', null)` to the employee query at line 1573.

---

### Change 3: Management Summary -- Function Breakdown (MEDIUM)

**File:** `src/hooks/useManagementSummary.ts` (lines 65-75)

The employee query fetches all active employees. Staff users without a `sales_function` are mapped to "Unknown" in the function breakdown, inflating headcount and distorting the by-function totals.

**Fix:** Add `.not('sales_function', 'is', null)` to the employees query at line 68. This removes "Unknown" from the function breakdown and ensures annual/quarterly totals only count payouts tied to sales-function employees.

---

### Change 4: F&F Settlement -- Employee Dropdown (LOW)

**File:** `src/components/admin/FnFSettlementManagement.tsx` (lines 28-40)

The `useEmployeesForFnf()` query fetches all employees. Staff users who depart do not need F&F commission settlements since they have no compensation plans.

**Fix:** Add `.not('sales_function', 'is', null)` to the employee query at line 34. This filters the "Initiate F&F" dropdown to only show departed sales-eligible employees.

---

### Technical Details

All four changes are single-line filter additions (`.not('sales_function', 'is', null)`) on existing Supabase queries. No database, schema, or RLS changes are required.

**Files to modify:**
- `src/lib/payoutEngine.ts` -- 2 query filters (validation + calculation)
- `src/hooks/useManagementSummary.ts` -- 1 query filter
- `src/components/admin/FnFSettlementManagement.tsx` -- 1 query filter

