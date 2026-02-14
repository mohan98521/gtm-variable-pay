## Support Team Attribution: Multi-Employee Credit for GTM Support Roles

### Problem Statement

Currently, each deal role column (e.g., `sales_engineering_employee_id`) holds exactly ONE employee. But for GTM support functions like Sales Engineering, a team of employees may collectively support a region/BU. When any deal closes in that region, ALL team members should receive 100% credit -- not just the one individual tagged on the deal.

Today there are two gaps:

1. No way to define "Support Teams" (e.g., "APAC SE Team = Emp A + Emp B")
2. The `deal_participants` table exists but is completely ignored by the payout engine, dashboard actuals, and reports

### Solution Design

Introduce a **Support Teams** concept with two new database tables, an admin UI for team management, and engine updates to resolve team memberships at calculation time.

```text
+-------------------+       +------------------------+
| support_teams     |       | support_team_members   |
|-------------------|       |------------------------|
| id (uuid PK)     |<------| team_id (FK)           |
| team_name         |       | employee_id (text)     |
| team_role         |       | is_active (bool)       |
| region (nullable) |       | effective_from (date)  |
| bu (nullable)     |       | effective_to (date)    |
| is_active (bool)  |       +------------------------+
| created_at        |
+-------------------+
```

**How it works:**

- **Admin creates a team**: "APAC SE Team" with role = "sales_engineering", region = "APAC"
- **Admin adds members**: Emp A and Emp B, with effective dates
- **At deal entry**: User can either:
  - Assign a single employee to `sales_engineering_employee_id` (existing flow, unchanged)
  - OR assign a support team name to a new `sales_engineering_team_id` column
- **At payout calculation**: The engine checks if a role has a team assignment. If yes, it resolves all active team members and credits each one with 100% of the deal value (matching existing full-credit attribution policy)

### Detailed Changes

#### 1. Database: Two New Tables

`**support_teams**` -- defines named teams with a role type and optional region/BU scope


| Column     | Type            | Description                                                |
| ---------- | --------------- | ---------------------------------------------------------- |
| id         | uuid PK         | Auto-generated                                             |
| team_name  | text            | e.g., "APAC SE Team"                                       |
| team_role  | text            | One of the 8 participant roles (e.g., "sales_engineering") |
| region     | text (nullable) | Optional scope filter                                      |
| bu         | text (nullable) | Optional scope filter                                      |
| is_active  | boolean         | Default true                                               |
| created_at | timestamptz     | Auto                                                       |


`**support_team_members**` -- links employees to teams with date ranges


| Column         | Type            | Description                           |
| -------------- | --------------- | ------------------------------------- |
| id             | uuid PK         | Auto-generated                        |
| team_id        | uuid FK         | References support_teams              |
| employee_id    | text            | Employee ID from employees table      |
| is_active      | boolean         | Default true                          |
| effective_from | date            | When membership starts                |
| effective_to   | date (nullable) | When membership ends (null = ongoing) |
| created_at     | timestamptz     | Auto                                  |


Both tables get RLS policies requiring authenticated access.

#### 2. Deal Table: Add Team Assignment Columns

Add 2 optional team reference columns to the `deals` table (one per role):

- `sales_engineering_team_id` (uuid, nullable, FK to support_teams)
- `solution_manager_team_id`

These are optional -- if NULL, existing individual assignment is used. If set, the team is resolved to individual members at calculation time.

#### 3. Admin UI: Support Team Management

New tab in Admin page: **"Support Teams"**

- Create/edit teams with name, role type, region, BU
- Add/remove team members with effective dates
- View all teams and their current members
- Search and filter by role type or region

**File**: New `src/components/admin/SupportTeamManagement.tsx`
**Hook**: New `src/hooks/useSupportTeams.ts`

#### 4. Deal Form: Team-or-Individual Toggle

For each support role in the Deal Form, add a toggle:

- **Individual** (default): Shows existing employee dropdown
- **Team**: Shows a dropdown of support teams filtered by role type

When "Team" is selected, the team_id is saved to the deal. The individual employee_id for that role is left empty.

**File**: `src/components/data-inputs/DealFormDialog.tsx`

#### 5. Payout Engine: Team Resolution

Update the deal query logic in `payoutEngine.ts` to:

1. After fetching deals, check if any deal has team assignments
2. For deals with team assignments, resolve team members via `support_team_members` (filtered by `is_active = true` and effective dates covering the deal month)
3. Credit each resolved team member as if they were individually assigned to the role
4. Individual assignments continue to work exactly as before

This is a "resolution at calculation time" approach -- teams are expanded into individual credits during payout runs.

**File**: `src/lib/payoutEngine.ts` (functions: `calculateEmployeeVariablePay`, `calculateEmployeeCommissions`)

#### 6. Dashboard Actuals: Team Resolution

Update `useUserActuals.ts` and `useEmployeeActuals` to also check `deal_participants` and team memberships when determining if an employee should be credited for a deal.

**File**: `src/hooks/useUserActuals.ts`

#### 7. Existing `deal_participants` Integration

The existing `deal_participants` table (with split percentages) continues to serve its purpose for ad-hoc additional participants with custom splits. Support Teams are a separate concept for "everyone gets 100% credit." Both coexist:

- **Support Teams**: All members get 100% credit (team-wide attribution)
- **deal_participants**: Individual additions with custom split % (deal-specific overrides)

### Implementation Sequence

1. Create `support_teams` and `support_team_members` tables with RLS
2. Add team_id columns to `deals` table
3. Build `useSupportTeams` hook (CRUD operations)
4. Build `SupportTeamManagement.tsx` admin UI
5. Update `DealFormDialog.tsx` with team-or-individual toggle per role
6. Update `payoutEngine.ts` with team resolution logic
7. Update `useUserActuals.ts` to include team-based credit
8. Add "Support Teams" tab to Admin page with permission key

### What Stays Unchanged

- Individual employee assignment (single employee per role) works exactly as before
- The `deal_participants` table and editor remain for custom split scenarios
- All 8 participant role columns on deals remain and work as-is
- Multi-participant attribution policy (100% credit to all roles) is unchanged
- Existing deals without team assignments are unaffected