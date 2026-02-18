

## Add Payout Workings Report to Reports Section

### Overview
Replicate the Payout Run validation reports (Summary, Detailed Workings, Deal Workings, Closing ARR) into the Reports section, with payout run status display and role-based data visibility.

### How It Works

**Data Visibility by Role:**
- **Admin / GTM Ops / Finance / Executive**: See all employees' data across all payout runs
- **Sales Head**: See their own data plus direct reports
- **Sales Rep**: See only their own data

**Payout Run Visibility:**
- Admin/Finance/GTM Ops roles can see runs in all statuses (Draft, Calculating, Review, Approved, Finalized, Paid)
- Other roles can only see Finalized and Paid runs (enforced by existing database security)

**Status Display:**
- Each selected month will show a status badge (Draft, Review, Approved, Finalized, Paid) matching the current payout run status

### Changes

#### 1. New File: `src/components/reports/PayoutWorkingsReport.tsx`
A self-contained report component that:
- Fetches payout runs for the selected fiscal year
- Provides a month selector dropdown populated from available payout runs
- Displays a status badge for the selected run
- Shows summary cards (Total Eligible, Variable Pay, Commissions, Payable This Month, Employee Count)
- Embeds the existing `PayoutRunWorkings` component (Summary, Detail, Deals, Closing ARR sub-tabs)
- Applies **client-side role filtering** on the employee summary table:
  - Fetches the current user's profile to get their employee_id
  - For sales reps: filters breakdown to only their own employee UUID
  - For sales heads: fetches direct reports from employees table and filters to self + team
  - Admin/Finance/GTM Ops/Executive: no filtering (show all)
- The Detailed Workings, Deal Workings, and Closing ARR sub-views are automatically filtered by database security policies (each table has "own view" policies for non-admin roles)

#### 2. Modified File: `src/pages/Reports.tsx`
- Import `PayoutWorkingsReport` component
- Add a new "Payout Workings" tab in the **Personal Reports** section (since all roles including reps can access it with filtered data)
- Add corresponding `TabsContent` rendering the `PayoutWorkingsReport` component

### Technical Details

**Database security already in place:**
- `payout_metric_details` table: `pmd_own_view` policy restricts SELECT to `employee_id = auth.uid()` for non-admin roles
- `payout_deal_details` table: `pdd_own_view` policy restricts SELECT to `employee_id = auth.uid()`
- `closing_arr_payout_details` table: `capd_own_view` policy restricts SELECT to matching employee_id via profiles
- `payout_runs` table: `pr_view_finalized` policy only shows finalized/paid runs to non-admin roles
- `monthly_payouts` table: Has open SELECT (`mp_view: true`), so client-side filtering is needed for the summary breakdown

**No database migrations required** -- all existing RLS policies already enforce proper data isolation. Only client-side filtering is needed for the `monthly_payouts`-based employee summary.

**Files changed: 2** (1 new, 1 modified)

