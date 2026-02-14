

## Validate Plan Assignment Dates Against Employee Joining and Exit Dates

### Current State

**What works today:**
- When creating a new plan assignment, the start date auto-populates from the employee's Date of Joining and the end date from their Last Working Day (or fiscal year boundaries as fallback).
- When an employee's departure date is set via the Employee Form, any plan assignments ending after that date are automatically shortened (`autoEndAssignments` logic).

**What is missing:**
- No validation prevents assigning a plan **before** the employee's joining date.
- No validation prevents assigning a plan **after** the employee's departure date.
- No warning or auto-update when an employee's **joining date is changed** and existing assignments start before the new joining date.
- The overlap check in `usePlanAssignments.ts` only checks for date conflicts between assignments, not against the employee's tenure window.

---

### Changes

#### 1. PlanAssignmentDialog.tsx -- Add tenure-boundary validation

- Add a **warning alert** (non-blocking) if the selected start date is before the employee's `date_of_hire`.
- Add a **warning alert** if the selected end date is after the employee's `departure_date` (when set).
- Add a **blocking validation error** if the entire assignment falls completely outside the employee's tenure (start date after departure, or end date before joining).
- Show helpful text like: "Start date is before employee's joining date (Jan 15, 2026). The assignment will only be effective from their joining date onward."

#### 2. PlanAssignmentDialog.tsx -- Auto-clamp dates on employee change

- When the user picks a start date earlier than `date_of_hire`, show the warning but allow it (some companies pre-assign plans).
- When the user picks an end date later than `departure_date`, show a warning and offer a "Use departure date" quick-fix button.

#### 3. EmployeeFormDialog.tsx -- Auto-update assignments on joining date change

- Extend the existing `autoEndAssignments` pattern to also handle joining date changes:
  - When `date_of_hire` is updated to a **later** date, find any assignments with `effective_start_date` before the new joining date and offer to adjust them.
  - Auto-update those assignments' start dates to match the new joining date, with a toast notification.
- The existing departure date auto-end logic remains unchanged.

#### 4. usePlanAssignments.ts -- Add tenure validation in create/update mutations

- Before inserting or updating an assignment, fetch the employee's `date_of_hire` and `departure_date` from the `employees` table.
- If the assignment's start date is before `date_of_hire`, add a warning in the toast (non-blocking).
- If the assignment's end date is after `departure_date` (when set), automatically clamp the end date to the departure date and notify via toast.

---

### Technical Details

**File: `src/components/admin/PlanAssignmentDialog.tsx`**
- Add computed state variables `isBeforeJoining` and `isAfterDeparture` derived from form watch values vs employee props.
- Render conditional `Alert` components (amber/warning style) between the date pickers and the compensation fields.
- Add a small "Use joining date" / "Use departure date" button inside each alert for quick correction.

**File: `src/components/admin/EmployeeFormDialog.tsx`**
- Add a new `autoAdjustAssignmentStartDates` function (similar to existing `autoEndAssignments`).
- Call it in `handleSubmit` when `date_of_hire` has changed to a later date.
- Query `user_targets` where `effective_start_date < new_date_of_hire` and update them.

**File: `src/hooks/usePlanAssignments.ts`**
- In `useCreatePlanAssignment` and `useUpdatePlanAssignment`, after the overlap check, add a tenure boundary check.
- Fetch employee record by `user_id` to get `date_of_hire` and `departure_date`.
- If `departure_date` is set and `effective_end_date > departure_date`, auto-clamp and add a warning toast.

**Files modified (total):**
- `src/components/admin/PlanAssignmentDialog.tsx`
- `src/components/admin/EmployeeFormDialog.tsx`
- `src/hooks/usePlanAssignments.ts`

No database or schema changes required.

