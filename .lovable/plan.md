

## Fix: Add Missing Sales Functions (Overlay, Team Lead, Executive)

### Problem
The `SALES_FUNCTIONS` list in `src/components/admin/EmployeeFormDialog.tsx` is missing several roles required for proper computation:
- **Overlay** -- needed for "Org " metric aggregation (org-wide rollup)
- **Team Lead** -- needed for "Team " metric aggregation (direct reports rollup)
- **Team Lead - Farmer** -- variant for farming team leads
- **Team Lead - Hunter** -- variant for hunting team leads
- **Executive** -- needed for "Org " metric aggregation (org-wide rollup)

Without these options, admins cannot tag employees correctly, and the compensation engine cannot apply the right aggregation logic.

### Change

**File: `src/components/admin/EmployeeFormDialog.tsx`**

Update the `SALES_FUNCTIONS` array (line 45-59) to include the missing entries:

```typescript
const SALES_FUNCTIONS = [
  "Farmer",
  "Hunter",
  "CSM",
  "Channel Sales",
  "Sales Engineering",
  "Sales Head - Farmer",
  "Sales Head - Hunter",
  "Farmer - Retain",
  "IMAL Product SE",
  "Insurance Product SE",
  "APAC Regional SE",
  "MEA Regional SE",
  "Sales Engineering - Head",
  "Team Lead",
  "Team Lead - Farmer",
  "Team Lead - Hunter",
  "Overlay",
  "Executive",
] as const;
```

No database or backend changes required -- this is a frontend-only fix.
