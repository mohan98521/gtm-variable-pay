

## Fix: Total Variable OTE showing as 0

### Root Cause

In `src/hooks/usePayoutMetricDetails.ts` (line 88), `targetBonusUsd` is populated from the first `payout_metric_details` row encountered for each employee:

```typescript
targetBonusUsd: row.target_bonus_usd || 0,
```

The query orders by `component_type`, so `commission` rows (alphabetically first) are processed before `variable_pay` rows. Commission rows store `target_bonus_usd = 0` by design, so the employee's Total Variable OTE is set to 0 and never corrected.

Database evidence confirms this: all commission rows have `target_bonus_usd: 0`, while `variable_pay` and `nrr` rows carry the correct value (e.g., 89734, 80000, etc.).

### Fix

**File: `src/hooks/usePayoutMetricDetails.ts`**

After the grouping loop completes, iterate over each employee's `allDetails` and set `targetBonusUsd` to the maximum `target_bonus_usd` found across all their rows. This ensures the correct value is always used regardless of row ordering.

```typescript
// Replace line 88:
targetBonusUsd: row.target_bonus_usd || 0,
// With:
targetBonusUsd: 0,  // Will be computed after all rows are processed

// After the grouping for-loop (after line 117), add:
for (const entry of grouped.values()) {
  entry.targetBonusUsd = Math.max(
    ...entry.allDetails.map(d => d.target_bonus_usd || 0)
  );
}
```

This is a one-line logic fix plus a 3-line post-processing step. No other files need changes -- the Summary view, Detail view, and XLSX export all read from `emp.targetBonusUsd`, so they will automatically display the correct value.
