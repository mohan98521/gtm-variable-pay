

## Multi-Year Renewal Multiplier for Closing ARR

### Overview

Add a configurable multi-year renewal multiplier system to the Closing ARR computation. When a project has a multi-year renewal, its Closing ARR value is multiplied by a factor based on the number of renewal years. The multipliers are managed per compensation plan via a CRUD UI, making them easy to adjust.

**Example**: Closing ARR = 100,000 USD, Multi-Year = Yes, Renewal Years = 2 --> Adjusted Closing ARR = 100,000 x 1.1 = 110,000.

---

### Database Migration

**1. Add 2 columns to `closing_arr_actuals`** (data capture):

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `is_multi_year` | boolean | false | Whether this is a multi-year renewal |
| `renewal_years` | integer | 1 | Number of renewal years (1, 2, 3+) |

**2. Create new table `closing_arr_renewal_multipliers`** (plan-level config):

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `plan_id` | uuid (FK to comp_plans) | Which plan this applies to |
| `min_years` | integer | Minimum renewal years (inclusive) |
| `max_years` | integer or null | Maximum renewal years (inclusive), null = unlimited |
| `multiplier_value` | numeric | Multiplier to apply (e.g., 1.0, 1.1, 1.2) |
| `created_at` | timestamptz | Auto-set |

Default seed rows (per plan, inserted via UI):
- 1 year: multiplier 1.0
- 2 years: multiplier 1.1
- 3+ years: multiplier 1.2

RLS policies matching existing plan-related tables (authenticated users can read/write).

---

### UI Changes

#### 1. New "Closing ARR Renewal Multipliers" Card in Plan Builder

A new CRUD card component (similar to the Commission Structure or Multiplier Grid pattern) placed in the Plan Builder page:

- **Table view**: Columns -- Renewal Years Range, Multiplier, Actions (Edit/Delete)
- **Add button**: Opens a dialog to add a new tier
- **Edit/Delete**: Inline actions per row
- **Dialog fields**: Min Years (integer), Max Years (integer, optional -- blank means "and above"), Multiplier Value (numeric, step 0.01)
- **Empty state**: "No Renewal Multipliers Configured" with an Add button
- **Info callout**: Explains the formula: "Adjusted Closing ARR = Closing ARR x Renewal Multiplier (based on number of renewal years)"

#### 2. Closing ARR Data Input Form (`ClosingARRFormDialog.tsx`)

Add two new fields at the bottom of the form:
- **Multi-Year Renewal**: Yes/No toggle (Switch component)
- **No. of Renewal Years**: Number input (shown only when Multi-Year = Yes, minimum 1)

#### 3. Closing ARR Bulk Upload (`ClosingARRBulkUpload.tsx`)

Add two new CSV columns to the template:
- `is_multi_year` (yes/no or true/false)
- `renewal_years` (integer, defaults to 1)

#### 4. Closing ARR Table (`ClosingARRTable.tsx`)

Add columns to display Multi-Year (Yes/No badge) and Renewal Years.

---

### Payout Engine Update (`payoutEngine.ts`)

In the Closing ARR calculation block (around line 369-411):

1. Fetch `closing_arr_renewal_multipliers` for the current plan
2. Modify the query to also select `is_multi_year` and `renewal_years` from `closing_arr_actuals`
3. For each eligible record where `is_multi_year = true`, look up the matching multiplier from the plan's renewal multiplier grid based on `renewal_years`
4. Apply: `adjusted_closing_arr = closing_arr x renewal_multiplier`
5. Use the adjusted value for aggregation instead of the raw `closing_arr`

Records with `is_multi_year = false` (or null) use the default multiplier of 1.0.

---

### Hook for Renewal Multipliers

Create `src/hooks/useClosingArrRenewalMultipliers.ts`:
- `useClosingArrRenewalMultipliers(planId)` -- fetch all multipliers for a plan
- `useCreateClosingArrRenewalMultiplier()` -- create
- `useUpdateClosingArrRenewalMultiplier()` -- update
- `useDeleteClosingArrRenewalMultiplier()` -- delete

Standard CRUD pattern matching existing hooks like `usePlanCommissions`.

---

### Technical Details

#### Files to Create
- `src/hooks/useClosingArrRenewalMultipliers.ts` -- CRUD hook for renewal multipliers
- `src/components/admin/ClosingArrRenewalMultiplierEditor.tsx` -- Table + dialog CRUD component

#### Files to Modify
- `src/components/data-inputs/ClosingARRFormDialog.tsx` -- Add is_multi_year switch and renewal_years input
- `src/components/data-inputs/ClosingARRBulkUpload.tsx` -- Add 2 new CSV columns
- `src/components/data-inputs/ClosingARRTable.tsx` -- Add display columns
- `src/hooks/useClosingARR.ts` -- Add new fields to interfaces
- `src/lib/payoutEngine.ts` -- Apply renewal multiplier in Closing ARR computation
- `src/pages/PlanBuilder.tsx` -- Mount the new ClosingArrRenewalMultiplierEditor card
- `src/hooks/useUserActuals.ts` -- Include renewal multiplier in dashboard actuals display

#### Implementation Sequence
1. Database migration (add columns + new table)
2. Create CRUD hook for renewal multipliers
3. Build the Plan Builder UI card for managing multipliers
4. Update Closing ARR data input form and bulk upload
5. Update Closing ARR table display
6. Update payout engine to apply multipliers
7. Update dashboard actuals hook
