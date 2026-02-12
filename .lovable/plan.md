

## Staff User Restrictions and Friendly Dashboard

### Overview

Two targeted changes to improve the experience for non-sales staff users:

1. **Filter the Staff User role dropdown** to exclude sales roles (`sales_rep`, `sales_head`), preventing accidental misuse of the simplified form for sales employees who need the full onboarding flow.

2. **Replace the empty "No compensation data found" screen** with a welcoming landing page for non-sales users, showing their name, role, and quick-navigation links to the sections they have access to (Admin, Reports, Data Inputs, etc.).

---

### Change 1: Filter Role Dropdown in StaffUserFormDialog

**File:** `src/components/admin/StaffUserFormDialog.tsx`

- Define a constant list of excluded sales role names: `["sales_rep", "sales_head"]`
- Filter the `roles` array before rendering the `SelectContent`, removing any role whose `name` matches the exclusion list
- This ensures the dropdown only shows staff-appropriate roles (Admin, GTM Ops, Finance, Executive, and any custom roles)

---

### Change 2: Friendly Staff Dashboard Landing Page

**File:** `src/pages/Dashboard.tsx`

When `compensation` is `null` (no plan assigned), instead of showing a bare "No compensation data found" message, render a welcoming landing page:

- Use `useUserRole()` to get the current user's roles
- Use `usePermissions()` to determine which pages are accessible
- Display:
  - A greeting with the user's name (fetched from the `profiles` table via a lightweight query)
  - Their assigned role as a badge (e.g., "GTM Ops", "Finance")
  - A set of quick-link cards for the pages they have permission to access (Admin, Reports, Data Inputs, Team View), each with an icon and short description
  - A subtle note: "You are not assigned to a compensation plan. This is expected for staff roles."
- This turns an empty dead-end screen into a useful navigation hub

---

### Technical Details

#### StaffUserFormDialog.tsx
```
const SALES_ROLES = ["sales_rep", "sales_head"];
const staffRoles = roles.filter(r => !SALES_ROLES.includes(r.name));
// Render staffRoles in the Select instead of roles
```

#### Dashboard.tsx
- Import `useUserRole` hook to detect role
- Import `usePermissions` hook to check page access
- Add a small query to fetch the current user's profile name (or use a lightweight existing hook)
- Replace the `!compensation` block (lines 40-53) with a new `StaffLandingPage` section containing:
  - Welcome header with user name
  - Role badge
  - Grid of navigation cards (filtered by permission) linking to `/admin`, `/reports`, `/data-inputs`, `/team`
  - Each card uses the same icon as the sidebar for consistency

No database changes or migrations are required.
