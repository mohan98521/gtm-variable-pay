

## Payout Run Detailed Workings Report

### Problem
After running a payout calculation, the detail view shows only aggregate totals per employee (VP, Commissions, Splits). There is no way to verify **how** those numbers were derived -- what target was used, what actual was achieved, which multiplier applied, and how the eligible payout breaks down by metric. Finance and GTM Ops need this transparency to validate calculations before approving.

### Solution
Add a **"Detailed Workings"** tab/view within the Payout Run Detail that shows, for each employee, a metric-by-metric breakdown of the calculation, plus the three-way split and incremental deduction logic.

---

### What the report will show (per employee, per metric/component)

**Section 1: Variable Pay -- Metric-Level Workings**

| Metric | Target (USD) | YTD Actuals (USD) | Ach % | Allocated OTE (USD) | Multiplier | YTD Eligible (USD) | Prior Paid (USD) | This Month (USD) |
|--------|-------------|-------------------|-------|---------------------|------------|-------------------|-----------------|-----------------|
| New Software Booking ARR | 1,000,000 | 650,000 | 65% | 30,000 | 1.0x | 19,500 | 15,000 | 4,500 |
| Closing ARR | 500,000 | 520,000 | 104% | 20,000 | 1.6x | 20,800 | 18,000 | 2,800 |
| **VP Total** | | | | **50,000** | | **40,300** | **33,000** | **7,300** |

**Section 2: Three-Way Split (per component)**

| Component | Eligible (USD) | Upon Booking | Upon Collection | At Year End |
|-----------|---------------|-------------|----------------|------------|
| Variable Pay | 7,300 | 5,110 (70%) | 1,825 (25%) | 365 (5%) |
| Commission: Managed Services | 2,400 | 1,680 | 600 | 120 |
| NRR Additional Pay | 1,200 | 0 | 1,200 | 0 |
| SPIFF | 800 | 560 | 200 | 40 |

**Section 3: Payable This Month**

| Line Item | Amount (USD) |
|-----------|-------------|
| Upon Booking (VP + Comm + NRR + SPIFF) | 7,350 |
| Collection Releases | 3,200 |
| Year-End Releases | 0 |
| Clawback Recovery | -500 |
| **Payable This Month** | **10,050** |

---

### Data Strategy

The payout engine already computes all the per-metric detail in memory (target, actual, achievement, multiplier, allocated OTE) but discards it after aggregation. We need to **persist** this detail.

#### New Database Table: `payout_metric_details`

This table stores the metric-level calculation workings for each employee in each payout run.

```
payout_metric_details
- id (uuid, PK)
- payout_run_id (uuid, FK -> payout_runs)
- employee_id (uuid, FK -> employees)
- component_type (text) -- 'variable_pay', 'commission', 'nrr', 'spiff', 'deal_team_spiff', 'collection_release', 'year_end_release', 'clawback'
- metric_name (text) -- e.g. 'New Software Booking ARR', 'Closing ARR', 'Managed Services', 'NRR Additional Pay'
- plan_id (uuid, FK -> comp_plans)
- plan_name (text)
- target_bonus_usd (numeric) -- employee's target bonus for this run
- allocated_ote_usd (numeric) -- portion of OTE allocated to this metric (weightage)
- target_usd (numeric) -- performance target
- actual_usd (numeric) -- YTD actuals
- achievement_pct (numeric)
- multiplier (numeric)
- ytd_eligible_usd (numeric) -- full YTD payout before incremental
- prior_paid_usd (numeric) -- sum of prior finalized months
- this_month_usd (numeric) -- incremental = ytd_eligible - prior_paid
- booking_usd (numeric)
- collection_usd (numeric)
- year_end_usd (numeric)
- notes (text) -- any special context (clawback exempt, linked_to_impl, etc.)
- created_at (timestamptz)
```

#### Changes to Payout Engine

Modify `persistPayoutResults()` to also insert rows into `payout_metric_details` using the calculation context that's already available in `EmployeePayoutResult` and the intermediate metric-level calculations.

The key change is in `calculateEmployeeVariablePay()` -- instead of only returning aggregate totals, also return the per-metric detail array (target, actual, achievement, multiplier, allocated OTE, YTD eligible). This data is already computed inside the loop but currently discarded after summation.

#### Changes to the `EmployeePayoutResult` interface

Add a new field:
```typescript
metricDetails: MetricPayoutDetail[];
```

Where `MetricPayoutDetail` captures each metric's workings.

---

### UI Implementation

#### New Component: `PayoutRunWorkings.tsx`

- Located at `src/components/admin/PayoutRunWorkings.tsx`
- Receives `payoutRunId` as prop
- Fetches data from `payout_metric_details` table grouped by employee
- Expandable accordion per employee showing:
  - Metric-level table (Section 1 above)
  - Three-way split table (Section 2)
  - Payable summary (Section 3)
  - Clawback highlight row (red) if any
- Search/filter by employee name
- Currency filter (same as existing)
- Inherits the payout run status badge

#### Integration into PayoutRunDetail.tsx

Add a **Tabs** component with two tabs:
1. **Summary** (existing content -- employee payouts table)
2. **Detailed Workings** (new component)

The tab selection persists in local state. Both tabs share the same header, summary cards, and export buttons.

#### Export Enhancement

Add a new XLSX sheet "Detailed Workings" to the existing multi-sheet export that includes all metric-level rows across all employees.

---

### Technical Details

**Files to create:**
- `src/components/admin/PayoutRunWorkings.tsx` -- New detailed workings UI component
- `src/hooks/usePayoutMetricDetails.ts` -- Hook to fetch metric detail data

**Files to modify:**
- `src/lib/payoutEngine.ts`:
  - Add `MetricPayoutDetail` interface
  - Update `EmployeePayoutResult` to include `metricDetails[]`
  - Update `calculateEmployeeVariablePay()` to return per-metric details
  - Update `calculateMonthlyPayout()` to build commission/NRR/SPIFF detail rows
  - Update `persistPayoutResults()` to insert into `payout_metric_details`
- `src/components/admin/PayoutRunDetail.tsx`:
  - Wrap existing content in Tabs (Summary / Detailed Workings)
  - Add "Detailed Workings" XLSX sheet to export
- **Database migration**: Create `payout_metric_details` table with RLS policies

**No changes to existing calculation logic** -- the math stays the same. We are only capturing and persisting intermediate values that are already computed but currently discarded.

