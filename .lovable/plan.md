

## Make Sales Functions Configurable from Admin UI

### What Changes

Replace the hardcoded `SALES_FUNCTIONS` array with a database-backed `sales_functions` table, add an Admin UI to manage it, and add a permission row so access can be controlled per role.

### Database

Create a new `sales_functions` table:
- `id` (uuid, PK)
- `name` (text, unique, not null) -- e.g. "Farmer", "Hunter"
- `display_order` (integer, default 0) -- for sorting
- `is_active` (boolean, default true) -- soft-delete support
- `created_at` (timestamptz)

RLS: read access for all authenticated users; write access restricted to users with admin role.

### New Permission

Add `tab:sales_functions` to the permission system:
- Add entry to `PermissionKey` type in `src/lib/permissions.ts`
- Add definition to `PERMISSION_DEFINITIONS` array
- Seed the `role_permissions` table with the new key for all existing roles (enabled for admin by default)

### New Hook: `useSalesFunctions`

- `src/hooks/useSalesFunctions.ts`
- Fetches active sales functions sorted by `display_order`
- Provides mutations for add, update (rename), toggle active, reorder, and delete
- Query key: `["sales-functions"]`

### New Admin Component: `SalesFunctionsManagement`

- `src/components/admin/SalesFunctionsManagement.tsx`
- Table listing all functions with name, status badge, and action buttons
- "Add Function" dialog with name input
- Inline rename via edit button
- Toggle active/inactive
- Delete with confirmation (only if no employees currently use that function)
- Reorder via drag or up/down buttons

### Admin Page Wiring

In `src/pages/Admin.tsx`:
- Add `SalesFunctionsManagement` to the `contentMap`
- Add a new nav item under the **System** section: `{ id: "sales-functions", label: "Sales Functions", icon: Briefcase, permissionCheck: (c) => c.canAccessTab("tab:sales_functions") }`

### Replace Hardcoded Lists

**`src/components/admin/EmployeeFormDialog.tsx`**:
- Remove the `SALES_FUNCTIONS` const
- Import `useSalesFunctions` hook
- Populate the `SearchableSelect` options from the hook data

**`src/pages/Reports.tsx`**:
- Remove the `SALES_FUNCTIONS` const
- Import `useSalesFunctions` hook
- Build filter options from hook data (prepend "All")

### Technical Details

**Files Created:**
- `src/hooks/useSalesFunctions.ts` -- CRUD hook
- `src/components/admin/SalesFunctionsManagement.tsx` -- admin UI

**Files Modified:**
- `src/lib/permissions.ts` -- add `tab:sales_functions` permission key and definition
- `src/pages/Admin.tsx` -- register new tab under System section
- `src/components/admin/EmployeeFormDialog.tsx` -- replace hardcoded array with hook
- `src/pages/Reports.tsx` -- replace hardcoded array with hook

**Migration:**
- Create `sales_functions` table with RLS policies
- Seed table with all 18 current function names
- Insert `tab:sales_functions` permission row for all existing roles
