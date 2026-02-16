

## Reorder Plan Builder Sections

### What Changes

Rearrange the section cards in `src/pages/PlanBuilder.tsx` to match the requested order. This is a cosmetic change only — no logic, data, or component changes.

### Current Order (in the JSX)
1. Plan Overview cards (stats)
2. Plan Metrics table
3. Multiplier Grids (accordion)
4. Payout Settings
5. Commission Structure
6. NRR Settings
7. SPIFFs
8. Closing ARR Renewal Multipliers
9. Assigned Employees

### New Order
1. Plan Overview cards (stats) -- unchanged
2. Plan Metrics table
3. Multiplier Grids (accordion)
4. Closing ARR Renewal Multipliers -- moved up
5. Commission Structure -- moved up
6. SPIFFs -- stays roughly same
7. Payout Settings -- moved down (plan-level settings, not a "structure" table)
8. NRR Settings -- moved down alongside Payout Settings
9. Assigned Employees -- stays last

Note: Payout Settings and NRR Settings are plan-level configuration cards, not separate DB tables in the requested list. They will be placed after the core structure sections. The "user_targets / performance_targets / quarterly_targets" are represented by the Assigned Employees card which already links to target management. That section stays last.

### Technical Details

**File: `src/pages/PlanBuilder.tsx`**

Reorder the JSX blocks (move closing tags and opening tags) in the return statement. The components and their props remain identical — only their position in the JSX tree changes.

New JSX order after the stats cards and weightage warning:
1. Metrics Card (unchanged)
2. Multiplier Grids Card (unchanged)
3. `<ClosingArrRenewalMultiplierEditor>` (moved from position 8 to 3)
4. `<PlanCommissionEditor>` (moved from position 5 to 4)
5. `<SpiffEditor>` (moved from position 7 to 5)
6. `<PayoutSettingsCard>` (moved from position 4 to 6)
7. `<NrrSettingsCard>` (moved from position 6 to 7)
8. `<AssignedEmployeesCard>` (stays last)

### Files Modified
- `src/pages/PlanBuilder.tsx` -- reorder section blocks only
