
# Update My Deals and My Closing ARR for Non-Sales Roles

## Problem
Currently, the "My Deals" and "My Closing ARR" reports filter data based on the user's `employee_id` matching participant roles. However, users with non-sales roles (admin, gtm_ops, finance, executive) don't have targets assigned and should see **all data** instead of data linked to their employee_id.

## Current Behavior
- **All users**: See only records where their `employee_id` matches a participant role
- This returns empty or limited data for admin, gtm_ops, finance, and executive users

## Desired Behavior
- **sales_rep and sales_head roles**: Continue to see only records linked to their employee_id
- **admin, gtm_ops, finance, executive roles**: See ALL records (no employee filtering)

## Solution

### File 1: `src/hooks/useMyActualsData.ts`

**Changes to `useMyDeals` hook:**
1. Fetch user's roles from `user_roles` table
2. Check if user has any "view all data" role (admin, gtm_ops, finance, executive)
3. If yes, return ALL deals without employee filtering
4. If no (sales_rep/sales_head), apply the existing participant role filtering

**Changes to `useMyClosingARR` hook:**
1. Fetch user's roles from `user_roles` table
2. Check if user has any "view all data" role
3. If yes, return ALL closing ARR records without employee filtering
4. If no (sales_rep/sales_head), apply the existing sales_rep/sales_head filtering

### Technical Implementation

```typescript
// Add helper to check for "view all data" roles
const VIEW_ALL_ROLES = ['admin', 'gtm_ops', 'finance', 'executive'] as const;

export function useMyDeals(selectedMonth: string | null) {
  const { selectedYear } = useFiscalYear();

  return useQuery({
    queryKey: ["my_deals", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Check if user has "view all data" role
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      const roles = (userRoles || []).map(r => r.role);
      const canViewAll = VIEW_ALL_ROLES.some(role => roles.includes(role));

      const fiscalYearStart = `${selectedYear}-01-01`;
      const fiscalYearEnd = `${selectedYear}-12-31`;

      // Build query for fiscal year
      let query = supabase
        .from("deals")
        .select("*")
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd)
        .order("month_year", { ascending: false });

      // Month filter if specified
      if (selectedMonth) {
        query = query
          .gte("month_year", `${selectedMonth}-01`)
          .lte("month_year", `${selectedMonth}-31`);
      }

      const { data: deals, error } = await query;
      if (error) throw error;

      // If user can view all, return all deals
      if (canViewAll) {
        return deals as DealRecord[];
      }

      // Otherwise, filter to deals where user is a participant
      const { data: profile } = await supabase
        .from("profiles")
        .select("employee_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.employee_id) return [];

      const employeeId = profile.employee_id;
      const filteredDeals = (deals || []).filter((deal) => {
        return PARTICIPANT_ROLES.some((role) => deal[role] === employeeId);
      });

      return filteredDeals as DealRecord[];
    },
  });
}
```

Similar logic will be applied to `useMyClosingARR`.

### Report Component Updates

The report components (`MyDealsReport.tsx` and `MyClosingARRReport.tsx`) will continue to work without changes since they just consume the data from the hooks. However, we should update the descriptions to be role-aware:
- For sales roles: "Deals contributing to **your** incentive computation"
- For admin roles: "**All** deals for the fiscal year"

### Update `src/components/reports/MyDealsReport.tsx`
- Import `useUserRole` hook
- Conditionally update the card description based on role

### Update `src/components/reports/MyClosingARRReport.tsx`
- Import `useUserRole` hook  
- Conditionally update the card description based on role

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/hooks/useMyActualsData.ts` | Add role check to return all data for admin/gtm_ops/finance/executive, filtered data for sales roles |
| `src/components/reports/MyDealsReport.tsx` | Update description text based on user role |
| `src/components/reports/MyClosingARRReport.tsx` | Update description text based on user role |

## Expected Outcome

- **Admin/GTM Ops/Finance/Executive users**: See all Deals and all Closing ARR records for the fiscal year
- **Sales Rep/Sales Head users**: Continue to see only records where they are a participant
- Dynamic report descriptions reflect whether user is viewing "all data" or "my data"
