

# Plan: Fix Zero Employees in Payout Calculation

## Root Cause

When "Calculate" is clicked, the `month_year` value from the database is already a full date (`"2026-01-01"`). But many places in `payoutEngine.ts` blindly append `"-01"`, producing the invalid date string `"2026-01-01-01"`. This causes all database queries to silently return no results, so every employee is skipped.

## Solution

Add a helper function at the top of `payoutEngine.ts` to normalize date strings, then use it everywhere.

### Helper Function

```typescript
function ensureFullDate(monthYear: string): string {
  return monthYear.length === 7 ? monthYear + '-01' : monthYear;
}
```

### Changes in `src/lib/payoutEngine.ts`

| Line | Current | Fixed |
|------|---------|-------|
| 187 | `.lte('effective_start_date', \`${monthYear}-01\`)` | `.lte('effective_start_date', ensureFullDate(monthYear))` |
| 188 | `.gte('effective_end_date', \`${monthYear}-01\`)` | `.gte('effective_end_date', ensureFullDate(monthYear))` |
| 223 | `.eq('month_year', monthYear + '-01')` | `.eq('month_year', ensureFullDate(monthYear))` |
| 302 (already OK) | `.lte('month_year', ctx.monthYear)` | No change needed (raw value works for comparison) |
| 323 | `\`${ctx.monthYear}-01\`` | `ensureFullDate(ctx.monthYear)` |
| 501 | `.lte('effective_start_date', \`${monthYear}-01\`)` | `.lte('effective_start_date', ensureFullDate(monthYear))` |
| 502 | `.gte('effective_end_date', \`${monthYear}-01\`)` | `.gte('effective_end_date', ensureFullDate(monthYear))` |
| 865 | `calculation_month: \`${monthYear}-01\`` | `calculation_month: ensureFullDate(monthYear)` |

## Scope

1 file (`src/lib/payoutEngine.ts`), ~9 line changes. No database migrations. No UI changes.

## Technical Details

- The `ensureFullDate` helper checks string length: if 7 chars (`YYYY-MM`), appends `"-01"`; otherwise returns as-is
- This is a defensive pattern already used on lines 124 and 168 of the same file
- After this fix, the `user_targets` query will correctly match employees' plan assignments, and calculations will produce actual results

