

## Deal Team SPIFF -- Manual Allocation System

### The Scenario

For large deals (e.g., ARR >= $400K), a fixed **$10,000 SPIFF pool** is available for the deal team members (excluding the Sales Rep). The split among team members is **not formula-driven** -- it is decided by the CSO after deal closure based on individual effort. This requires a manual allocation workflow that feeds into the monthly payroll.

### Design Approach

Create a new **"Deal Team SPIFF"** module with:
1. A database table to store per-deal, per-employee allocations
2. An admin UI to view eligible deals, allocate amounts to team members, and approve
3. Integration with the payout engine so allocations flow into the monthly payout run

```text
Eligible Deal (ARR >= threshold)
       |
       v
  Admin UI: "Deal Team SPIFF Allocations"
       |
       +-- Select Deal --> Shows team members (excluding Sales Rep)
       +-- Enter amount per member (must sum to $10,000)
       +-- CSO approves allocation
       |
       v
  Payout Engine picks up approved allocations for the deal's month
  and includes them in each member's payroll line
```

### Database Changes

#### New Table: `deal_team_spiff_allocations`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| deal_id | uuid | FK to deals |
| employee_id | text | Team member receiving the allocation |
| allocated_amount_usd | numeric | Their share of the $10K pool |
| allocated_amount_local | numeric | Local currency equivalent |
| local_currency | text | Default 'USD' |
| exchange_rate_used | numeric | Default 1 |
| status | text | 'pending' / 'approved' / 'paid' |
| approved_by | uuid | CSO/admin who approved |
| approved_at | timestamptz | When approved |
| notes | text | Optional justification |
| payout_month | date | Which month's payroll this applies to (defaults to deal month) |
| payout_run_id | uuid | Linked payout run once included |
| created_at | timestamptz | Auto |

RLS: Admin-only read/write (matching existing payout tables pattern).

#### New Config Table (optional, for flexibility): `deal_team_spiff_config`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| spiff_pool_amount_usd | numeric | Default 10000 |
| min_deal_arr_usd | numeric | Threshold (e.g., 400000) |
| is_active | boolean | Toggle |
| exclude_roles | text[] | Roles to exclude (default: ['sales_rep']) |

This keeps the $10K amount and threshold configurable without code changes.

### UI Design

#### Location: Admin > Finance tab (alongside Payout Runs)

New sub-section or tab: **"Deal Team SPIFFs"**

**Screen 1 -- Eligible Deals List**
- Shows all deals where `new_software_booking_arr_usd >= threshold`
- Columns: Deal ID, Customer, ARR, Month, Status (Unallocated / Partially Allocated / Fully Allocated / Approved)
- Filter by month, status
- "Allocate" button per deal

**Screen 2 -- Allocation Dialog (per deal)**
- Deal summary at top (Customer, ARR, Project ID)
- Pool amount: $10,000 (from config)
- Table of eligible team members auto-populated from the deal's participant fields (SE, SE Head, Product Specialist, Product Specialist Head, Solution Manager, Solution Manager Head, Channel Sales -- excluding Sales Rep and Sales Head)
- Editable amount column per member
- Running total vs pool with validation (sum must equal pool)
- Notes field per allocation
- "Save as Draft" and "Submit for Approval" buttons

**Screen 3 -- Approval View**
- List of pending allocations grouped by deal
- Approve / Reject actions
- Approved allocations become eligible for payout run inclusion

### Payout Engine Integration

In `payoutEngine.ts` (`calculateEmployeeVariablePay`):
- After computing VP, commissions, NRR, and existing SPIFFs, add a new step:
- Query `deal_team_spiff_allocations` where `employee_id = empId`, `status = 'approved'`, `payout_month` matches the run month
- Sum as `dealTeamSpiffUsd`
- Add to the employee's total eligible amount
- Since this is a one-time bonus (paid immediately upon approval), it goes 100% to "Upon Booking" (no collection holdback or year-end reserve)
- Write to `monthly_payouts` with `payout_type = 'deal_team_spiff'`

### Files to Create/Modify

| File | Change |
|---|---|
| **Migration SQL** | Create `deal_team_spiff_allocations` and `deal_team_spiff_config` tables with RLS |
| `src/hooks/useDealTeamSpiffs.ts` | **New** -- CRUD hooks for allocations + config |
| `src/components/admin/DealTeamSpiffManager.tsx` | **New** -- Main UI: eligible deals list + allocation dialog + approval |
| `src/pages/Admin.tsx` | Add "Deal Team SPIFFs" tab/section in Finance area |
| `src/lib/payoutEngine.ts` | Add deal team SPIFF lookup in payout calculation |
| `src/components/admin/PayoutRunDetail.tsx` | Show deal team SPIFF column in payout breakdown |

### Key Rules

- Sales Rep is **excluded** from deal team SPIFF allocations
- Allocations must sum to exactly the pool amount ($10K) per deal
- Only **approved** allocations are included in payout runs
- Each allocation is tied to a specific payout month (defaults to deal closure month but can be adjusted)
- The pool amount and deal threshold are configurable via the config table
- No impact on existing SPIFF calculations (those remain formula-driven)

