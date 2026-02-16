

## Add Budget by Sales Function Pie Chart

### What Changes

Add a second pie chart titled "Budget by Sales Function" next to the existing "Payout by Sales Function" chart. Budget is defined as the sum of `tvp_usd` (Target Variable Pay) for active employees, broken down by their `sales_function`. The layout will shift to a 2-column row with both pie charts, and the Top Performers table moves to its own full-width row.

### Technical Details

**File: `src/hooks/useExecutiveDashboard.ts`**
- Add `budgetByFunction: FunctionBreakdown[]` to the `ExecutiveDashboardData` interface
- Compute it by aggregating `tvp_usd` grouped by `sales_function` for active employees (same employees already used for `totalBudget`)
- Add the new field to the return object

**File: `src/components/executive/PayoutByFunction.tsx`**
- Make the component reusable by accepting a `title` prop (defaulting to "Payout by Sales Function")
- Add percentage display in the tooltip (e.g., "$1.2M (34%)")

**File: `src/pages/ExecutiveDashboard.tsx`**
- Change the bottom grid from a 2-column layout (Payout pie + Top Performers) to:
  - Row of 2 pie charts: Payout by Function + Budget by Function
  - Full-width row: Top Performers table
- Pass `title="Budget by Sales Function"` and `data={data?.budgetByFunction || []}` for the second chart

### Files Modified
- `src/hooks/useExecutiveDashboard.ts` -- add budgetByFunction computation
- `src/components/executive/PayoutByFunction.tsx` -- add title prop, percentage in tooltip
- `src/pages/ExecutiveDashboard.tsx` -- update layout with second pie chart

