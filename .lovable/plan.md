

## Prevent Overlapping Plan Assignments

### Problem Summary

The system currently allows assigning the same employee to multiple compensation plans with overlapping date ranges. This creates data integrity issues since an employee should only have one active compensation plan at any given time.

**Example from current data:**
- "Farming Sales Rep" (DU0001) has two overlapping assignments:
  - Sales Engineering: Jan 2024 - Dec 2026
  - Farmer: Jan 2026 - Dec 2026
  - **Overlap period:** Jan 2026 - Dec 2026 (12 months of conflict)

---

### Solution Overview

Add validation in the Plan Assignment workflow to:
1. **Check for overlapping assignments** before creating a new assignment
2. **Show a clear error message** if an overlap is detected
3. **Prevent rapid double-clicks** that could create duplicate records
4. **Apply validation on updates** as well to prevent creating overlaps when editing

---

### Implementation Details

#### 1. Add Overlap Check Function

Create a new function in `usePlanAssignments.ts` to check for existing assignments with overlapping date ranges:

```text
async function checkOverlappingAssignments(
  userId: string,
  startDate: string,
  endDate: string,
  excludeAssignmentId?: string  // For edit mode, exclude current assignment
)
```

**Logic:**
Two date ranges overlap if: `range1_start <= range2_end AND range1_end >= range2_start`

The function will query existing assignments for the user and check if any overlap with the proposed dates.

#### 2. Modify Create/Update Mutations

Update both `useCreatePlanAssignment` and `useUpdatePlanAssignment` to:
1. First query existing assignments for the user
2. Check for date overlaps with the new/updated dates
3. Throw an error with a clear message if overlap is detected
4. Only proceed with insert/update if validation passes

#### 3. Add Client-Side Guard

Add a `useRef` guard to prevent rapid double-clicks that could bypass validation due to timing.

---

### Validation Flow

```text
User clicks "Create Assignment"
         |
         v
[Client-side guard - prevent double clicks]
         |
         v
[Query existing assignments for this user from database]
         |
         v
[Check for date overlap with each existing assignment]
         |
    +----+----+
    |         |
 Overlap    No Overlap
 Found      Found
    |         |
    v         v
[Show Error] [Proceed with Insert/Update]
   Toast        |
    |           v
 [Stop]    [Success Toast]
```

---

### Error Message

When an overlap is detected, display a clear error message:

> "This employee already has a plan assignment during this period: [Plan Name] (Jan 2024 - Dec 2026). Please adjust the effective dates or remove the existing assignment first."

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/usePlanAssignments.ts` | Add overlap check function; update create/update mutations with validation |
| `src/components/admin/PlanAssignmentDialog.tsx` | Add ref guard for double-click prevention |

---

### Technical Implementation

**usePlanAssignments.ts changes:**

1. **Add helper function** to check date range overlap:
   ```text
   function datesOverlap(start1: string, end1: string, start2: string, end2: string): boolean
   ```

2. **Update useCreatePlanAssignment mutation** to:
   - Fetch existing assignments for the user before inserting
   - Check each assignment for overlap with proposed dates
   - Throw error with details if overlap found

3. **Update useUpdatePlanAssignment mutation** to:
   - Fetch existing assignments excluding the current one being edited
   - Check for overlaps with the new dates
   - Throw error if overlap found

**PlanAssignmentDialog.tsx changes:**

1. Add `actionInProgressRef` to prevent rapid double-clicks:
   ```text
   const actionInProgressRef = useRef(false);
   ```

2. Wrap `onSubmit` to check the ref before proceeding

---

### Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Same employee, different plans, overlapping dates | Error: "Employee already has assignment during this period" |
| Same employee, same plan, overlapping dates | Error (prevents duplicate assignments) |
| Adjacent dates (no gap, no overlap) | Allowed - Jan-Mar and Apr-Dec are valid |
| Editing existing assignment | Excludes current assignment from overlap check |
| Rapid double-click on submit | Blocked by ref guard |
| Network delay causing stale state | Fresh database query ensures current data |

---

### User Experience

1. Admin opens Plan Assignment dialog
2. Selects plan and dates
3. Clicks "Create Assignment"
4. System checks for overlaps against fresh database data
5. If overlap found: Clear error message with conflicting plan details
6. If no overlap: Assignment created successfully

---

### Summary

This solution implements robust validation to prevent overlapping plan assignments:

- **Database-first validation**: Queries fresh data before each operation
- **Clear error messages**: Shows which existing plan conflicts
- **Prevents duplicates**: Covers both create and update scenarios
- **Double-click protection**: Ref guard prevents race conditions

