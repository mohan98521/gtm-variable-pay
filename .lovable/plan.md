

## Add Support Team Columns to Deals Bulk Upload

### Overview
Add two new optional columns (`sales_engineering_team_name` and `solution_manager_team_name`) to the bulk upload template. Users can specify either an individual employee ID **or** a team name for Sales Engineering and Solution Manager roles -- if both are provided, the team takes priority (matching the UI form behavior).

### Changes

**File: `src/components/data-inputs/DealsBulkUpload.tsx`**

1. **Add a query to fetch support teams** -- similar to the existing employees query, fetch all active support teams to build a lookup map of `team_name -> { id, team_role }`.

2. **Update `ParsedDeal` interface** -- add two new optional fields:
   - `sales_engineering_team_name?: string`
   - `solution_manager_team_name?: string`
   - `sales_engineering_team_id?: string` (resolved from name)
   - `solution_manager_team_id?: string` (resolved from name)

3. **Update `CSV_TEMPLATE_HEADERS`** -- add `sales_engineering_team_name` and `solution_manager_team_name` after their respective individual ID columns.

4. **Update `generateCSVTemplate`** -- add empty values for the two new columns in the example row, with a comment row or note that users should fill either the individual ID or team name, not both.

5. **Update `parseCSV` and `rowsToParsedDeals`** -- read the two new columns from the raw data.

6. **Update `validateDeals`** -- add validation logic:
   - If `sales_engineering_team_name` is provided, look it up in the support teams list; error if not found or if the team's `team_role` is not `sales_engineering`.
   - Same for `solution_manager_team_name` with role `solution_manager`.
   - If both an individual ID and a team name are provided for the same role, show a warning (team will take priority).
   - Resolve the validated team name to its UUID (`sales_engineering_team_id` / `solution_manager_team_id`).

7. **Update `uploadMutation`** -- when building `dealData` for insert:
   - If a team name was provided and resolved, set `sales_engineering_team_id` and clear the individual `sales_engineering_employee_id` / `sales_engineering_name`.
   - Same logic for `solution_manager_team_id`.

### Technical Details

- Support teams are fetched once via `useQuery` with key `["support-teams-validation"]`, selecting `id, team_name, team_role, is_active` where `is_active = true`.
- Team name matching is case-insensitive (`toLowerCase()` comparison).
- The template example row will show: individual columns empty + team column = `"APAC SE Team"` to demonstrate usage.
- No database or schema changes required -- the `deals` table already has `sales_engineering_team_id` and `solution_manager_team_id` columns.

