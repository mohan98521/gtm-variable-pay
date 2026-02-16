

## Dashboard Enhancement: 5 Missing Features

### Overview
Add five missing sections to the Sales Rep Dashboard: Clawback calculation, NRR Additional Pay, SPIFF display, Collection status per deal, and a direct link to the Payout Statement report.

---

### 1. Clawback Calculation (replace placeholder `$0`)

**Current state:** Line 507 of `useCurrentUserCompensation.ts` has `const clawbackAmount = 0; // TODO`

**Change:** Query the `clawback_ledger` table for the current employee's pending/partial clawback entries in the fiscal year and sum `remaining_amount_usd`.

**File:** `src/hooks/useCurrentUserCompensation.ts`
- After fetching the employee UUID (needed for clawback_ledger which uses the `employees.id` UUID, not `employee_id` string), query:
  ```sql
  SELECT SUM(remaining_amount_usd) FROM clawback_ledger
  WHERE employee_id = <employee_uuid>
  AND status IN ('pending', 'partial')
  AND triggered_month >= <fiscal_year_start>
  ```
- Replace the hardcoded `0` with the queried sum.

---

### 2. NRR Additional Pay Section

**Current state:** Engine exists in `nrrCalculation.ts`, used by `payoutEngine.ts`, but not surfaced on dashboard.

**Changes:**

**File: `src/hooks/useCurrentUserCompensation.ts`**
- Add NRR fields to the `CurrentUserCompensation` interface: `nrrResult` (NRRCalculationResult or null), `nrrOtePct`, `nrrTarget`, `nrrActuals`, `nrrPayoutUsd`
- After computing metrics, fetch the plan's `nrr_ote_percent`, `cr_er_min_gp_margin_pct`, `impl_min_gp_margin_pct` from `comp_plans`
- If `nrr_ote_percent > 0`, call `calculateNRRPayout()` using the employee's deals (with `gp_margin_percent` added to the deal select) and CR/ER + Implementation targets
- Attach the result to the returned compensation object

**File: `src/components/dashboard/NRRSummaryCard.tsx`** (new)
- A Card component showing: NRR Target, Eligible Actuals, Achievement %, Payout USD
- Breakdown: CR/ER eligible vs total, Implementation eligible vs total
- GP margin eligibility indicators per category
- Only renders if `nrrOtePct > 0`

**File: `src/pages/Dashboard.tsx`**
- Import and render `NRRSummaryCard` between the Commission table and Monthly Performance table

---

### 3. SPIFF Display

**Current state:** Engine in `spiffCalculation.ts`, `plan_spiffs` table exists, used in payout engine but not on dashboard.

**Changes:**

**File: `src/hooks/useCurrentUserCompensation.ts`**
- Add SPIFF fields to interface: `spiffResult` (SpiffAggregateResult or null)
- Fetch `plan_spiffs` for the active plan
- If any active spiffs exist, call `calculateAllSpiffs()` with the employee's deals, plan metrics, target bonus, and targets
- Attach result to returned data

**File: `src/components/dashboard/SpiffSummaryCard.tsx`** (new)
- Card showing: Total SPIFF Payout, Software Variable OTE used, SPIFF Rate
- Deal-level breakdown table: Project ID, Customer, Deal ARR, Eligible (yes/no), SPIFF Payout
- Threshold indicator showing minimum deal value
- Only renders if plan has active SPIFFs

**File: `src/pages/Dashboard.tsx`**
- Import and render `SpiffSummaryCard` after NRR card

---

### 4. Collection Status per Deal

**Current state:** `deal_collections` table tracks per-deal collection status but is not shown on the dashboard.

**Changes:**

**File: `src/hooks/useCurrentUserCompensation.ts`**
- Add `dealCollections` array to the interface with: `projectId`, `customerName`, `dealValueUsd`, `isCollected`, `collectionDate`, `isClawbackTriggered`, `bookingMonth`
- Query `deal_collections` joined with `deals` filtered to the employee's deals in the fiscal year

**File: `src/components/dashboard/CollectionStatusCard.tsx`** (new)
- Card with title "Deal Collection Status"
- Summary row: X Collected, Y Pending, Z Clawback-triggered
- Table: Project ID, Customer, Deal Value, Status (badge: Collected/Pending/Overdue/Clawback), Collection Date, Booking Month
- Status badges color-coded: green for Collected, yellow for Pending, red for Clawback
- Only renders if there are deal collections

**File: `src/pages/Dashboard.tsx`**
- Render `CollectionStatusCard` after Commission table

---

### 5. Payout Statement Link

**File: `src/pages/Dashboard.tsx`**
- Add a "View Payout Statement" button/link in the header area (next to the FY badge)
- Uses `react-router-dom` `Link` to navigate to `/reports` (where PayoutStatement component lives)
- Styled as a small outlined button with a FileText icon

---

### Dashboard Section Order (after changes)

1. Header + Summary Cards (existing)
2. Assignment Periods card (existing, conditional)
3. Metrics Table (existing) -- now with real clawback amount
4. Commission Table (existing)
5. **Collection Status** (new)
6. **NRR Additional Pay** (new, conditional)
7. **SPIFF Summary** (new, conditional)
8. Monthly Performance (existing)
9. What-If Simulator (existing)
10. **View Payout Statement link** (new, in header)

### Files Modified
- `src/hooks/useCurrentUserCompensation.ts` -- add clawback query, NRR calculation, SPIFF calculation, deal collections fetch
- `src/pages/Dashboard.tsx` -- add new sections and payout statement link

### Files Created
- `src/components/dashboard/NRRSummaryCard.tsx`
- `src/components/dashboard/SpiffSummaryCard.tsx`
- `src/components/dashboard/CollectionStatusCard.tsx`

### No Database Changes Required
All data is already in existing tables (`clawback_ledger`, `comp_plans`, `plan_spiffs`, `deal_collections`). Only client-side queries and UI components are added.

