

## Full Self-Service Role Management System

### Problem
Currently, the 6 system roles (Admin, GTM Ops, Finance, Executive, Sales Head, Sales Rep) are hardcoded as a Postgres enum (`app_role`) and TypeScript type. There is no UI to create new roles (e.g., "Regional Manager", "Auditor") or configure their permissions dynamically.

### Architecture Change: Enum to Table-Driven Roles

The core change is migrating from a rigid Postgres enum to a flexible table-driven approach.

```text
CURRENT (rigid)                    NEW (flexible)
--------------------------         --------------------------
app_role ENUM                      roles TABLE
  admin                              id, name, label,
  sales_head                         description, color,
  sales_rep                          is_system_role, created_at
  gtm_ops
  finance                          user_roles.role -> TEXT
  executive                        role_permissions.role -> TEXT
```

### Step-by-Step Plan

#### 1. Database Migration

**Create `roles` reference table:**
- `id` (UUID, PK)
- `name` (TEXT, UNIQUE) -- machine name like "admin", "regional_manager"
- `label` (TEXT) -- display name like "Admin", "Regional Manager"  
- `description` (TEXT) -- e.g., "Full system access"
- `color` (TEXT) -- CSS class for badge styling
- `is_system_role` (BOOLEAN, default false) -- protects built-in roles from deletion
- `created_at` (TIMESTAMPTZ)

**Seed with existing 6 roles** (all marked `is_system_role = true`).

**Alter `user_roles` and `role_permissions` tables:**
- Change `role` column from `app_role` enum to `TEXT`
- Add foreign key to `roles(name)` for referential integrity

**RLS:** Only admins can manage the `roles` table.

#### 2. Code Changes -- Type System

**`src/hooks/useUserRole.ts`:**
- Change `AppRole` from a static string union to `string` type
- Fetch role metadata from the `roles` table instead of hardcoding
- Keep helper functions like `isAdmin()`, `hasRole()` working with string comparison

**`src/lib/permissions.ts`:**
- Remove hardcoded `ALL_ROLES` array
- Fetch roles dynamically from the `roles` table
- `PermissionKey` type stays as-is (permissions are still predefined)

#### 3. New UI -- "Role Builder" in System Section

Add a new admin sub-page under **System > Roles** (alongside Permissions):

**Role List View:**
- Table showing all roles with: Name, Label, Description, User Count, System badge
- "Add Role" button
- Edit/Delete actions (delete disabled for system roles)

**Add/Edit Role Dialog:**
- Fields: Name (slug, auto-generated from label), Label, Description, Color picker (preset options)
- On create: inserts into `roles` table AND auto-generates `role_permissions` rows for all permission keys (defaulting to `false`)
- Validation: name must be unique, lowercase, no spaces

**Delete Role:**
- Only allowed for non-system roles
- Confirmation dialog warning about affected users
- Cascades: removes from `user_roles` and `role_permissions`

#### 4. Update Existing UIs

**Role Management (`RoleManagement.tsx`):**
- Fetch roles from `roles` table instead of hardcoded `ALL_ROLES` array
- Dynamically render role options in the assignment dialog

**Permissions Matrix (`PermissionsManagement.tsx`):**
- Fetch column headers from `roles` table instead of hardcoded `ALL_ROLES`
- New roles automatically appear as columns

**Sidebar/Navigation:**
- No changes needed -- already driven by `role_permissions` table

#### 5. Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useUserRole.ts` | `AppRole` becomes `string`, add `useRoles()` hook |
| `src/lib/permissions.ts` | Remove hardcoded `ALL_ROLES`, export fetcher |
| `src/hooks/usePermissions.ts` | Update `AppRole` references to `string` |
| `src/components/admin/RoleManagement.tsx` | Fetch roles dynamically |
| `src/components/admin/PermissionsManagement.tsx` | Fetch role columns dynamically |
| `src/pages/Admin.tsx` | Add "Roles" nav item under System section |
| `src/components/admin/RoleBuilder.tsx` | **NEW** -- Role CRUD UI |
| `src/hooks/useRoles.ts` | **NEW** -- Hook to fetch/manage roles table |

#### 6. Safety Measures

- The 6 existing roles are marked `is_system_role = true` and cannot be deleted
- The "admin" role's permission to the Permissions tab remains locked
- Creating a new role auto-generates all permission rows (all `false` by default) so it appears immediately in the Permissions Matrix for configuration
- Role name validation prevents duplicates and special characters

### Technical Details

**Migration SQL overview:**
1. Create `roles` table with RLS
2. Seed 6 system roles
3. Alter `user_roles.role` from `app_role` enum to `TEXT` with FK to `roles(name)`
4. Alter `role_permissions.role` from `app_role` enum to `TEXT` with FK to `roles(name)`
5. Drop the `app_role` enum (after migration)
6. Add `tab:roles` permission key for access control

