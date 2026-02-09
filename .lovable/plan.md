

# Plan: Fix Payout Engine to Match My Deals Logic + Collection Releases + Year-End December Release

## Overview

This plan addresses 6 problems in the payout engine and detail view to ensure calculations match the "My Deals" report logic, properly handle the three-way payout split lifecycle, and release year-end reserves in December.

---

## Problems and Fixes

### Problem 1: Commission fallback defaults are wrong (70/25/5 vs actual 0/100/0)

The `calculateDealCommission` function and all calls to it use 70/25/5 as fallback defaults. But every commission in the database is configured as 0% booking / 100% collection / 0% year-end.

**Fix**: Change all fallback defaults from 70/25/5 to 0/100/0 in:
- `src/lib/commissions.ts` (function signature defaults, lines 43-44)
- `src/lib/payoutEngine.ts` (every `?? 70`, `?? 25`, `?? 5` in commission section)

### Problem 2: `linked_to_impl` not handled in commission calculation

Deals flagged `linked_to_impl = true` must force splits to 0/100/0 regardless of plan config.

**Fix**: In `calculateEmployeeCommissions` (payoutEngine.ts):
- Add `linked_to_impl` to the deal query select
- When `linked_to_impl = true`, override splits to 0/100/0

### Problem 3: Clawback-exempt plans should release booking + collection immediately

Plans marked `is_clawback_exempt = true` (CSM, Product Specialist, Sales Engineering) should waive collection dependency. For these plans, both booking and collection portions are paid immediately — only year-end is held.

**Fix**: In `calculateMonthlyPayout`:
- Fetch `is_clawback_exempt` from the comp plan
- Pass it into the calculation context
- For VP: combine booking + collection into a single "booking" amount (immediate release)
- For commissions: same treatment — merge booking + collection into immediate payout

### Problem 4: VP is YTD total, not monthly increment

The engine computes full YTD variable pay and stores it as the monthly amount. February's run would show Jan+Feb total instead of just February's delta.

**Fix**: After computing YTD VP, query `monthly_payouts` for prior finalized VP records in the same fiscal year for this employee, then:
```
Monthly VP = YTD VP - Sum(prior months' VP amounts)
```
Apply the three-way split to the monthly increment only.

### Problem 5: No collection release logic + no year-end December release

When a deal booked in Month A is collected in Month B, the "Upon Collection" amount should be released in Month B's payout. Currently the engine ignores the `deal_collections` table entirely.

Additionally, for the December payout run, all accumulated "At Year End" reserves from the entire fiscal year should be released as payable.

**Fix**: Add a new function `calculateCollectionReleases` that:
1. Queries `deal_collections` where `collection_month` matches current month and `is_collected = true`
2. For each collected deal, looks up the original `deal_variable_pay_attribution` to find `payout_on_collection_usd` amounts
3. Also checks `monthly_payouts` for commission collection holdbacks on collected deals
4. Creates "Collection Release" payout records

**December Year-End Release**: Add logic that detects if the current month is December (month 12). If so:
1. Query all `monthly_payouts` for the fiscal year where `year_end_amount_usd > 0`
2. Sum all year-end reserves by employee
3. Create "Year-End Release" payout records that release these accumulated reserves
4. These appear as additional payable amounts in December's "Payable This Month"

### Problem 6: Detail view missing three-way split columns

The PayoutRunDetail table only shows VP, Comm, and Total. Missing: Total Eligible, Upon Booking, Upon Collection, At Year End, Collection Releases, Payable This Month.

**Fix**: Update `EmployeePayoutSummary` interface and the detail view table.

---

## Technical Details

### Files to Change

| File | Changes |
|------|---------|
| `src/lib/commissions.ts` | Change default params from 70/25/5 to 0/100/0 (lines 43-44, 104-106) |
| `src/lib/payoutEngine.ts` | 1. Add `linked_to_impl` to commission deal select. 2. Apply 0/100/0 override for impl-linked deals. 3. Handle `is_clawback_exempt` (merge booking+collection for exempt plans). 4. Add incremental VP logic. 5. Add `calculateCollectionReleases()`. 6. Add December year-end release logic. 7. Fix all commission fallback defaults. |
| `src/hooks/useMonthlyPayouts.ts` | Expand `EmployeePayoutSummary` with: `vpBookingUsd`, `vpCollectionUsd`, `vpYearEndUsd`, `commBookingUsd`, `commCollectionUsd`, `commYearEndUsd`, `collectionReleasesUsd`, `yearEndReleasesUsd`, `totalEligibleUsd`, `payableThisMonthUsd`. Update aggregation logic. |
| `src/components/admin/PayoutRunDetail.tsx` | New table columns: Total Eligible, Upon Booking, Upon Collection, At Year End, Collection Releases, Payable This Month. New summary cards. Updated CSV/XLSX exports. |

### Calculation Flow Per Employee

```text
1. Compute YTD VP (achievement x multiplier x bonus allocation)
2. Subtract prior months' VP to get Monthly VP Increment
3. Apply three-way split to increment:
   - If clawback-exempt: Immediate = booking% + collection%, Held = 0, Year-End = year_end%
   - If normal: Booking = booking%, Collection = collection%, Year-End = year_end%
4. Compute commissions per deal:
   - If linked_to_impl: force 0/100/0
   - Else: use plan commission splits (currently all 0/100/0 in DB)
5. Calculate Collection Releases:
   - Find deals collected this month from deal_collections
   - Sum their "Upon Collection" amounts from prior VP attributions + commission holdbacks
6. If December: Calculate Year-End Releases:
   - Sum all year_end_amount_usd from monthly_payouts for Jan-Nov
   - Release as "Year-End Release" payout records
7. Payable This Month = Upon Booking + Collection Releases + Year-End Releases (Dec only)
```

### Updated Detail View Columns

| Employee | Currency | VP (USD) | Comm (USD) | Total Eligible | Upon Booking | Upon Collection | At Year End | Collection Releases | Payable This Month |

### Summary Cards (updated)

1. **Total Eligible** (replaces "Total Payout") - VP + Comm gross earned
2. **Variable Pay** - unchanged
3. **Commissions** - unchanged  
4. **Payable This Month** (new) - booking portions + collection releases + year-end releases (Dec)
5. **Employees** - unchanged

### Expected Outcome

- VP shows incremental monthly amounts, not repeated YTD totals
- Commissions respect `linked_to_impl` (0/100/0 for impl-linked deals)
- Clawback-exempt plans release booking + collection immediately
- Deals collected in the current month trigger release of held collection amounts
- December payout run releases all accumulated year-end reserves
- Detail view shows full three-way split plus releases
- "Payable This Month" = Upon Booking + Collection Releases + Year-End Releases
- Numbers align with My Deals report

