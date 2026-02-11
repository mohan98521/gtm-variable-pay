

## Dashboard Summary Cards: Source from Payout Run Data

### Problem
The Dashboard summary cards (Total Eligible, Amount Paid, Holding, Commission) are independently calculated by the `useCurrentUserCompensation` hook using raw deal data and plan configurations. This can produce different numbers from the official Payout Run results stored in `monthly_payouts`, causing confusion.

### Solution
Modify the Dashboard to source its summary card values from the persisted `monthly_payouts` table (the same data used in Payout Run Detail and Payout Statements), ensuring a single source of truth across all views.

### What Changes

**1. New hook: `useDashboardPayoutSummary`**
- Fetches all `monthly_payouts` records for the current employee across the fiscal year
- Aggregates YTD totals:
  - **Total Eligible** = sum of `calculated_amount_usd` for Variable Pay + commission types
  - **Amount Paid** = sum of `booking_amount_usd` (Upon Booking portion)
  - **Holding (Collection)** = sum of `collection_amount_usd`
  - **Holding (Year-End)** = sum of `year_end_amount_usd`
  - **Commission** = sum of `calculated_amount_usd` for non-VP types (Managed Services, CR/ER, etc.)
- Falls back to the existing `useCurrentUserCompensation` calculated values when no payout run data exists (showing an "Estimated" badge)

**2. Update `Dashboard.tsx` summary cards**
- Use the new hook for card values
- Add a small indicator (badge or tooltip) showing whether data is from finalized payout runs or estimated
- Keep `useCurrentUserCompensation` for the detailed metrics tables, monthly breakdown, and simulator (these need the granular calculation data)

**3. No database changes required**
- All data already exists in `monthly_payouts` with the correct split fields (`booking_amount_usd`, `collection_amount_usd`, `year_end_amount_usd`)

### Technical Details

The new hook will:
1. Get the current user's employee UUID (via `profiles` -> `employees` lookup)
2. Query `monthly_payouts` filtered by `employee_id` and `month_year` within the fiscal year
3. Aggregate by payout type to produce summary totals
4. Return a flag indicating whether payout data was found (finalized) or not (estimated)

The Dashboard will prefer payout run data when available, with a clear visual indicator of the data source. The detailed tables and simulator will continue using the real-time calculation from `useCurrentUserCompensation`.
