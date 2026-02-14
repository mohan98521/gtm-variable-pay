

## Make Employee Stats Cards Clickable for Downloads

### Overview
Add clickable download functionality to each of the 4 stats cards in the Employee Accounts section, mirroring the pattern already used in the Performance Targets tab.

### Changes

**File: `src/components/admin/EmployeeAccounts.tsx`**

1. **"Active Employees" card** -- On click, export all active employees (full 26-field Excel export)
2. **"With Accounts" card** -- On click, export only active employees who have an `auth_user_id` set
3. **"Pending Accounts" card** -- On click, export only active employees who do NOT have an `auth_user_id`
4. **"Inactive" card** -- On click, export all inactive employees

Each card will:
- Get `cursor-pointer` and `hover:shadow-md transition-shadow` classes
- Show a small `Download` icon as a visual affordance
- Reuse the existing `generateXLSX` / `downloadXLSX` utilities and the same 26-column definition already used for the Export button
- Show a toast if the list is empty ("No employees in this category")

### Technical Details

- Extract the existing column definition (lines 495-522) into a shared constant to avoid duplication across the Export button and the 4 card handlers
- Add 4 click handler functions that filter `activeEmployees` / `inactiveEmployees` by the relevant criteria and generate the download
- File naming convention: `active_employees.xlsx`, `employees_with_accounts.xlsx`, `employees_pending_accounts.xlsx`, `inactive_employees.xlsx`
- No database or backend changes required

