

## Plan: Deal-Level Payout Workings

### Problem

Users currently see only aggregated metric-level totals in the Payout Run Workings view. There is no way to drill into which deals contributed to those numbers, which deals were excluded, and why. This makes it difficult to validate the computation.

### Current State of Deal Data

| Data Type | Persisted? | Table |
|---|---|---|
| Variable Pay deal attribution | Yes | `deal_variable_pay_attribution` |
| Commission deal payouts (qualified) | Yes | `monthly_payouts` (with `deal_id`) |
| Deals evaluated but excluded | No | Not stored |

### Solution: Two-Part Implementation

#### Part 1: Persist Deal-Level Commission Workings (including excluded deals)

Create a new table `payout_deal_details` that captures every deal evaluated during a payout run, with an eligibility status and exclusion reason.

**New table: `payout_deal_details`**

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| payout_run_id | uuid | FK to payout_runs |
| employee_id | uuid | FK to employees |
| deal_id | uuid | FK to deals |
| project_id | text | Deal project ID |
| customer_name | text | Customer name |
| commission_type | text | e.g., Managed Services, CR/ER |
| deal_value_usd | numeric | TCV or metric-specific value |
| gp_margin_pct | numeric | GP margin (if applicable) |
| min_gp_margin_pct | numeric | Required threshold |
| commission_rate_pct | numeric | Rate applied |
| is_eligible | boolean | Whether deal qualified |
| exclusion_reason | text | Why excluded (e.g., "GP margin 35% below minimum 55%") |
| gross_commission_usd | numeric | Commission if eligible |
| booking_usd | numeric | Upon booking portion |
| collection_usd | numeric | Upon collection portion |
| year_end_usd | numeric | Year-end holdback |
| created_at | timestamptz | Auto-populated |

#### Part 2: Add "Deal Workings" Tab in the Payout Run Detail View

Add a third tab option ("Deals") alongside the existing Summary and Detail views in the PayoutRunWorkings component. This tab will show:

- A searchable, filterable table of all deals evaluated per employee
- Clear visual distinction between eligible (green badge) and excluded (red badge) deals
- Exclusion reason displayed for ineligible deals
- Ability to filter by: Employee, Commission Type, Eligibility Status
- Columns: Project ID, Customer, Commission Type, Deal Value, GP Margin, Threshold, Eligible?, Exclusion Reason, Commission, Booking, Collection, Year-End

### Technical Details

**Files to modify:**

1. **New migration** -- Create `payout_deal_details` table with RLS policies
2. **`src/lib/payoutEngine.ts`** -- In the commission calculation loop, persist ALL evaluated deals (both qualified and disqualified) to the new table. Modify the `calculateEmployeeCommissions` function to also track excluded deals with reasons, and add persistence in the `persistPayoutData` function
3. **`src/hooks/usePayoutMetricDetails.ts`** -- Add a new hook `usePayoutDealDetails` to fetch deal-level data from the new table
4. **`src/components/admin/PayoutRunWorkings.tsx`** -- Add a "Deals" tab to the existing Summary/Detail toggle, with a new `PayoutRunDealWorkings` component
5. **New file: `src/components/admin/PayoutRunDealWorkings.tsx`** -- Table component showing deal-level workings with eligibility badges and exclusion reasons

**Engine changes (payoutEngine.ts):**
- Currently, when `gpMarginQualifies` is false, the deal is simply skipped. The fix will push a record with `qualifies: false` and an `exclusionReason` to the calculations array
- The persistence function will write all calculations (qualified and disqualified) to `payout_deal_details`
- Variable Pay deal data will also be included by reading from the existing `deal_variable_pay_attribution` table

**No changes to existing payout calculation logic** -- the actual computation remains identical; we are only adding observability.
