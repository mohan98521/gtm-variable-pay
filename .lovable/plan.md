

## Simplify Stats Cards and Add Clickable Employee List Downloads

### Changes

**File: `src/components/admin/PerformanceTargetsManagement.tsx`**

#### 1. Remove "Total Annual Value" and "NRR Targets" stats cards
- Remove the 2nd card (Total Annual Value / DollarSign) and 4th card (NRR Targets / Target) from the stats grid (lines 214-265)
- Change grid from `lg:grid-cols-4` to `lg:grid-cols-2` since only 2 cards remain
- Clean up unused stats (`totalAnnualValue`, `nrrEmployeeCount`, `nrrTotalValue`) and unused imports (`DollarSign`, `Target`)

#### 2. Make "Employees with Targets" card clickable to export their target list
- Wrap the card content in a clickable cursor-pointer style
- On click, generate and download an Excel file containing all targets for employees who have targets (the full `targets` dataset grouped by employee)
- Add a subtle download icon or hover indicator so users know it is clickable

#### 3. Make "Without Targets" card clickable to export employee list without targets
- Compute the list of employees without targets by comparing active employees against those with targets
- Fetch employee names for the "without targets" list (already have `totalEmployees` count; will need to fetch actual employee records)
- On click, generate and download an Excel file listing employees who have no targets assigned (Employee Name, Employee ID)

### Technical Details

- Update the existing `totalEmployees` query to fetch actual employee records (`employee_id`, `full_name`) instead of just a count, so we can identify who lacks targets
- Add two new handler functions: `handleExportWithTargets()` and `handleExportWithoutTargets()`
- Reuse existing `generateXLSX` / `downloadXLSX` utilities
- Cards will show a subtle hover effect (e.g., `hover:shadow-md cursor-pointer transition-shadow`) to indicate interactivity
- Add a small Download icon next to each card value as a visual affordance

