
# Fix Closing ARR Computation Logic

## Problems Identified

### Issue 1: Eligibility Filter Not Applied in Achievement Calculation
Currently, the system sums ALL Closing ARR records for achievement. Per business rules, only **Eligible Closing ARR** (projects with `end_date > Dec 31, {fiscalYear}`) should be counted toward achievement.

**Current:** Uses total Closing ARR = $2.08M (12 projects)  
**Expected:** Uses Eligible Closing ARR = $181K (2 projects with end_date > 2026-12-31)

### Issue 2: Sales Head Attribution Missing for Closing ARR
The Incentive Audit report only checks `sales_rep_employee_id` for Closing ARR attribution. Your bulk upload includes both `sales_rep_id` and `sales_head_id`, but the Sales Head is not being credited.

### Issue 3: Non-Cumulative Monthly Logic for Closing ARR
Unlike Deals (which ARE cumulative), Closing ARR uploads are monthly **snapshots** of the ARR portfolio. When you upload Jan with $500K and Feb with $700K, the Feb value represents the current portfolio state, not an addition.

**Current Logic:** YTD = Jan + Feb + ... (cumulative)  
**Correct Logic:** Use only the **latest month's** eligible Closing ARR

---

## Solution Overview

### Step 1: Update `useCurrentUserCompensation.ts`
- Add eligibility filter: only include records where `end_date > Dec 31, {fiscalYear}`
- Update query to use OR condition for both `sales_rep_employee_id` and `sales_head_employee_id`
- Change aggregation logic: instead of summing all months, use only the **latest month** data

### Step 2: Update `useUserActuals.ts`
- Apply same eligibility filter and latest-month logic for Closing ARR
- Ensure Sales Head attribution works correctly

### Step 3: Update `useIncentiveAuditData.ts`
- Apply eligibility filter in the Closing ARR query
- Add `sales_head_employee_id` attribution for Closing ARR aggregation
- Implement latest-month logic instead of cumulative sum

### Step 4: Update Monthly Breakdown Display
- Keep monthly breakdown showing each month's values for transparency
- Clearly indicate which month is being used for achievement

---

## Technical Details

### File 1: `src/hooks/useCurrentUserCompensation.ts`

**Changes to Closing ARR query (lines 244-260):**

```typescript
// Before: Fetches ALL records and sums cumulatively
const { data: closingArr } = await supabase
  .from("closing_arr_actuals")
  .select("month_year, closing_arr, sales_rep_employee_id, sales_head_employee_id")
  .or(`sales_rep_employee_id.eq.${employeeId},sales_head_employee_id.eq.${employeeId}`)
  .gte("month_year", fiscalYearStart)
  .lte("month_year", fiscalYearEnd);

// After: Add eligibility filter and use latest month only
const { data: closingArr } = await supabase
  .from("closing_arr_actuals")
  .select("month_year, closing_arr, end_date, sales_rep_employee_id, sales_head_employee_id")
  .or(`sales_rep_employee_id.eq.${employeeId},sales_head_employee_id.eq.${employeeId}`)
  .gte("month_year", fiscalYearStart)
  .lte("month_year", fiscalYearEnd)
  .gt("end_date", `${selectedYear}-12-31`); // ELIGIBILITY FILTER

// New aggregation logic:
// 1. Group by month
// 2. Use only the LATEST month's total for achievement
// 3. Keep all months for monthly breakdown display
```

**New aggregation logic:**
```typescript
const closingByMonth = new Map<string, number>();
(closingArr || []).forEach((arr) => {
  const monthKey = arr.month_year?.substring(0, 7) || "";
  closingByMonth.set(monthKey, (closingByMonth.get(monthKey) || 0) + (arr.closing_arr || 0));
});

// Find the latest month with data
const sortedMonths = Array.from(closingByMonth.keys()).sort();
const latestMonth = sortedMonths[sortedMonths.length - 1];
const closingYtd = latestMonth ? closingByMonth.get(latestMonth) || 0 : 0;
```

---

### File 2: `src/hooks/useUserActuals.ts`

**Changes to useUserActuals (lines 108-137):**
- Add `end_date` to the select query
- Apply eligibility filter: `.gt("end_date", `${selectedYear}-12-31`)`
- Change aggregation to use latest month only

**Changes to useEmployeeActuals (lines 195-204):**
- Add `sales_head_employee_id` to the OR condition
- Add eligibility filter
- Change to latest-month logic

---

### File 3: `src/hooks/useIncentiveAuditData.ts`

**Changes (lines 245-259):**
```typescript
// Before
const { data: closingArr } = await supabase
  .from("closing_arr_actuals")
  .select("sales_rep_employee_id, closing_arr")
  ...

// After
const { data: closingArr } = await supabase
  .from("closing_arr_actuals")
  .select("month_year, sales_rep_employee_id, sales_head_employee_id, closing_arr, end_date")
  .gte("month_year", fiscalYearStart)
  .lte("month_year", fiscalYearEnd)
  .gt("end_date", `${fiscalYear}-12-31`); // ELIGIBILITY FILTER

// New aggregation: Group by employee, then take latest month's value
const closingActualMap = new Map<string, Map<string, number>>(); // employee -> month -> value

(closingArr || []).forEach(arr => {
  // Credit BOTH sales_rep AND sales_head
  [arr.sales_rep_employee_id, arr.sales_head_employee_id].forEach(empId => {
    if (empId) {
      const monthKey = arr.month_year?.substring(0, 7) || "";
      const empMap = closingActualMap.get(empId) || new Map<string, number>();
      empMap.set(monthKey, (empMap.get(monthKey) || 0) + (arr.closing_arr || 0));
      closingActualMap.set(empId, empMap);
    }
  });
});

// For each employee, use only the latest month's value
const employeeClosingActuals = new Map<string, number>();
closingActualMap.forEach((monthMap, empId) => {
  const sortedMonths = Array.from(monthMap.keys()).sort();
  const latestMonth = sortedMonths[sortedMonths.length - 1];
  employeeClosingActuals.set(empId, latestMonth ? monthMap.get(latestMonth) || 0 : 0);
});
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `useCurrentUserCompensation.ts` | Add eligibility filter + Sales Head attribution + latest-month logic |
| `useUserActuals.ts` | Add eligibility filter + latest-month logic for both hooks |
| `useIncentiveAuditData.ts` | Add eligibility filter + Sales Head attribution + latest-month aggregation |

## Expected Outcome

After implementation:
- **Farming Sales Head** (DU0002) with Closing ARR target of $2M will show:
  - **Actual:** ~$181K (only the 2 eligible projects: pid 220020001 + pid 180101078)
  - **Achievement:** ~9% (not 129.8% as currently shown incorrectly)
- **Both Sales Rep and Sales Head** will receive credit for Closing ARR records
- Each month's upload is treated as a portfolio snapshot, not cumulative additions
