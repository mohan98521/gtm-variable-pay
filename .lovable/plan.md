

# Fix: Reports Section Visibility for All Roles

## Root Cause

The Reports section is invisible for Sales Rep, Executive, and Sales Head roles because the codebase uses **hardcoded role arrays** instead of the dynamic permissions system stored in the database.

| Location | Issue |
|----------|-------|
| `AppSidebar.tsx` | Hardcoded `allowedRoles: ["admin", "gtm_ops", "finance", "executive"]` |
| `App.tsx` | Hardcoded `allowedRoles={["admin", "gtm_ops", "finance", "executive"]}` |
| Database | **Correctly configured** - all 6 roles have `page:reports = true` |

The database permissions are correct, but the code ignores them.

---

## Solution

Migrate the sidebar navigation and route protection to use the **dynamic permissions system** (`usePermissions` hook) that queries the `role_permissions` table.

---

## Changes Required

### 1. Update AppSidebar.tsx

Replace hardcoded role arrays with dynamic permission checks from the `usePermissions` hook.

**Before:**
```typescript
const navigation = [
  { name: "Reports", href: "/reports", allowedRoles: ["admin", "gtm_ops", "finance", "executive"] },
];

const filteredNavigation = navigation.filter(item => 
  item.allowedRoles.some(allowedRole => roles.includes(allowedRole))
);
```

**After:**
```typescript
import { usePermissions } from "@/hooks/usePermissions";
import { PAGE_PERMISSION_MAP } from "@/lib/permissions";

const navigation = [
  { name: "Reports", href: "/reports", permissionKey: "page:reports" },
];

const { canAccessPage, isLoading: permissionsLoading } = usePermissions();

const filteredNavigation = navigation.filter(item => 
  canAccessPage(item.permissionKey)
);
```

### 2. Update ProtectedRoute Component

Modify `ProtectedRoute` to support both:
- Legacy `allowedRoles` prop (for backward compatibility)
- New `permissionKey` prop (for dynamic permissions)

**New Props Interface:**
```typescript
interface ProtectedRouteProps {
  children: ReactNode;
  // Legacy: hardcoded roles (still supported)
  allowedRoles?: AppRole[];
  // New: dynamic permission check
  permissionKey?: PermissionKey;
  redirectTo?: string;
}
```

### 3. Update App.tsx Routes

Update the `/reports` route to use the new permission-based approach.

**Before:**
```typescript
<ProtectedRoute allowedRoles={["admin", "gtm_ops", "finance", "executive"]}>
  <Reports />
</ProtectedRoute>
```

**After:**
```typescript
<ProtectedRoute permissionKey="page:reports">
  <Reports />
</ProtectedRoute>
```

---

## Implementation Details

### Updated Navigation Structure

```typescript
interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permissionKey: PermissionKey;
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permissionKey: "page:dashboard" },
  { name: "Team View", href: "/team", icon: Users, permissionKey: "page:team_view" },
  { name: "Plan Config", href: "/admin", icon: Settings, permissionKey: "page:plan_config" },
  { name: "Reports", href: "/reports", icon: BarChart3, permissionKey: "page:reports" },
  { name: "Data Inputs", href: "/data-inputs", icon: FileSpreadsheet, permissionKey: "page:data_inputs" },
];
```

### Updated ProtectedRoute Logic

```typescript
export function ProtectedRoute({ 
  children, 
  allowedRoles, 
  permissionKey,
  redirectTo = "/dashboard" 
}: ProtectedRouteProps) {
  const { roles, isLoading: rolesLoading, isAuthenticated } = useUserRole();
  const { canAccessPage, isLoading: permissionsLoading } = usePermissions();

  // Wait for both roles and permissions to load
  if (rolesLoading || permissionsLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Check access using permission key (preferred) or legacy roles
  const hasAccess = permissionKey 
    ? canAccessPage(permissionKey)
    : allowedRoles?.some(role => roles.includes(role)) ?? false;

  if (!hasAccess) {
    return <AccessDeniedCard />;
  }

  return <>{children}</>;
}
```

---

## Loading State Handling

The solution addresses the race condition mentioned in the Stack Overflow guidance by:

1. Checking **both** `rolesLoading` and `permissionsLoading` before rendering
2. Showing a loading spinner until all permission data is available
3. Only then evaluating access based on the fully loaded permissions

```typescript
if (rolesLoading || permissionsLoading) {
  return <LoadingSpinner />; // Prevents flash of incorrect UI
}
```

---

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/layout/AppSidebar.tsx` | MODIFY | Use `usePermissions` hook instead of hardcoded role arrays |
| `src/components/auth/ProtectedRoute.tsx` | MODIFY | Add `permissionKey` prop support with proper loading state |
| `src/App.tsx` | MODIFY | Update `/reports` route to use `permissionKey` |

---

## Result

After this fix:
- Reports section will appear in sidebar for all roles with `page:reports` enabled in database
- Admins can dynamically enable/disable Reports access via the Permissions tab
- No code changes needed to modify access - just update the database

