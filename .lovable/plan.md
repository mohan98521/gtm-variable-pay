

## Closing ARR Project-Level Audit Feature

### Overview
Persist each Closing ARR project's contribution during payout runs to a new `closing_arr_payout_details` table, and display it in the Payout Workings UI as a new "Closing ARR" tab alongside the existing "Deals" tab.

### 1. New Database Table

Create `closing_arr_payout_details` with columns:
- `id` (uuid, PK)
- `payout_run_id` (uuid, NOT NULL)
- `employee_id` (text, NOT NULL) -- employee_id code, matching existing pattern
- `closing_arr_actual_id` (uuid, NOT NULL) -- FK to closing_arr_actuals.id
- `pid` (text)
- `customer_name` (text)
- `customer_code` (text)
- `bu` (text)
- `product` (text)
- `month_year` (date)
- `end_date` (date)
- `is_multi_year` (boolean, default false)
- `renewal_years` (integer, default 1)
- `closing_arr_usd` (numeric, default 0) -- raw closing ARR
- `multiplier` (numeric, default 1.0) -- applied renewal multiplier
- `adjusted_arr_usd` (numeric, default 0) -- closing_arr * multiplier
- `is_eligible` (boolean, default true) -- whether end_date > fiscal year end
- `exclusion_reason` (text, nullable)
- `order_category_2` (text, nullable) -- software vs managed_services
- `created_at` (timestamptz, default now())

RLS policies: admin/finance/gtm_ops get full access; employees see only their own records (matching `pdd_manage` / `pdd_own_view` pattern from `payout_deal_details`).

### 2. Payout Engine Changes (`src/lib/payoutEngine.ts`)

**a) Capture project-level details during calculation (around lines 730-780)**

Inside the `isClosingArr` branch, after filtering and computing multipliers, build an array of per-project detail records capturing: PID, customer, closing ARR, renewal years, multiplier, adjusted ARR, and eligibility status. Include ALL projects for the employee (not just eligible ones), marking ineligible ones with `is_eligible: false` and `exclusion_reason: "Contract end_date <= fiscal year end"`.

Add a `closingArrDetails` array to the `EmployeePayoutResult` interface.

**b) Persist during `persistDealDetails` (around lines 2280-2435)**

After persisting `payout_deal_details`, delete existing `closing_arr_payout_details` for the run, then batch-insert the new records (same 100-record batch pattern).

**c) Cleanup on delete (usePayoutRuns.ts)**

Add `closing_arr_payout_details` to the delete cascade in `useDeletePayoutRun`.

### 3. Data Hook: `useClosingArrPayoutDetails.ts`

New hook following the `usePayoutDealDetails` pattern:
- Queries `closing_arr_payout_details` by `payout_run_id`
- Joins employee names from the `employees` table
- Returns typed array with filters/search support

### 4. UI Component: `PayoutRunClosingArrWorkings.tsx`

New component following the `PayoutRunDealWorkings` pattern:
- Filters: search (employee/PID/customer), eligibility, multi-year
- Summary badges: Total Projects, Eligible, Excluded
- Table columns: Employee, PID, Customer, BU, Product, End Date, Multi-Year?, Renewal Yrs, Closing ARR, Multiplier, Adjusted ARR, Eligible?, Exclusion Reason

### 5. Tab Integration (`PayoutRunWorkings.tsx`)

Add a fourth tab "Closing ARR" to the existing Summary/Detail/Deals tabs, rendering the new `PayoutRunClosingArrWorkings` component.

### Technical Details

**Database migration SQL:**
```sql
CREATE TABLE public.closing_arr_payout_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id uuid NOT NULL,
  employee_id text NOT NULL,
  closing_arr_actual_id uuid NOT NULL,
  pid text NOT NULL,
  customer_name text,
  customer_code text,
  bu text,
  product text,
  month_year date,
  end_date date,
  is_multi_year boolean NOT NULL DEFAULT false,
  renewal_years integer NOT NULL DEFAULT 1,
  closing_arr_usd numeric NOT NULL DEFAULT 0,
  multiplier numeric NOT NULL DEFAULT 1.0,
  adjusted_arr_usd numeric NOT NULL DEFAULT 0,
  is_eligible boolean NOT NULL DEFAULT true,
  exclusion_reason text,
  order_category_2 text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.closing_arr_payout_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capd_manage" ON public.closing_arr_payout_details
  FOR ALL USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'finance') OR
    has_role(auth.uid(), 'gtm_ops')
  );

CREATE POLICY "capd_own_view" ON public.closing_arr_payout_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.employee_id IS NOT NULL
        AND closing_arr_payout_details.employee_id = p.employee_id
    )
  );

CREATE INDEX idx_capd_payout_run ON public.closing_arr_payout_details(payout_run_id);
CREATE INDEX idx_capd_employee ON public.closing_arr_payout_details(employee_id);
```

**Files to create:**
- `src/hooks/useClosingArrPayoutDetails.ts`
- `src/components/admin/PayoutRunClosingArrWorkings.tsx`

**Files to modify:**
- `src/lib/payoutEngine.ts` -- add closingArrDetails to result type, capture during calculation, persist during save
- `src/hooks/usePayoutRuns.ts` -- add delete cascade
- `src/components/admin/PayoutRunWorkings.tsx` -- add "Closing ARR" tab

