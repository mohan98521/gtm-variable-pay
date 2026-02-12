

## Add Staff User -- Simplified One-Step Onboarding

### What This Solves

Today, onboarding a non-sales user (GTM Ops, Finance, Admin, Executive) requires three separate steps across two different admin screens: add employee, create account, then assign role. This plan adds a single streamlined dialog that does all three in one click.

### User Experience

A new "Add Staff User" button will appear alongside the existing "Add Employee" button on the Employee Accounts page. Clicking it opens a compact dialog with only 4 fields:

- **Full Name** (required)
- **Employee ID** (required)
- **Email** (required, must be @azentio.com)
- **Role** (required, dropdown populated from the `roles` table)

On submit, the system will automatically:
1. Insert the employee record (with no sales/compensation fields)
2. Call the `create-employee-account` edge function to create the auth account
3. Assign the selected role in `user_roles`
4. Show a success toast with the temporary password

### Technical Details

#### New File: `src/components/admin/StaffUserFormDialog.tsx`
- A lightweight dialog component with a Zod-validated form (4 fields only)
- Uses `useRoles()` hook to populate the role dropdown dynamically
- On submit, orchestrates 3 sequential operations:
  1. `supabase.from('employees').insert(...)` -- minimal record (employee_id, full_name, email, is_active, local_currency default)
  2. `supabase.functions.invoke('create-employee-account', ...)` -- creates auth user
  3. `supabase.from('user_roles').insert(...)` -- assigns selected role using the `auth_user_id` returned from step 2
- Handles errors at each step with clear feedback (e.g., if employee already exists, if account creation fails)
- On success, invalidates employee and role queries to refresh the table

#### Modified File: `src/components/admin/EmployeeAccounts.tsx`
- Add a second button "Add Staff User" (with a `UserPlus` icon) next to the existing "Add Employee" button
- Wire up the new `StaffUserFormDialog` with open/close state

#### Edge Function: No changes needed
- The existing `create-employee-account` edge function already handles everything needed (creates auth user, links to employee, creates profile, assigns `sales_rep` role by default)
- The staff user flow will override the default `sales_rep` role by inserting the correct role after account creation

#### No database migration needed
- All tables and columns already exist
- The `roles` table is already queryable for the dropdown
