

## Rename "NRR Additional Pay" to "(CR/ER + Implementation)" Across the System

### Approach

The string `"NRR Additional Pay"` is used in two ways:
1. **Database value** -- stored as `payout_type` in `monthly_payouts` and referenced in queries (payout engine, FnF engine, dashboard data hook). Changing this would break existing data.
2. **Display label** -- shown in UI cards, simulator, metric columns, toasts, and comments.

**Strategy**: Introduce a constant for the display label `"(CR/ER + Implementation)"` and use it everywhere the label is shown to users. Keep the database `payout_type` value as `"NRR Additional Pay"` to avoid breaking existing records and queries.

### Files to Change

| # | File | What Changes |
|---|------|-------------|
| 1 | `src/lib/payoutTypes.ts` | Add a display-name constant: `export const NRR_DISPLAY_NAME = '(CR/ER + Implementation)';` |
| 2 | `src/components/dashboard/NRRSummaryCard.tsx` | Card title: "NRR Additional Pay" -> "(CR/ER + Implementation)" |
| 3 | `src/components/dashboard/PayoutSimulator.tsx` | Metric name and label: "NRR Additional Pay" -> display constant |
| 4 | `src/components/admin/NrrSettingsCard.tsx` | Card title, empty state heading, toast messages, dialog descriptions (~8 occurrences) |
| 5 | `src/pages/PlanBuilder.tsx` | Comment only (line 540) |
| 6 | `src/pages/Dashboard.tsx` | Comment only (line 291) |
| 7 | `src/hooks/useDashboardPayoutRunData.ts` | `allMetricNames.add(...)` and `METRIC_PRIORITY` key -- both use display label for the monthly table column header |
| 8 | `src/lib/nrrCalculation.ts` | JSDoc comment only |
| 9 | `src/lib/__tests__/nrrCalculation.test.ts` | Test describe block label |

### What Stays Unchanged (database-facing values)

These lines use `'NRR Additional Pay'` as a database `payout_type` value and must NOT change:
- `src/lib/payoutEngine.ts` -- `payout_type: 'NRR Additional Pay'` (line 2128), `metricName: 'NRR Additional Pay'` (line 1499), prior-month lookup (line 1287)
- `src/lib/fnfEngine.ts` -- `sumPriorPayouts(..., 'NRR Additional Pay')` (line 248), `payout_type: 'NRR Additional Pay'` (line 322)
- `src/lib/payoutTypes.ts` -- the `ADDITIONAL_PAY_TYPES` array stays as-is since it's used for data filtering

### Summary

- Pure UI/label rename across ~9 files
- No database migration needed
- No payout engine logic changes
- Existing payout data remains valid
