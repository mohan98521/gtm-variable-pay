
# Fix: Multi-Employee Variable Pay Attribution for Admin Users

## Problem Statement

When admin/gtm_ops/finance/executive users view the My Deals report, the Variable Pay columns show empty/null values because the current implementation only calculates VP for the logged-in user's employee_id.

**Current behavior:**
- Sales Rep/Sales Head: VP is calculated correctly (using their employee_id)
- Admin/GTM Ops/Finance/Executive: VP columns are empty (no calculation happens)

**Expected behavior:**
- Admin users should see VP attribution for ALL deals, calculated separately for each employee's deals

---

## Solution Overview

For admin users viewing all deals, the system needs to:

1. Identify all unique employees who participate in the displayed deals
2. For each employee, fetch their VP configuration (plan, target, TVP)
3. Calculate VP attributions for each employee's deals separately
4. Merge all attributions back into the main deal list

---

## Calculation Logic for Multi-Employee View

```text
For Admin Users:

1. Fetch ALL deals for the fiscal year
2. Extract unique employee IDs from all 8 participant role columns
3. For EACH unique employee:
   a. Fetch their VP config (sales_function -> plan -> metric -> target -> TVP)
   b. Filter deals where they are a participant
   c. Calculate pro-rata VP attribution for their deals
   d. Store attributions keyed by (deal_id, employee_id)
4. When building the deal list, attach VP data based on sales_rep_employee_id
   (since that's the primary role for variable pay)
```

---

## Which Employee Gets VP Attribution on a Deal?

A deal can have up to 8 participant roles. For the purpose of VP display in the report:

| Scenario | VP Attribution Displayed |
|----------|-------------------------|
| Sales Rep views their own deals | Their own VP attribution |
| Admin views all deals | VP attribution for the **Sales Rep** on each deal |

This is because the primary role for New Software Booking ARR variable pay is typically the Sales Rep. The report shows one VP value per deal row.

---

## File Changes

### 1. Update `useMyDealsWithIncentives.ts`

**Current code (lines 423-462):**
```typescript
// Calculate Variable Pay Attribution if user has employee_id
let vpAttributionMap = new Map<string, DealVariablePayAttribution>();

if (employeeId) {
  // Fetch VP config for the employee
  const vpConfig = await fetchEmployeeVPConfig(employeeId, selectedYear);
  // ... calculate attributions
}
```

**New code:**
```typescript
// Calculate Variable Pay Attribution
let vpAttributionMap = new Map<string, DealVariablePayAttribution>();

if (canViewAll) {
  // For admin users: calculate VP for ALL employees with deals
  vpAttributionMap = await calculateVPForAllEmployees(
    filteredDeals,
    selectedYear,
    fiscalYearStart,
    fiscalYearEnd
  );
} else if (employeeId) {
  // For sales users: calculate VP for their own deals only
  // ... existing logic
}
```

### 2. New Helper Function: `calculateVPForAllEmployees`

```typescript
async function calculateVPForAllEmployees(
  deals: Deal[],
  fiscalYear: number,
  fiscalYearStart: string,
  fiscalYearEnd: string
): Promise<Map<string, DealVariablePayAttribution>> {
  const vpMap = new Map<string, DealVariablePayAttribution>();
  
  // Step 1: Extract unique employee IDs from sales_rep_employee_id column
  const uniqueEmployeeIds = new Set<string>();
  deals.forEach(deal => {
    if (deal.sales_rep_employee_id) {
      uniqueEmployeeIds.add(deal.sales_rep_employee_id);
    }
  });
  
  // Step 2: Fetch all YTD deals for VP calculation
  const { data: ytdDeals } = await supabase
    .from("deals")
    .select("id, new_software_booking_arr_usd, month_year, ...")
    .gte("month_year", fiscalYearStart)
    .lte("month_year", fiscalYearEnd);
  
  // Step 3: For each unique employee, calculate their VP attribution
  for (const empId of uniqueEmployeeIds) {
    const vpConfig = await fetchEmployeeVPConfig(empId, fiscalYear);
    if (!vpConfig || vpConfig.targetUsd <= 0) continue;
    
    // Filter to this employee's deals
    const employeeDeals = ytdDeals.filter(d => 
      d.sales_rep_employee_id === empId
    );
    
    // Calculate VP attributions
    const vpResult = calculateDealVariablePayAttributions(
      employeeDeals,
      empId,
      vpConfig.metric,
      vpConfig.targetUsd,
      vpConfig.bonusAllocationUsd,
      fiscalYear,
      calculationMonth
    );
    
    // Add to map (keyed by deal_id)
    vpResult.attributions.forEach(attr => {
      vpMap.set(attr.dealId, attr);
    });
  }
  
  return vpMap;
}
```

---

## Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| Employee has no sales_function | Skip VP calculation (no plan mapping) |
| Employee has no performance_target | Skip VP calculation (target = 0) |
| Employee has no TVP | VP = 0 (no bonus allocation) |
| Deal has no sales_rep_employee_id | VP columns show null/empty |
| Multiple employees on same deal | VP shown for Sales Rep role only |

---

## Performance Considerations

**Concern:** Fetching VP config for each employee in a loop could be slow.

**Optimizations:**
1. Batch fetch all employees' data in a single query
2. Batch fetch all plans and metrics
3. Create lookup maps for efficient access

```typescript
// Batch fetch instead of N individual queries
const employeeIds = Array.from(uniqueEmployeeIds);
const { data: employees } = await supabase
  .from("employees")
  .select("employee_id, tvp_usd, sales_function")
  .in("employee_id", employeeIds);

const { data: perfTargets } = await supabase
  .from("performance_targets")
  .select("employee_id, target_value_usd")
  .in("employee_id", employeeIds)
  .eq("effective_year", fiscalYear)
  .eq("metric_type", "New Software Booking ARR");
```

---

## Implementation Steps

| Step | Description |
|------|-------------|
| 1 | Create optimized batch fetch helper function `fetchAllEmployeeVPConfigs` |
| 2 | Create `calculateVPForAllEmployees` function |
| 3 | Modify main hook to use new logic when `canViewAll` is true |
| 4 | Ensure VP summary in report aggregates correctly across all employees |

---

## Modified File Summary

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useMyDealsWithIncentives.ts` | MODIFY | Add multi-employee VP calculation for admin users |

---

## Expected Result

After implementation:

| User Type | VP Columns Display |
|-----------|-------------------|
| Sales Rep | Their own VP values per deal |
| Sales Head | Their own VP values per deal |
| Admin/GTM Ops/Finance/Executive | VP values for the Sales Rep on each deal |

The Variable Pay Summary section will aggregate VP across all displayed deals, showing the total clawback exposure across the organization.
