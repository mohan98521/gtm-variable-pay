

# Plan: Fix Remaining "invalid input syntax for type date" Issues

## Problem

Two remaining queries pass incomplete date strings to `month_year` columns (which are PostgreSQL `date` type):

1. **Payout Engine YTD deals query** -- will crash during payout calculation
2. **Exchange rate by-month hook** -- latent bug if ever called with `YYYY-MM` format

## Fixes

### File 1: `src/lib/payoutEngine.ts` (line 301)

| Current | Fixed |
|---------|-------|
| `.gte('month_year', \`${ctx.fiscalYear}-01\`)` | `.gte('month_year', \`${ctx.fiscalYear}-01-01\`)` |

This is in `calculateEmployeeVariablePay` and will fail when running a payout calculation for any month.

### File 2: `src/hooks/useExchangeRates.ts` (line 79)

| Current | Fixed |
|---------|-------|
| `.eq("month_year", monthYear)` | `.eq("month_year", monthYear.length === 7 ? monthYear + "-01" : monthYear)` |

Defensive fix in `useExchangeRateByMonth` so it works regardless of whether callers pass `YYYY-MM` or `YYYY-MM-DD`.

## Scope

2 files, 2 line changes. No database or UI changes.

