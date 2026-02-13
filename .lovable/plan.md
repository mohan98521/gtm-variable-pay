

## NRR Additional Pay and SPIFFs -- Plan Redesign

### Overview

This plan introduces two new compensation components that sit **on top of** the existing Variable OTE (additional pay, not replacing existing metrics):

1. **Non-Recurring Revenue (NRR) Additional Pay** -- CR/ER and Implementation deals with gross profit margin eligibility filters, paying a configurable percentage of Variable OTE based on combined NRR achievement.
2. **SPIFFs** -- Configurable bonus structures linked to Variable OTE (starting with Large Deal SPIFF), triggered by deal-level conditions.

Both are configured per plan in the Plan Builder UI and calculated during payout runs.

---

### Part 1: NRR Additional Pay (CR/ER and Implementation)

#### Business Logic Recap

- CR/ER Target + Implementation Target = Total NRR Target
- Only deals where `gp_margin_percent >= plan threshold` are "eligible"
- Eligible CR/ER + Eligible Implementation = NRR Actuals
- NRR Achievement % = NRR Actuals / NRR Target
- Additional Pay = Variable OTE * NRR OTE % * NRR Achievement %

#### Database Changes

**Add columns to `comp_plans` table:**

| Column | Type | Description |
|--------|------|-------------|
| `nrr_ote_percent` | numeric, default 0 | % of Variable OTE allocated for NRR additional pay (e.g., 20) |
| `cr_er_min_gp_margin_pct` | numeric, default 0 | Minimum GP margin % for CR/ER deals to be eligible |
| `impl_min_gp_margin_pct` | numeric, default 0 | Minimum GP margin % for Implementation deals to be eligible |

No new tables needed -- NRR config lives directly on the plan since it was confirmed to be per-plan.

#### UI Changes -- Plan Builder

Add a new **"NRR Additional Pay"** card/section in `PlanBuilder.tsx` (between Commission Structure and Assigned Employees), containing:

- **NRR OTE Allocation (%)**: Input field for `nrr_ote_percent` (e.g., 20%)
- **CR/ER Min GP Margin (%)**: Input field for `cr_er_min_gp_margin_pct` (e.g., 15%)
- **Implementation Min GP Margin (%)**: Input field for `impl_min_gp_margin_pct` (e.g., 10%)
- A descriptive summary: "Deals below the margin threshold will not count toward NRR achievement"
- An inline example showing the formula: NRR Pay = Variable OTE x NRR % x (Eligible NRR Actuals / NRR Target)

This section will be editable inline (no dialog needed -- simple card with 3 inputs and a Save button), keeping the UI lightweight.

#### Calculation Engine Updates

**New file: `src/lib/nrrCalculation.ts`**

- `calculateNRRPayout(deals, crErTarget, implTarget, nrrOtePct, variableOteUsd, crErMinGp, implMinGp)`:
  - Filter CR/ER deals: sum `cr_usd + er_usd` where `gp_margin_percent >= crErMinGp`
  - Filter Implementation deals: sum `implementation_usd` where `gp_margin_percent >= implMinGp`
  - NRR Actuals = Eligible CR/ER + Eligible Implementation
  - NRR Target = CR/ER Target + Implementation Target
  - Achievement = NRR Actuals / NRR Target
  - Payout = variableOteUsd * (nrrOtePct / 100) * Achievement

**Update `payoutEngine.ts`:**
- After Variable Pay and Commission calculations, add NRR Additional Pay calculation
- Store as a new `payout_type: 'nrr_additional'` in `monthly_payouts`

---

### Part 2: SPIFFs (Starting with Large Deal SPIFF)

#### Business Logic Recap

- Configurable per plan, linked to Variable OTE
- Large Deal SPIFF conditions:
  - Deal's `new_software_booking_arr_usd >= threshold` (e.g., 400,000)
  - SPIFF = Software Variable OTE * (Deal ARR / Software Target) * SPIFF Rate %
  - Software Variable OTE = Total Variable OTE * weightage of "New Software Booking ARR" metric in the plan

#### Database Changes

**New table: `plan_spiffs`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid, PK | Primary key |
| `plan_id` | uuid, FK to comp_plans | Which plan this SPIFF belongs to |
| `spiff_name` | text | Name (e.g., "Large Deal SPIFF") |
| `description` | text, nullable | Optional description |
| `linked_metric_name` | text | Which plan metric drives the OTE portion (e.g., "New Software Booking ARR") |
| `spiff_rate_pct` | numeric | % of the linked metric's OTE allocation (e.g., 25%) |
| `min_deal_value_usd` | numeric, nullable | Minimum deal value threshold (e.g., 400,000) |
| `is_active` | boolean, default true | Active toggle |
| `created_at` | timestamptz | Timestamp |

RLS policies: Same pattern as `plan_commissions` (read for authenticated, write for admin/gtm_ops).

#### UI Changes -- Plan Builder

Add a new **"SPIFFs"** card/section in `PlanBuilder.tsx`:

- Table showing configured SPIFFs (Name, Linked Metric, Rate %, Min Deal Value, Status, Actions)
- "Add SPIFF" button opens a dialog with fields:
  - SPIFF Name (text input)
  - Linked Metric (dropdown populated from plan's existing `plan_metrics`)
  - SPIFF Rate % (numeric input)
  - Min Deal Value (USD, optional numeric input)
  - Active toggle
- Edit and Delete actions on each row

**New components:**
- `src/components/admin/SpiffEditor.tsx` -- Table and CRUD, similar to `PlanCommissionEditor`
- `src/components/admin/SpiffFormDialog.tsx` -- Add/Edit dialog

#### Calculation Engine Updates

**New file: `src/lib/spiffCalculation.ts`**

- `calculateSpiffPayout(spiff, deals, planMetrics, variableOteUsd, targets)`:
  - Find the linked metric's weightage to derive Software Variable OTE
  - For each qualifying deal (where `new_software_booking_arr_usd >= min_deal_value_usd`):
    - Deal SPIFF = Software Variable OTE * (Deal ARR / Software Target) * spiff_rate_pct / 100
  - Return total SPIFF amount and per-deal breakdown

**New hook: `src/hooks/usePlanSpiffs.ts`**
- CRUD operations for `plan_spiffs` table (following same pattern as `usePlanCommissions`)

**Update `payoutEngine.ts`:**
- After NRR calculation, process SPIFFs
- Store as `payout_type: 'spiff'` in `monthly_payouts`

---

### Implementation Sequence

1. **Database migration** -- Add `nrr_ote_percent`, `cr_er_min_gp_margin_pct`, `impl_min_gp_margin_pct` columns to `comp_plans`; create `plan_spiffs` table with RLS
2. **NRR UI** -- Add NRR Additional Pay settings card in Plan Builder
3. **SPIFF UI** -- Add SPIFFs section with CRUD in Plan Builder (new `SpiffEditor`, `SpiffFormDialog`, `usePlanSpiffs` hook)
4. **NRR Calculation** -- New `nrrCalculation.ts` module
5. **SPIFF Calculation** -- New `spiffCalculation.ts` module
6. **Payout Engine Integration** -- Wire both into `payoutEngine.ts` so they execute during payout runs

### Files to Create
- `src/lib/nrrCalculation.ts`
- `src/lib/spiffCalculation.ts`
- `src/components/admin/NrrSettingsCard.tsx`
- `src/components/admin/SpiffEditor.tsx`
- `src/components/admin/SpiffFormDialog.tsx`
- `src/hooks/usePlanSpiffs.ts`

### Files to Modify
- `src/pages/PlanBuilder.tsx` -- Add NRR and SPIFF sections
- `src/lib/payoutEngine.ts` -- Integrate NRR and SPIFF calculations
- `src/hooks/useCompPlans.ts` -- Include new `comp_plans` columns in the interface

