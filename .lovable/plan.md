

# Add Search to Employee Selection Dialog

## Overview

Enhance the "Select Employee" dialog with a search input to make it easier to find employees when assigning them to a compensation plan. The search will filter employees by name, employee ID, or email in real-time.

## Current State

The `SelectEmployeeForAssignment` component in `AssignedEmployeesCard.tsx` (lines 281-335) shows a scrollable list of employees but has no search/filter capability. When there are many employees, finding the right one is difficult.

## Proposed Changes

### File: `src/components/admin/AssignedEmployeesCard.tsx`

**Changes to `SelectEmployeeForAssignment` component:**

1. Add search state with `useState`
2. Add a search input field with:
   - Search icon for visual clarity
   - Placeholder text: "Search by name, ID, or email..."
   - Clear button when there's search text
3. Filter employees based on search query (case-insensitive match against name, employee_id, and email)
4. Show "No employees found" message when search yields no results
5. Add keyboard support (auto-focus on search input)

**UI Layout:**
```
┌─────────────────────────────────────┐
│ Select Employee                     │
│ Choose an employee to assign...     │
├─────────────────────────────────────┤
│ 🔍 Search by name, ID, or email... ✕│
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Farming Retain Sales Rep        │ │
│ │ IN0006 • retainrep@azentio.com  │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Farming sales Head              │ │
│ │ DU0002 • farminghead@azentio... │ │
│ └─────────────────────────────────┘ │
│              ...                    │
├─────────────────────────────────────┤
│                          [ Cancel ] │
└─────────────────────────────────────┘
```

## Technical Implementation

```typescript
function SelectEmployeeForAssignment({...}) {
  const [searchQuery, setSearchQuery] = useState("");
  
  const availableEmployees = employees.filter(
    (e) => !assignedEmployeeIds.includes(e.id)
  );
  
  // Filter by search query
  const filteredEmployees = availableEmployees.filter((employee) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      employee.full_name.toLowerCase().includes(query) ||
      employee.employee_id.toLowerCase().includes(query) ||
      employee.email.toLowerCase().includes(query)
    );
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle>Select Employee</AlertDialogTitle>
          <AlertDialogDescription>
            Choose an employee to assign to this plan
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {/* Search Input */}
        {availableEmployees.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        
        {/* Employee List */}
        <div className="flex-1 overflow-y-auto py-4">
          {availableEmployees.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              All active employees are already assigned to this plan.
            </p>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                No employees found matching "{searchQuery}"
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEmployees.map((employee) => (
                // ... existing employee button
              ))}
            </div>
          )}
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

## Additional Imports Needed

```typescript
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
```

## User Experience Improvements

| Feature | Benefit |
|---------|---------|
| Auto-focus on search | User can start typing immediately |
| Case-insensitive search | Matches work regardless of capitalization |
| Multi-field search | Finds by name, ID, or email in one query |
| Clear button (X) | Easy way to reset search |
| Empty state message | Clear feedback when no matches found |
| Search icon | Visual cue for the input purpose |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/AssignedEmployeesCard.tsx` | Add search state, Input component, and filtering logic to `SelectEmployeeForAssignment` |

