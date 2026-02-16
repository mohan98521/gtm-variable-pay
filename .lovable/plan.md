

## Executive Dashboard Updates

### Three Changes Requested

**1. Payout Source: Only from Finalized/Paid Payout Runs**

Currently, `useExecutiveDashboard.ts` fetches all `monthly_payouts` regardless of payout run status. Since the payout lifecycle is Draft -> Review -> Approved -> Finalized -> Paid, the Executive Dashboard should only show "Eligible Payouts" from runs that have reached `finalized` or `paid` status.

**Fix:** Add a filter to the current payouts query by first fetching finalized/paid `payout_runs`, then filtering `monthly_payouts` by those run IDs. Alternatively, join on `payout_run_id` and filter by `run_status IN ('finalized', 'paid')`.

Since Supabase JS client doesn't support direct joins with filters on the related table easily, the approach will be:
- Query `payout_runs` for the FY where `run_status` is `finalized` or `paid`, get their IDs
- Query `monthly_payouts` filtered by those run IDs using `.in('payout_run_id', runIds)`

This affects: North Star total payout, monthly trend chart, payout by function donut, and top performers payout column.

**2. Replace "vs Last Year" with "Budget" (Pro-Rated TVP)**

Since there is no prior year data, the YoY comparison is meaningless. Replace it with a Budget comparison:
- **Budget** = Sum of `tvp_usd` for all active employees (already computed as `totalBudget`)
- The North Star "Total Variable Payout" card subtext changes from "+X% vs last year" to "X% of Budget ($XM)"
- Remove the `priorPayoutsQuery` entirely since it is no longer needed
- Remove `totalPayoutPriorYear` and `yoyChangePct` from the interface

**3. Remove Currency Toggle, USD Only**

Strip the currency toggle from `ExecutiveDashboard.tsx`:
- Remove `useState` for `currencyMode`
- Remove the toggle buttons and mixed-currency badge from the header
- Remove `currencyMode` prop from `NorthStarCards`
- Clean up `NorthStarCards` interface to remove the `currencyMode` prop

### Files Modified

| File | Changes |
|------|---------|
| `src/hooks/useExecutiveDashboard.ts` | Add `payout_runs` query filtered by `finalized`/`paid`; filter payouts by eligible run IDs; remove prior year query; remove `yoyChangePct` and `totalPayoutPriorYear` from interface |
| `src/pages/ExecutiveDashboard.tsx` | Remove currency toggle state, buttons, badge, and import; remove `currencyMode` prop from NorthStarCards |
| `src/components/executive/NorthStarCards.tsx` | Remove `currencyMode` from props interface; change "vs last year" subtext to "X% of Budget" using `payoutVsBudgetPct` and `totalBudget` |

### Technical Details

**Hook changes (`useExecutiveDashboard.ts`):**

```typescript
// New query: fetch only finalized/paid run IDs
const payoutRunsQuery = useQuery({
  queryKey: ["exec-payout-runs", selectedYear],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("payout_runs")
      .select("id")
      .gte("month_year", fyStart)
      .lte("month_year", fyEnd)
      .in("run_status", ["finalized", "paid"]);
    if (error) throw error;
    return data || [];
  },
});

// Current payouts query: filter by eligible run IDs
const eligibleRunIds = payoutRunsQuery.data?.map(r => r.id) || [];
// Only fetch if we have run IDs (or return empty)
const currentPayoutsQuery = useQuery({
  queryKey: ["exec-payouts-current", selectedYear, eligibleRunIds],
  queryFn: async () => {
    if (eligibleRunIds.length === 0) return [];
    const { data, error } = await supabase
      .from("monthly_payouts")
      .select("employee_id, month_year, payout_type, calculated_amount_usd")
      .in("payout_run_id", eligibleRunIds);
    if (error) throw error;
    return data || [];
  },
  enabled: !payoutRunsQuery.isLoading,
});
```

Remove `priorPayoutsQuery` entirely. Remove `totalPayoutPriorYear`, `yoyChangePct` from `ExecutiveDashboardData`. Remove `calculated_amount_local` and `local_currency` from the select since we only show USD.

**NorthStarCards changes:**
- First card subtext changes from YoY trend arrow to: "X% of Budget ($XM)" using existing `payoutVsBudgetPct` and `totalBudget`
- Since the third card ("Payout vs Budget") now duplicates the first card's subtext concept, keep it but it serves as a visual progress bar complement

**Active Payees:**
- Keep showing count of employees with payouts from eligible (finalized/paid) runs — these are the actual eligible employees

### No Database Changes Required

