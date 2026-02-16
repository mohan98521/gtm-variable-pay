

## Fix: Attainment 0% Bug + Add Software/Closing ARR Columns

### Root Cause: ID Type Mismatch

The attainment is always 0% because of a key mismatch between three data sources:

- `monthly_payouts.employee_id` stores **UUIDs** (e.g., `da2f0c64-...`)
- `performance_targets.employee_id` stores **string IDs** (e.g., `AF0001`)
- `deals.sales_rep_employee_id` stores **string IDs** (e.g., `AF0001`)

When building the Top Performers list, the code keys `empPayoutMap` by UUID but `empTargetMap`/`empActualMap` by string ID. The lookup on line 250 never matches, so every performer shows 0%.

### Fix Summary

**File: `src/hooks/useExecutiveDashboard.ts`**

1. **Add `employee_id` (string) to the employees query** so we can build a UUID-to-stringID lookup map.

2. **Build a bidirectional map** (`uuidToStringId`) from the employees data. Use this to bridge between payout data (UUID-keyed) and targets/deals data (string-keyed).

3. **Compute per-employee metric-level attainment** instead of one aggregate number. Split targets into:
   - **Software ARR**: targets with `metric_type` containing "New Software Booking ARR" (including Team/Org variants)
   - **Closing ARR**: targets with `metric_type = "Closing ARR"`

4. **Fetch Closing ARR actuals** from the `closing_arr_actuals` table (latest month snapshot, filtered by contract end_date eligibility) to compute Closing ARR achievement.

5. **Expand the `TopPerformer` interface** to include:
   - `softwareArrAchPct` -- Software Booking ARR achievement %
   - `closingArrAchPct` -- Closing ARR achievement %

6. **Fix the top performers mapping** to translate UUIDs to string IDs when looking up attainment.

**File: `src/components/executive/TopPerformers.tsx`**

7. **Add two new columns** to the table:
   - "Software %" -- shows the Software ARR achievement percentage
   - "Closing ARR %" -- shows the Closing ARR achievement percentage
   - Each uses color-coded badges (green >= 100%, amber >= 80%, red < 80%)

8. **Add a footer note** clarifying the data source: "Payouts from finalized monthly payout runs. Achievement from deal actuals vs performance targets."

### Updated Top Performers Table Layout

```text
| # | Name | Role/Region | Payout | Software % | Closing ARR % | Att. % |
```

### Data Source Clarification (shown as a subtle footnote)

- **Payout column**: Sourced from `monthly_payouts` table (the output of finalized payout runs)
- **Software %**: YTD deal `new_software_booking_arr_usd` vs `performance_targets` for "New Software Booking ARR"
- **Closing ARR %**: Latest month eligible ARR from `closing_arr_actuals` vs target
- **Att. %**: Weighted overall attainment across all metrics

### Files Modified
- `src/hooks/useExecutiveDashboard.ts` -- fix ID bridging, add per-metric attainment, fetch closing ARR actuals
- `src/components/executive/TopPerformers.tsx` -- add Software % and Closing ARR % columns, add data source footnote

### No Database Changes Required
