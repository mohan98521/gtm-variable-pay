
# Fix Month Filter for My Deals and My Closing ARR Reports

## Problem Identified

The month filter in `useMyActualsData.ts` uses an invalid date format for months with fewer than 31 days.

**Current Code (Lines 138-140):**
```typescript
if (selectedMonth) {
  query = query.gte("month_year", `${selectedMonth}-01`).lte("month_year", `${selectedMonth}-31`);
}
```

When `selectedMonth` is `2026-02`, this generates:
- `gte("month_year", "2026-02-01")` - Valid
- `lte("month_year", "2026-02-31")` - **Invalid date** (February has 28/29 days)

The database query fails silently, returning no results for months like February, April, June, September, and November.

---

## Solution

Use proper date arithmetic to calculate the last day of the selected month instead of hardcoding `-31`.

**Correct Approach:**
```typescript
if (selectedMonth) {
  // selectedMonth is "YYYY-MM" format
  const [year, month] = selectedMonth.split("-").map(Number);
  
  // First day of the month
  const startDate = `${selectedMonth}-01`;
  
  // Last day of the month - use Date object to calculate correctly
  const lastDay = new Date(year, month, 0).getDate(); // month is 1-indexed, but Date uses 0-indexed, so this gives last day
  const endDate = `${selectedMonth}-${lastDay.toString().padStart(2, "0")}`;
  
  query = query.gte("month_year", startDate).lte("month_year", endDate);
}
```

This correctly handles:
- February (28 or 29 days depending on leap year)
- April, June, September, November (30 days)
- All other months (31 days)

---

## Files to Update

### File 1: `src/hooks/useMyActualsData.ts`

**Changes in `useMyDeals` function (lines 137-140):**
Replace the hardcoded `-31` with proper last-day-of-month calculation.

**Changes in `useMyClosingARR` function (lines 203-206):**
Apply the same fix to the Closing ARR month filtering.

---

## Implementation Details

Create a helper function to calculate the last day of a month:

```typescript
/**
 * Get the last day of a month given YYYY-MM format
 */
function getMonthEndDate(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  // new Date(year, month, 0) gives the last day of the previous month
  // Since month is 1-indexed in our format but 0-indexed in JS Date,
  // passing month directly gives us the last day of that month
  const lastDay = new Date(year, month, 0).getDate();
  return `${yearMonth}-${lastDay.toString().padStart(2, "0")}`;
}
```

Then update both filter blocks:

```typescript
// In useMyDeals (around line 138)
if (selectedMonth) {
  const startDate = `${selectedMonth}-01`;
  const endDate = getMonthEndDate(selectedMonth);
  query = query.gte("month_year", startDate).lte("month_year", endDate);
}

// In useMyClosingARR (around line 204)
if (selectedMonth) {
  const startDate = `${selectedMonth}-01`;
  const endDate = getMonthEndDate(selectedMonth);
  query = query.gte("month_year", startDate).lte("month_year", endDate);
}
```

---

## Summary

| File | Change |
|------|--------|
| `src/hooks/useMyActualsData.ts` | Add `getMonthEndDate` helper function and fix month filter in both `useMyDeals` and `useMyClosingARR` hooks |

## Expected Outcome

After this fix:
- February 2026 deals will display correctly (using `2026-02-28` as end date)
- All months will filter correctly regardless of their actual number of days
- No more invalid date errors from the database
