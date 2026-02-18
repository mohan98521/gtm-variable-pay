

## Remove Staff Users from Employee Master Data Report

### What Changes
Filter out staff users (employees without a `sales_function`) from the Employee Master Data table and its Excel export.

### Why
Staff users are not part of the compensation program and should not appear in the Employee Master Data report, consistent with the staff-exclusion policy applied across other areas (payout engine, management summary, performance targets, etc.).

### Technical Details

**File: `src/pages/Reports.tsx`**

1. **Update the `filteredEmployees` memo** (around line 239-249): Add a filter to exclude employees where `sales_function` is null or empty, before applying search and function filters:

```typescript
const filteredEmployees = useMemo(() => {
  return employees
    .filter((emp) => !!emp.sales_function) // Exclude staff users
    .filter((emp) => {
      const matchesSearch = ...;
      const matchesFunction = ...;
      return matchesSearch && matchesFunction;
    });
}, [employees, searchTerm, salesFunctionFilter]);
```

Single line addition. No database changes needed.
