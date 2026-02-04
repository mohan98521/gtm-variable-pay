
# Fix: Assign Employee Dialog from Plan Page

## Problem

When clicking "Assign Employee" from the Compensation Plan page, the dialog incorrectly shows:
- **Current (Wrong):** "Compensation Plan" dropdown (to select a plan)
- **Expected:** "Select Employee" list (to choose which employee to assign)

This is because both dialogs are rendered simultaneously, and the `PlanAssignmentDialog` opens before an employee is selected.

## Root Cause

In `AssignedEmployeesCard.tsx`:
```typescript
// Line 222: Dialog opens when showAssignDialog is true, regardless of employee selection
<PlanAssignmentDialog
  open={showAssignDialog}  // ← Bug: Should only open after employee is selected
  ...
/>

// Line 236: Employee selection dialog also renders
{showAssignDialog && !selectedEmployee && !editingAssignment && (
  <SelectEmployeeForAssignment ... />
)}
```

Both dialogs are shown when `showAssignDialog` is true and no employee is selected. The `PlanAssignmentDialog` should wait until an employee is chosen.

## Solution

### 1. Fix AssignedEmployeesCard.tsx - Dialog Open Condition

Change the `PlanAssignmentDialog` to only open when an employee is selected:

```typescript
// Line 222: Only open after employee is selected
<PlanAssignmentDialog
  open={showAssignDialog && (selectedEmployee !== null || editingAssignment !== null)}
  ...
/>
```

### 2. Fix PlanAssignmentDialog.tsx - Show Plan Name When Preselected

When `preselectedPlanId` is provided (from plan page), the dialog should:
- Show the plan name as static text instead of a dropdown
- Update the dialog title/description to reflect the context

**Changes:**
1. Add logic to determine if we're assigning from a plan page (when `preselectedPlanId` is set and no employee was initially passed)
2. When plan is preselected, show plan name as a read-only field instead of dropdown
3. Update dialog description to be appropriate for both flows

## Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/AssignedEmployeesCard.tsx` | Fix `open` prop condition for `PlanAssignmentDialog` |
| `src/components/admin/PlanAssignmentDialog.tsx` | When `preselectedPlanId` is set, show plan name as static info instead of dropdown |

## Expected Behavior After Fix

### Flow from Plan Page:
1. Click "Assign Employee" → **SelectEmployeeForAssignment** dialog appears
2. Select an employee → **PlanAssignmentDialog** opens with:
   - Plan name shown as static text (already selected)
   - Employee name in header
   - Compensation fields pre-populated from employee data

### Flow from Employee Page:
1. Click "Assign to Plan" → **PlanAssignmentDialog** opens with:
   - Plan dropdown (to select a plan)
   - Employee name in header
   - Compensation fields pre-populated from employee data

## Implementation Details

### AssignedEmployeesCard.tsx (Line 222)
```typescript
<PlanAssignmentDialog
  open={showAssignDialog && (selectedEmployee !== null || editingAssignment !== null)}
  onOpenChange={(open) => {
    setShowAssignDialog(open);
    if (!open) {
      setSelectedEmployee(null);
      setEditingAssignment(null);
    }
  }}
  employee={selectedEmployee}
  existingAssignment={editingAssignment}
  preselectedPlanId={planId}
/>
```

### PlanAssignmentDialog.tsx - Plan Selection Section
```typescript
{/* When plan is preselected (from plan page), show as static info */}
{preselectedPlanId ? (
  <div className="space-y-2">
    <FormLabel>Compensation Plan</FormLabel>
    <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/50">
      <span className="font-medium">
        {plans.find(p => p.id === preselectedPlanId)?.name || "Loading..."}
      </span>
      <Badge variant="outline" className="text-xs">Pre-selected</Badge>
    </div>
  </div>
) : (
  <FormField
    control={form.control}
    name="plan_id"
    render={({ field }) => (
      // ... existing plan dropdown
    )}
  />
)}
```

## Visual Summary

| Context | Dialog Title | First Field |
|---------|-------------|-------------|
| From Employee Page | "Assign Employee to Plan" | Plan dropdown |
| From Plan Page (after employee select) | "Assign Employee to Plan" | Plan name (static) |
| Edit mode | "Edit Plan Assignment" | Plan name (disabled) |
