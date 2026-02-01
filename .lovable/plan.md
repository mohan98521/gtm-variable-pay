

## Plan Assignment Feature Implementation

### Overview

Build a feature that allows Admins (and GTM Ops) to assign individual employees to compensation plans directly from the Admin interface. The feature will enable creating, editing, and removing plan assignments with effective dates and compensation values.

---

### Current State Analysis

**Existing Data Flow:**
- `employees` table stores master employee data including compensation targets (TFP, TVP, OTE)
- `profiles` table links to `auth.users` via `auth_user_id` for authenticated users
- `user_targets` table links `user_id` (profile.id) to `plan_id` (comp_plans.id) with effective dates
- Currently, assignments are only created via bulk CSV upload in `BulkUpload.tsx`

**Gap Identified:**
- No UI to manually assign an employee to a plan
- No way to view/manage existing assignments for an employee
- No way to view assigned employees from a plan's perspective

---

### Part 1: New Component - PlanAssignmentDialog

**Purpose:** Dialog to assign an employee to a compensation plan

**Trigger Points:**
1. Action menu in Employee Accounts table ("Assign to Plan")
2. Button in PlanBuilder page ("Assign Employees")

**Form Fields:**

| Field | Type | Description |
|-------|------|-------------|
| Employee | Display only | Pre-filled when opened from employee row |
| Plan | Dropdown | List of active plans for selected fiscal year |
| Effective Start Date | Date picker | Defaults to Jan 1 of fiscal year or hire date |
| Effective End Date | Date picker | Defaults to Dec 31 of fiscal year |
| Currency | Dropdown | Copied from employee's local_currency |
| TFP (Local Currency) | Number | Copied from employee master data |
| Target Bonus % | Number | Copied from employee master data |
| OTE (Local Currency) | Number | Auto-calculated or copied |
| TFP (USD) | Number | Copied from employee master data |
| Target Bonus (USD) | Number | Calculated |
| OTE (USD) | Number | Copied from employee master data |

**Auto-Population Logic:**
- When employee is selected, fetch their compensation data from `employees` table
- Pre-fill TFP, Target Bonus %, OTE values
- Calculate effective dates based on fiscal year context

---

### Part 2: New Hook - usePlanAssignments.ts

**Functions:**

| Hook | Purpose |
|------|---------|
| `useEmployeePlanAssignments(employeeId)` | Get all assignments for an employee |
| `useCreatePlanAssignment()` | Create new assignment |
| `useUpdatePlanAssignment()` | Update existing assignment |
| `useDeletePlanAssignment()` | Remove assignment |
| `usePlanAssignedEmployees(planId)` | Get all employees assigned to a plan |

**Key Logic:**
- Find `user_id` by matching employee's email to `profiles.email`
- Validate no overlapping date ranges for same user+plan
- Support upsert behavior to prevent duplicates

---

### Part 3: Employee Accounts Enhancement

**New Action in Dropdown Menu:**
- Add "Assign to Plan" action (icon: Target or Link)
- Opens `PlanAssignmentDialog` with employee pre-selected

**New Column (Optional):**
- "Assigned Plans" column showing count or list of active plan assignments
- Clicking opens a popover or navigates to assignment view

**UI Changes to EmployeeAccounts.tsx:**

```text
Actions Menu (existing)
├── Edit (existing)
├── Create Account (existing)
├── Impersonate (existing)
├── Deactivate (existing)
└── Assign to Plan (NEW) ← Opens dialog
```

---

### Part 4: View Assigned Employees (Plan Perspective)

**Location:** PlanBuilder page (src/pages/PlanBuilder.tsx)

**New Section:** "Assigned Employees" card

**Features:**
- Table showing all employees assigned to this plan
- Columns: Employee Name, Employee ID, Effective Period, OTE, Status
- Actions: Edit Assignment, Remove Assignment
- Button: "Assign Employee" to add new assignment

---

### Part 5: Employee Assignments View

**New Component:** EmployeeAssignmentsView

**Purpose:** Show all plan assignments for a specific employee

**Trigger:** Click on "Assigned Plans" badge/count in Employee table

**Features:**
- List of all historical and current assignments
- Ability to edit or delete each assignment
- Add new assignment button

---

### Implementation Phases

| Phase | Tasks |
|-------|-------|
| 1 | Create `src/hooks/usePlanAssignments.ts` with CRUD operations |
| 2 | Create `src/components/admin/PlanAssignmentDialog.tsx` |
| 3 | Update `src/components/admin/EmployeeAccounts.tsx` to add "Assign to Plan" action |
| 4 | Create `src/components/admin/AssignedEmployeesCard.tsx` for plan view |
| 5 | Update `src/pages/PlanBuilder.tsx` to include assigned employees section |
| 6 | Add "View Assignments" popover/dialog for employees |

---

### Files to Create

| File | Purpose |
|------|---------|
| src/hooks/usePlanAssignments.ts | CRUD hooks for plan assignments |
| src/components/admin/PlanAssignmentDialog.tsx | Form dialog for creating/editing assignments |
| src/components/admin/AssignedEmployeesCard.tsx | Table showing employees assigned to a plan |
| src/components/admin/EmployeeAssignmentsPopover.tsx | Popover showing plans assigned to an employee |

### Files to Modify

| File | Changes |
|------|---------|
| src/components/admin/EmployeeAccounts.tsx | Add "Assign to Plan" action, add "Plans" column |
| src/pages/PlanBuilder.tsx | Add Assigned Employees section |
| src/hooks/useUserTargets.ts | Add helper queries if needed |

---

### Technical Considerations

**User ID Resolution:**
The `user_targets` table uses `user_id` which references `profiles.id` (auth.users UUID). When assigning via employee:
1. Look up employee by `employee_id`
2. Get their `email`
3. Find matching `profiles` record by email
4. Use `profiles.id` as `user_id` for the assignment

**If No Auth Account:**
- If employee doesn't have an auth account yet, display a warning
- Offer to create account first, or allow assignment (will work once account is created)

**Validation Rules:**
- Effective start date must be before end date
- Dates should be within the plan's effective year
- Warn if employee already has an assignment to the same plan with overlapping dates

**Fiscal Year Context:**
- Use the global `FiscalYearContext` to default dates appropriately
- Filter plan dropdown to show only plans for the selected fiscal year

---

### UI/UX Considerations

1. **Smart Defaults:** Pre-populate compensation values from employee master data
2. **Validation Feedback:** Show clear error messages for date conflicts
3. **Confirmation:** Confirm before removing assignments
4. **Visual Indicators:** Badge showing number of plans assigned to each employee
5. **Quick Actions:** One-click assignment from employee row
6. **Responsive:** Dialog works well on desktop and tablet screens

---

### Database Considerations

No schema changes needed. The existing `user_targets` table structure supports this feature:
- `user_id` (uuid) - links to profiles.id
- `plan_id` (uuid) - links to comp_plans.id  
- `effective_start_date` and `effective_end_date` - assignment period
- Compensation fields: `target_bonus_percent`, `tfp_local_currency`, `ote_local_currency`, etc.

The RLS policies already allow:
- Admins to manage all user_targets
- GTM Ops to view all targets

---

### Summary

This feature provides a complete solution for managing employee plan assignments:

1. **From Employee View:** Assign employees to plans via the Employee Accounts action menu
2. **From Plan View:** See and manage all employees assigned to a specific plan
3. **Quick Assignment:** Pre-populated values from employee master data reduce data entry
4. **Full CRUD:** Create, view, update, and delete assignments
5. **Validation:** Date range checks and duplicate prevention

