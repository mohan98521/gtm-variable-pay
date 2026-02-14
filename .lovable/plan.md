

## Changes to Deal Form and Bulk Upload

### Summary
Three changes: (1) Remove "Sales Engineering Head ID" from the deal form and bulk upload, (2) Add a new "Solution Architect ID" field, and (3) Add a warning system in bulk upload when both an individual ID and a team name are provided for the same role, with the ability to download warnings.

---

### 1. Remove "Sales Engineering Head ID" from Deal Form and Bulk Upload

Since SE Heads are on overlay and get credited via their overlay comp plan, they do not need per-deal attribution.

**Files to change:**

- **`src/components/data-inputs/DealFormDialog.tsx`**
  - Remove the `sales_engineering_head_employee_id` schema field and form field (lines 72, 170, 210, 265, 286, 313, 345-346, 819-843)
  - Remove the SE Head name resolution in `onSubmit`

- **`src/components/data-inputs/DealsBulkUpload.tsx`**
  - Remove `sales_engineering_head_id` from `ParsedDeal` interface, `CSV_TEMPLATE_HEADERS`, template example row, `buildDealFromRow`, `validateDeals` participant fields, and `uploadMutation` dealData

- **`src/hooks/useDeals.ts`**
  - Remove `sales_engineering_head` from `PARTICIPANT_ROLES`

- **`src/hooks/useSupportTeams.ts`**
  - Remove `sales_engineering_head` from `TEAM_ROLES`

**Note:** The database columns (`sales_engineering_head_employee_id`, `sales_engineering_head_name`) will remain untouched. Existing attribution logic in `payoutEngine.ts`, `useUserActuals.ts`, `useMyDealsWithIncentives.ts`, `useDealVariablePayAttribution.ts`, `useTeamCompensation.ts`, and `useCurrentUserCompensation.ts` will continue to work for historical deals that have this field populated. New deals simply won't have it set.

---

### 2. Add "Solution Architect ID" field

**Database migration:**
- Add two new columns to the `deals` table:
  - `solution_architect_employee_id` (text, nullable)
  - `solution_architect_name` (text, nullable)

**Files to change:**

- **`src/components/data-inputs/DealFormDialog.tsx`**
  - Add `solution_architect_employee_id` to the form schema, default values, and reset logic
  - Add a new employee dropdown field labeled "Solution Architect ID" in the Participants section
  - Include name resolution in `onSubmit`

- **`src/components/data-inputs/DealsBulkUpload.tsx`**
  - Add `solution_architect_id` to `ParsedDeal`, `CSV_TEMPLATE_HEADERS`, template row, `buildDealFromRow`, validation, and `uploadMutation`

- **`src/hooks/useDeals.ts`**
  - Add `solution_architect_employee_id` and `solution_architect_name` to the `Deal` interface
  - Add `solution_architect` to `PARTICIPANT_ROLES`

---

### 3. Validation warnings for individual + team conflicts in Bulk Upload

Currently, when both an individual ID and a team name are provided for the same role (SE or Solution Manager), the system treats it as an error. The plan changes this to a **warning** (not blocking) and adds a "Download Warnings" button.

**File: `src/components/data-inputs/DealsBulkUpload.tsx`**

- Add a new `ValidationWarning` interface (same shape as `ValidationError`)
- Add a `validationWarnings` state alongside `validationErrors`
- In `validateDeals`, return both `errors` and `warnings`:
  - The "Both individual ID and team name provided" messages become warnings instead of errors
  - Actual problems (team not found, role mismatch) remain errors
- Add a warnings display section in the UI (yellow/amber styled, separate from errors)
- Add a "Download Warnings" button that exports warnings as CSV
- Allow upload to proceed when there are warnings but no errors
- The warning message will read: "Row X: Both SE individual ID and SE team name provided -- team will take priority, individual ID will be ignored"

---

### Technical Details

**Database migration SQL:**
```sql
ALTER TABLE public.deals
  ADD COLUMN solution_architect_employee_id text,
  ADD COLUMN solution_architect_name text;
```

**Attribution note:** The new `solution_architect` role will need to be added to the attribution filter queries in `payoutEngine.ts`, `useUserActuals.ts`, `useMyDealsWithIncentives.ts`, `useDealVariablePayAttribution.ts`, `useTeamCompensation.ts`, and `useCurrentUserCompensation.ts` so that Solution Architects receive credit for deals they are tagged on. This will be included in this implementation.

**Files modified (total):**
- `src/components/data-inputs/DealFormDialog.tsx`
- `src/components/data-inputs/DealsBulkUpload.tsx`
- `src/hooks/useDeals.ts`
- `src/hooks/useSupportTeams.ts`
- `src/hooks/useUserActuals.ts`
- `src/hooks/useMyDealsWithIncentives.ts`
- `src/hooks/useDealVariablePayAttribution.ts`
- `src/hooks/useTeamCompensation.ts`
- `src/hooks/useCurrentUserCompensation.ts`
- `src/lib/payoutEngine.ts`
- Database migration (new columns)
