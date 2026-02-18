

## Add Table Filter to Audit Trail

### Problem
The Audit Trail filters currently have Domain and Action dropdowns but no way to filter by specific table (e.g., "Employees", "Comp Plans", "Deals").

### Changes

#### 1. `src/hooks/useUnifiedAuditLog.ts`
- Add `tables?: string[]` to the `UnifiedAuditFilters` interface
- Export a new `AUDIT_TABLES` constant built from the existing `TABLE_LABELS` map, sorted alphabetically by label (e.g., `{ value: "comp_plans", label: "Comp Plans" }`)
- Add client-side filtering for the `tables` filter (same pattern as domains/actions filtering)

#### 2. `src/components/audit/AuditFilters.tsx`
- Add a third `SearchableSelect` dropdown between the Action filter and the toggle switches
- Options: "All Tables" + entries from the new `AUDIT_TABLES` constant
- Bound to `filters.tables` using the same pattern as the domain/action filters
- Width: ~180px to match the other dropdowns
- Include `tables` in the `hasActiveFilters` check and `clearFilters` reset

### Summary
Two files edited. No database changes needed. The new Table filter will let users drill down to specific tables like "Employees", "Deals", "F&F Settlements", etc.

