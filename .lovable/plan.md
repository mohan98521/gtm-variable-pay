

## Add Configurable Payout Split to NRR and SPIFF

### Overview

Instead of hardcoding NRR and SPIFF payouts as 100% collection-linked, we add the same three-way payout split UI (Upon Bookings %, Upon Collections %, At Year End %) that the Commission Structure already uses. This makes the payout timing fully configurable per plan for NRR and per SPIFF entry.

---

### Database Migration

**Add 3 columns to `comp_plans`** (for NRR payout split):

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `nrr_payout_on_booking_pct` | numeric | 0 | % paid upon booking |
| `nrr_payout_on_collection_pct` | numeric | 100 | % held for collection |
| `nrr_payout_on_year_end_pct` | numeric | 0 | % reserved for year-end |

Defaults to 0/100/0 (100% collection-linked) matching the stated business requirement, but now configurable.

**Add 3 columns to `plan_spiffs`** (per-SPIFF payout split):

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `payout_on_booking_pct` | numeric | 0 | % paid upon booking |
| `payout_on_collection_pct` | numeric | 100 | % held for collection |
| `payout_on_year_end_pct` | numeric | 0 | % reserved for year-end |

Same defaults (0/100/0).

---

### UI Changes

#### 1. NRR Settings Card (`NrrSettingsCard.tsx`)

Rewrite to a table + dialog pattern (matching Commission Structure):

- **Table view**: Shows one row with NRR OTE %, CR/ER Min GP %, Impl Min GP %, Payout Split (Booking/Collection/Year End), and Edit/Delete actions
- **Add/Edit Dialog**: All 6 fields (3 existing + 3 new payout split inputs) with the same auto-balancing logic used in `CommissionFormDialog` (the three percentages must sum to 100%, and changing one auto-adjusts the others)
- **Empty state**: "No NRR Additional Pay Configured" with an Add button
- Formula info callout remains in the dialog

#### 2. SPIFF Form Dialog (`SpiffFormDialog.tsx`)

Add a "Payout Split" section at the bottom (identical to `CommissionFormDialog`):
- Three inputs: Upon Bookings (%), Upon Collections (%), At Year End (%)
- Auto-balancing logic (must sum to 100%)
- Warning indicator when sum is not 100%

#### 3. SPIFF Editor Table (`SpiffEditor.tsx`)

Add a "Payout Split" column to the table showing the configured split (e.g., "0% Booking / 100% Collection / 0% Year End").

---

### Payout Engine Updates (`payoutEngine.ts`)

**NRR record persistence**: Read `nrr_payout_on_booking_pct`, `nrr_payout_on_collection_pct`, `nrr_payout_on_year_end_pct` from the plan and apply the three-way split to the NRR payout amount (instead of hardcoding all to booking).

**SPIFF record persistence**: Read `payout_on_booking_pct`, `payout_on_collection_pct`, `payout_on_year_end_pct` from each `plan_spiff` record and apply the split.

**Payable This Month**: Only the booking portion of NRR/SPIFF is included in immediate payable; collection and year-end portions are held.

---

### Hook Updates

- **`useCompPlans.ts`**: Add `nrr_payout_on_booking_pct`, `nrr_payout_on_collection_pct`, `nrr_payout_on_year_end_pct` to the `CompPlan` interface
- **`usePlanSpiffs.ts`**: Add the 3 payout split fields to `PlanSpiff` interface and CRUD mutations

---

### Technical Details

#### Files to Modify
- `src/components/admin/NrrSettingsCard.tsx` -- Full rewrite to table+dialog with payout split
- `src/components/admin/SpiffFormDialog.tsx` -- Add payout split section
- `src/components/admin/SpiffEditor.tsx` -- Add payout split column to table
- `src/hooks/useCompPlans.ts` -- Add NRR payout split fields to interface
- `src/hooks/usePlanSpiffs.ts` -- Add payout split fields to interface and mutations
- `src/lib/payoutEngine.ts` -- Use configurable splits instead of hardcoded booking

#### Implementation Sequence
1. Database migration (add 6 columns total)
2. Update hooks with new fields
3. Rewrite NRR Settings Card with table+dialog+payout split
4. Update SPIFF Form Dialog and Editor with payout split
5. Update payout engine to use configurable splits
