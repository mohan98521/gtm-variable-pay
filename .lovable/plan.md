
# Plan: Add Search Within Filter Dropdowns

## Overview

Currently, many filter and selection dropdowns across the system use the standard Radix Select component, which does not support typing to search/filter options. When these dropdowns contain many dynamic items (employees, products, customers, etc.), finding the right option requires scrolling through the entire list. This plan adds an inline search capability to all qualifying dropdowns.

## Approach

Create a reusable **SearchableSelect** component using the proven shadcn/ui "Combobox" pattern (Popover + Command from the `cmdk` library, which is already installed). This component will replace the standard Select in all dropdowns where the option list is dynamic or long.

---

## Dropdowns to Upgrade

### Category 1: Data Filter Dropdowns (used to narrow down table results)

| File | Dropdown(s) | Options Source |
|------|-------------|----------------|
| `ClosingARRTable.tsx` | PID, BU, Product, Customer, Sales Rep, Sales Head (6 dropdowns) | Dynamic from data |
| `PerformanceTargetsManagement.tsx` | Metric Type filter | Dynamic from DB |
| `Reports.tsx` | Sales Function filter | Static list (13 items) |
| `AuditTrailExport.tsx` | Month, Category filters | Static/small lists |

### Category 2: Employee Selection Dropdowns (picking from employee list)

| File | Dropdown(s) | Count |
|------|-------------|-------|
| `DealFormDialog.tsx` | Sales Rep, Sales Head, SE, SE Head, Product Specialist, PS Head, Solution Manager, SM Head | 8 dropdowns |
| `DealParticipantsEditor.tsx` | Employee per participant row | 1 per row |
| `PayoutAdjustments.tsx` | Employee selection in adjustment form | 1 dropdown |
| `PerformanceTargetFormDialog.tsx` | Employee selection | 1 dropdown |

### Category 3: Plan/Entity Selection

| File | Dropdown(s) |
|------|-------------|
| `PlanAssignmentDialog.tsx` | Plan selection |
| `EmployeeFormDialog.tsx` | Sales Function |

### Dropdowns NOT being changed (too few items, search adds no value)

- Currency selects (6-8 items)
- Status selects (3-5 items)
- Adjustment type, Participant role, Logic type, Commission type
- Month selects (13 items with clear ordering)
- Yes/No toggles

---

## New Component

### `src/components/ui/searchable-select.tsx`

A reusable Combobox component with the following features:

- **Search input** at the top of the dropdown with a magnifying glass icon
- **Filtered list** that updates as the user types (case-insensitive)
- **"No results found"** empty state when search yields nothing
- **Selected item** shown with a checkmark indicator
- **Keyboard navigation** supported via cmdk library
- **Consistent styling** matching existing Select components
- **Props interface:**
  - `value`: Current selected value
  - `onValueChange`: Callback when selection changes
  - `options`: Array of `{ value: string; label: string }`
  - `placeholder`: Trigger placeholder text
  - `searchPlaceholder`: Search input placeholder (default: "Search...")
  - `emptyMessage`: Message when no results found
  - `disabled`: Boolean to disable the component
  - `className`: Optional custom trigger width/style

```text
Visual Layout:
+--------------------------+
| Selected Value      [v]  |  <-- Trigger (looks like current Select)
+--------------------------+
| [Search...]              |  <-- Search input (auto-focused)
|--------------------------|
| [x] Option A             |  <-- Filtered, scrollable list
|     Option B             |
|     Option C             |
+--------------------------+
```

---

## Files to Create/Modify

| File | Action | Details |
|------|--------|---------|
| `src/components/ui/searchable-select.tsx` | **Create** | Reusable Combobox component |
| `src/components/data-inputs/ClosingARRTable.tsx` | Modify | Replace 6 filter Selects with SearchableSelect |
| `src/components/data-inputs/DealFormDialog.tsx` | Modify | Replace 8 employee Selects with SearchableSelect |
| `src/components/data-inputs/DealParticipantsEditor.tsx` | Modify | Replace employee Select with SearchableSelect |
| `src/components/admin/PayoutAdjustments.tsx` | Modify | Replace employee Select with SearchableSelect |
| `src/components/admin/PerformanceTargetFormDialog.tsx` | Modify | Replace employee Select with SearchableSelect |
| `src/components/admin/PerformanceTargetsManagement.tsx` | Modify | Replace metric filter Select with SearchableSelect |
| `src/components/admin/PlanAssignmentDialog.tsx` | Modify | Replace plan Select with SearchableSelect |
| `src/components/admin/EmployeeFormDialog.tsx` | Modify | Replace Sales Function Select with SearchableSelect |
| `src/pages/Reports.tsx` | Modify | Replace Sales Function filter with SearchableSelect |

---

## Implementation Sequence

### Step 1: Create SearchableSelect Component
Build the reusable component using Popover + Command (cmdk), matching existing UI styling.

### Step 2: Update Filter Dropdowns
Replace Selects in ClosingARRTable, PerformanceTargetsManagement, and Reports with SearchableSelect.

### Step 3: Update Employee Selection Dropdowns
Replace Selects in DealFormDialog, DealParticipantsEditor, PayoutAdjustments, and PerformanceTargetFormDialog.

### Step 4: Update Entity Selection Dropdowns
Replace Selects in PlanAssignmentDialog and EmployeeFormDialog.

---

## Technical Notes

- The `cmdk` library (already installed) powers the search/filter logic with fuzzy matching.
- The Popover + Command pattern is the standard shadcn/ui approach for searchable selects (Combobox).
- The existing `_none` sentinel value pattern will be preserved for optional employee selects.
- For react-hook-form integration, the component will work with `onValueChange` just like the current Select.
- The dropdown will have a solid `bg-popover` background with proper `z-50` z-index to avoid transparency issues.
