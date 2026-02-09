

# Plan: Fix Remaining Payout Run Date Format Issues

## Root Cause

The error you saw was likely from before the latest fixes were deployed. The exchange rate data and query are now correct. However, I found two related bugs that should be fixed:

## Bug 1: Validation query lacks defensive date formatting (line 168)

Line 168 of `payoutEngine.ts` always appends `-01` without checking the input length. If `monthYear` is ever passed as `"2026-01-01"`, it would produce the invalid date `"2026-01-01-01"`.

**Fix**: Use the same defensive pattern as line 124:
```
.eq('month_year', monthYear.length === 7 ? monthYear + '-01' : monthYear)
```

## Bug 2: Available months not filtering correctly (line 114)

In `PayoutRunManagement.tsx`, the `existingMonths` Set contains full dates from the database (e.g., `"2026-01-01"`), but `monthOptions` values are `"2026-01"`. So `existingMonths.has("2026-01")` is always `false`, meaning months with existing payout runs still show as available in the Create dialog.

**Fix**: Normalize the database values when building the Set:
```
const existingMonths = new Set(
  payoutRuns?.map(r => r.month_year?.substring(0, 7)) || []
);
```

## Files Changed

| File | Change |
|------|--------|
| `src/lib/payoutEngine.ts` (line 168) | Add defensive date length check |
| `src/components/admin/PayoutRunManagement.tsx` (line 114) | Normalize `month_year` to `YYYY-MM` for comparison |

2 files, 2 line changes. No database or UI changes.
