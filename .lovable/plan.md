

## Auto-Populate Effective Dates from Employee Database

### Problem Summary

The Plan Assignment dialog currently defaults effective dates to the fiscal year boundaries (Jan 1 - Dec 31). The user wants these dates to be automatically populated from the employee's actual employment dates:

- **Effective Start Date** → Employee's Date of Joining (`date_of_hire`)
- **Effective End Date** → Employee's Last Working Day (`departure_date`) if set, otherwise Dec 31 of fiscal year

Both dates should remain editable so admins can adjust them before confirming the assignment. Additionally, when an employee's departure date is updated later in the system, it should automatically reflect in future assignment workflows.

---

### Current Behavior vs Proposed Behavior

| Field | Current Logic | New Logic |
|-------|---------------|-----------|
| Effective Start Date | Always Jan 1 of fiscal year | Use employee's `date_of_hire` if available; fall back to Jan 1 |
| Effective End Date | Always Dec 31 of fiscal year | Use employee's `departure_date` if set; fall back to Dec 31 |

---

### Solution Overview

#### 1. Update Employee Interface in PlanAssignmentDialog

Add the missing date fields to the Employee interface:

```text
interface Employee {
  // ... existing fields
  date_of_hire?: string | null;    // NEW - e.g., "2024-03-15"
  departure_date?: string | null;  // NEW - e.g., "2025-06-30"
}
```

#### 2. Update Date Auto-Population Logic

Modify the form initialization to use employee dates:

**Current logic (lines 151-153):**
```text
const startDate = new Date(selectedYear, 0, 1);     // Always Jan 1
const endDate = new Date(selectedYear, 11, 31);    // Always Dec 31
```

**New logic:**
```text
// Use employee's date of hire if available, otherwise default to Jan 1
const startDate = employee.date_of_hire 
  ? new Date(employee.date_of_hire) 
  : new Date(selectedYear, 0, 1);

// Use employee's departure date if available, otherwise default to Dec 31
const endDate = employee.departure_date 
  ? new Date(employee.departure_date) 
  : new Date(selectedYear, 11, 31);
```

#### 3. Fix Calendar Interactivity

Add `pointer-events-auto` class to Calendar components to ensure they work properly inside the dialog popover (per Shadcn datepicker guidelines).

---

### Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Employee has `date_of_hire` set | Use that date as Effective Start Date |
| Employee has no `date_of_hire` (null) | Fall back to January 1 of fiscal year |
| Employee has `departure_date` set | Use that date as Effective End Date |
| Employee has no `departure_date` (null) | Fall back to December 31 of fiscal year |
| Editing existing assignment | Use the saved effective dates (no change to existing logic) |
| Date of hire is in different year | Use actual date - admin can adjust if needed |

---

### User Experience Flow

1. Admin opens "Assign to Plan" for an employee
2. **Effective Start Date** is pre-filled with the employee's Date of Joining (e.g., "March 15, 2024")
3. **Effective End Date** is pre-filled with:
   - The departure date if the employee has resigned/is leaving
   - December 31 of fiscal year for current employees
4. Admin can modify either date using the calendar picker before confirming
5. All dates remain fully editable

---

### Impact on Future Updates

When an employee's departure date is updated in the Employee Database (via Edit action):
- **New assignments** will automatically use the updated departure date as the default end date
- **Existing assignments** remain unchanged (preserving historical data)
- Admins can manually update existing assignments if needed through the Plan Builder's "Assigned Employees" section

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/PlanAssignmentDialog.tsx` | Add `date_of_hire` and `departure_date` to Employee interface; update start/end date calculation logic; add `pointer-events-auto` to Calendar components |

---

### Technical Implementation Details

**Changes to PlanAssignmentDialog.tsx:**

1. **Employee Interface (around line 74)** - Add new fields:
   - `date_of_hire?: string | null;`
   - `departure_date?: string | null;`

2. **Form Initialization (lines 151-153)** - Smart date calculation:
   - Start date: Use `date_of_hire` or fall back to Jan 1
   - End date: Use `departure_date` or fall back to Dec 31

3. **Calendar Components (lines 299-305 and 334-340)** - Add interactivity fix:
   - Add `className="pointer-events-auto"` to both Calendar components

---

### Data Flow

```text
employees table                    PlanAssignmentDialog Form
-----------------                  ------------------------
date_of_hire (e.g., "2024-03-15")  ────────>  Effective Start Date
departure_date (e.g., "2025-06-30") ───────>  Effective End Date

If date_of_hire is NULL   ────────────────>  Falls back to Jan 1, [year]
If departure_date is NULL ────────────────>  Falls back to Dec 31, [year]
```

---

### No Database Changes Required

Both `date_of_hire` and `departure_date` already exist in the `employees` table and are included in the employee data passed from `EmployeeAccounts.tsx`. This change only requires updating the dialog component to use these existing fields.

---

### Summary

This enhancement:
1. Auto-populates **Effective Start Date** from the employee's Date of Joining
2. Auto-populates **Effective End Date** from the employee's Last Working Day (if set)
3. Keeps both dates editable for admin adjustments
4. Ensures future assignments automatically pick up updated departure dates
5. Fixes calendar interactivity inside the dialog

