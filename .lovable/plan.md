

## Add Performance Targets Export

### Overview
Add an "Export" button to the Performance Targets header (next to "Bulk Upload" and "Add Target") that downloads the currently filtered targets as an Excel (.xlsx) file.

### Change

**File: `src/components/admin/PerformanceTargetsManagement.tsx`**

1. Import `Download` icon from lucide-react and `generateXLSX`/`downloadXLSX` from `src/lib/xlsxExport.ts`
2. Add an `handleExport` function that maps `filteredTargets` to columns: Employee Name, Employee ID, Metric Type, Q1 (USD), Q2 (USD), Q3 (USD), Q4 (USD), Annual (USD)
3. Add an "Export" button (outline variant with Download icon) in the header row, before the "Bulk Upload" button
4. File named `performance_targets_{selectedYear}.xlsx`

No database or backend changes required -- purely a frontend addition reusing existing export utilities.

