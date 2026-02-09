

# Plan: Fix Exchange Rate Date Format Mismatch

## Problem

The `exchange_rates.month_year` column is a `date` type (stores `2026-01-01`), but the payout engine queries it with `'2026-01'` (no day component). PostgreSQL returns no match, causing valid exchange rates to be reported as missing.

## Fix (2 lines in 1 file)

**File: `src/lib/payoutEngine.ts`**

| Line | Current Code | Fixed Code |
|------|-------------|------------|
| 168 | `.eq('month_year', monthYear)` | `.eq('month_year', monthYear + '-01')` |
| 224 | `.eq('month_year', monthYear)` | `.eq('month_year', monthYear + '-01')` |

- **Line 168**: Inside `validatePayoutRunPrerequisites` -- the validation check that flags missing market rates
- **Line 224**: Inside `getMarketExchangeRate` -- the helper used during actual payout calculation

No other files or database changes needed. MYR will still correctly show as missing since no rate exists for it.

