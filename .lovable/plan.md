

## Move Bulk Upload into Employee Accounts Tab

### What Changes

The "Bulk Upload" sidebar item under People will be removed as a standalone section and embedded directly inside the Employee Accounts component as a new tab alongside "Active" and "Inactive".

### 1. Update Employee Accounts Component

**File**: `src/components/admin/EmployeeAccounts.tsx`

- Import the `BulkUpload` component and the `Upload` icon
- Extend the existing `Tabs` component (currently has "Active" / "Inactive" tabs) to add a third tab: **"Bulk Upload"**
- Wrap the current employee table content inside `TabsContent value="active"` and `TabsContent value="inactive"`
- Add `TabsContent value="bulk-upload"` that renders the `<BulkUpload />` component
- The stats cards (Active Employees, With Accounts, etc.) and action buttons remain visible across all tabs

### 2. Remove Bulk Upload from Admin Sidebar Navigation

**File**: `src/pages/Admin.tsx`

- Remove the `{ id: "bulk-upload", ... }` entry from the People section's `items` array (line 57)
- Remove `"bulk-upload": BulkUpload` from the `contentMap` object (line 87)
- Remove the `BulkUpload` import (line 11)
- The `Upload` icon import can also be removed if not used elsewhere

### Result

The Admin sidebar will show only "Employee Accounts" and "Role Management" under the People section. When users navigate to Employee Accounts, they will see three tabs: **Active**, **Inactive**, and **Bulk Upload** -- keeping all employee-related functionality in one place.

