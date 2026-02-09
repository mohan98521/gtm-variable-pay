

# Plan: Fix "invalid input syntax for type date" Error on Create Payout Run

## Problem

When clicking "Create Run", the code inserts `month_year: "2026-01"` into the `payout_runs` table, but the column is a `date` type requiring `"2026-01-01"`. This is the same date format bug we fixed earlier in the exchange rate queries, but it also exists in the payout run code.

## Fix

**File: `src/hooks/usePayoutRuns.ts`**

Two changes in the `useCreatePayoutRun` mutation:

| Line | Current | Fixed |
|------|---------|-------|
| 120 | `.eq("month_year", monthYear)` | `.eq("month_year", monthYear + "-01")` |
| 130 | `month_year: monthYear` | `month_year: monthYear + "-01"` |

Additionally, the year-based filter in `usePayoutRuns` (line 58-59) also uses incomplete dates:

| Line | Current | Fixed |
|------|---------|-------|
| 58 | `.gte("month_year", \`${year}-01\`)` | `.gte("month_year", \`${year}-01-01\`)` |
| 59 | `.lte("month_year", \`${year}-12\`)` | `.lte("month_year", \`${year}-12-01\`)` |

**File: `src/lib/payoutEngine.ts`** (line 124)

The validation function also queries `payout_runs` with an unformatted month:

| Line | Current | Fixed |
|------|---------|-------|
| 124 | `.eq('month_year', monthYear)` | `.eq('month_year', monthYear + '-01')` |

**File: `src/hooks/useMonthLockStatus.ts`** (line 31)

| Line | Current | Fixed |
|------|---------|-------|
| 31 | `.eq("month_year", monthYear)` | `.eq("month_year", monthYear.length === 7 ? monthYear + "-01" : monthYear)` |

**File: `src/hooks/usePayoutStatement.ts`** (lines 204, 229)

Same fix for exchange rate and payout run lookups used in the statement view.

## Scope

5 files, ~8 line changes. No database migrations. No UI changes.
