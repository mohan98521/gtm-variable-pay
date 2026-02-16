

## Monthly Performance Table: Two Fixes

### Issue 1: NRR and SPIFF Show Payout Values Instead of Deal Values

**Current (line 751)**: For NRR and SPIFF component types, the monthly pivot uses `detail.this_month_usd` -- which is the incremental payout amount (e.g., $2.2K for NRR). This is inconsistent with the other columns which show raw deal values.

**Fix in `src/hooks/useDashboardPayoutRunData.ts` (lines 740-753)**:
- For NRR: replace `this_month_usd` with the incremental actual value. Since `actual_usd` in `payout_metric_details` is YTD cumulative, compute the monthly incremental by tracking the prior month's cumulative for each metric. This shows the underlying CR/ER + Implementation actuals driving the NRR calculation, not the payout.
- For SPIFF: similarly use the incremental actual (eligible deal values above threshold) rather than the payout amount.
- Sort the NRR/SPIFF detail records by run month before processing so incremental calculation is accurate.

### Issue 2: Column Sort Order

**Current (line 784)**: `metricNames` is sorted alphabetically, resulting in: Closing ARR, Large Deal SPIFF, Managed Services, NRR Additional Pay, New Software Booking ARR, Perpetual License...

**Desired order**: New Software Booking ARR, Closing ARR, NRR Additional Pay, Large Deal SPIFF, then commission metrics (Managed Services, Perpetual License, etc.)

**Fix in `src/hooks/useDashboardPayoutRunData.ts` (line 784)**:
- Replace `.sort()` with a custom sort function that uses a priority map:
  1. New Software Booking ARR
  2. Closing ARR
  3. NRR Additional Pay
  4. Large Deal SPIFF
  5. All remaining metrics alphabetically (Managed Services, Perpetual License, CR/ER, Implementation, etc.)

### Technical Summary

| File | Changes |
|------|---------|
| `src/hooks/useDashboardPayoutRunData.ts` | (1) Lines 740-753: Replace `this_month_usd` with incremental `actual_usd` for NRR/SPIFF monthly pivot. (2) Line 784: Custom sort order for metricNames with priority-based ordering. |

