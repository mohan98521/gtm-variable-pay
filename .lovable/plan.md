

# Fix: Role-Based Data Filtering for Reports

## Summary

Sales Rep and Sales Head users are seeing the entire database in the Employee Master, Compensation Snapshot, and Incentive Audit tabs. These reports need to be filtered to show only data applicable to the logged-in user based on their role.

---

## Current Behavior

| Report Tab | Current Behavior | Expected for Sales Rep/Head |
|------------|------------------|----------------------------|
| Employee Master | Shows ALL employees | Only their own record |
| Compensation Snapshot | Shows ALL compensation | Only their own compensation |
| Incentive Audit | Shows ALL incentive data | Only their own incentive data |
| My Deals | Correctly filtered | Their deals only |
| My Closing ARR | Correctly filtered | Their records only |

---

## Data Visibility Rules

| Role | Employee Master | Compensation | Incentive Audit |
|------|----------------|--------------|-----------------|
| Admin | All employees | All | All |
| GTM Ops | All employees | All | All |
| Finance | All employees | All | All |
| Executive | All employees | All | All |
| Sales Head | Self + direct reports | Self + team | Self + team |
| Sales Rep | Self only | Self only | Self only |

---

## Changes Required

### 1. Update Reports.tsx Queries

Add role-based filtering to the Employee Master and Compensation Snapshot queries.

**Current Employee Query:**
```typescript
const { data: employees = [] } = useQuery({
  queryKey: ["employees-report"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("full_name");
    if (error) throw error;
    return data;
  },
});
```

**New Employee Query (with role filtering):**
```typescript
const { data: employees = [] } = useQuery({
  queryKey: ["employees-report", user?.id, roles],
  queryFn: async () => {
    // Check if user can view all data
    const canViewAll = roles.some(r => 
      ["admin", "gtm_ops", "finance", "executive"].includes(r)
    );
    
    if (canViewAll) {
      // Return all employees
      return await supabase.from("employees").select("*").order("full_name");
    }
    
    // Get current user's employee_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("employee_id")
      .eq("id", user.id)
      .maybeSingle();
    
    if (!profile?.employee_id) return [];
    
    // Sales Head: self + direct reports
    if (roles.includes("sales_head")) {
      return await supabase
        .from("employees")
        .select("*")
        .or(`employee_id.eq.${profile.employee_id},manager_employee_id.eq.${profile.employee_id}`)
        .order("full_name");
    }
    
    // Sales Rep: self only
    return await supabase
      .from("employees")
      .select("*")
      .eq("employee_id", profile.employee_id);
  },
});
```

### 2. Update useIncentiveAuditData Hook

Add role-based filtering to only return data for the current user (or team for Sales Head).

**New Logic:**
```typescript
export function useIncentiveAuditData(fiscalYear: number = 2026) {
  return useQuery({
    queryKey: ["incentive_audit_data", fiscalYear],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      // Check user roles
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      const roles = (userRoles || []).map(r => r.role);
      const canViewAll = ["admin", "gtm_ops", "finance", "executive"]
        .some(role => roles.includes(role));
      
      // Get user's employee_id if not admin
      let allowedEmployeeIds: string[] | null = null;
      
      if (!canViewAll) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("employee_id")
          .eq("id", user.id)
          .maybeSingle();
        
        if (!profile?.employee_id) return [];
        
        if (roles.includes("sales_head")) {
          // Sales Head: self + direct reports
          const { data: teamMembers } = await supabase
            .from("employees")
            .select("employee_id")
            .or(`employee_id.eq.${profile.employee_id},manager_employee_id.eq.${profile.employee_id}`);
          
          allowedEmployeeIds = (teamMembers || []).map(e => e.employee_id);
        } else {
          // Sales Rep: self only
          allowedEmployeeIds = [profile.employee_id];
        }
      }
      
      // ... existing fetch logic ...
      
      // Filter results at the end if restrictions apply
      if (allowedEmployeeIds) {
        return auditData.filter(row => 
          allowedEmployeeIds.includes(row.employeeId)
        );
      }
      
      return auditData;
    },
  });
}
```

### 3. Update Compensation Snapshot Query

Apply the same role-based filtering pattern to the user_targets query in Reports.tsx.

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/pages/Reports.tsx` | MODIFY | Add role-based filtering to employees and user_targets queries |
| `src/hooks/useIncentiveAuditData.ts` | MODIFY | Add role-based filtering with team support for Sales Head |

---

## Technical Implementation Details

### Reports.tsx Changes

1. Import `useUserRole` hook
2. Get current user and roles at component level
3. Modify `employees` query to filter by role
4. Modify `userTargets` query to filter by role
5. Update query keys to include user context for proper cache invalidation

### useIncentiveAuditData.ts Changes

1. Add user authentication check at start
2. Query user's roles
3. If admin/gtm_ops/finance/executive: return all data (existing behavior)
4. If sales_head: get team member employee_ids and filter
5. If sales_rep: filter to only their employee_id

---

## Team Hierarchy Logic for Sales Head

Sales Heads should see data for:
1. Their own record
2. Direct reports (employees where `manager_employee_id` matches their `employee_id`)

Query pattern:
```sql
SELECT * FROM employees 
WHERE employee_id = 'EMP001' 
   OR manager_employee_id = 'EMP001'
```

---

## Cache Invalidation

Query keys must include user context to prevent stale data when switching users:

```typescript
queryKey: ["employees-report", user?.id, JSON.stringify(roles)]
```

This ensures:
- Cache is invalidated on logout/login
- Different users see different data
- Role changes are reflected immediately

---

## Security Note

While client-side filtering provides a good UX, the underlying data is still accessible via the Supabase API. For complete security, RLS policies should also be updated on these tables. However, the `employees` table is a master data table typically visible to all authenticated users, so this client-side filtering provides appropriate role-based views without affecting the underlying data access patterns.

