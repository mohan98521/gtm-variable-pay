

## Narrow Global Quota Attainment to New Software Booking ARR Only

### What Changes

The "Global Quota Attainment" metric and the "Attainment Distribution" histogram currently aggregate **all** metric types (Software ARR + Closing ARR + CR/ER + Implementation + Managed Services). This will be narrowed to use **only New Software Booking ARR** targets and actuals.

Additionally, applying the three pending card fixes from the prior discussion:
1. Remove duplicate "X% of Budget" from the first card
2. Show employee ratio on the fourth card
3. Clarify attainment subtext

### Technical Changes

**File: `src/hooks/useExecutiveDashboard.ts`**

- Replace the attainment calculation (lines 227-240) to use `empSoftwareTargetMap` and `empSoftwareActualMap` instead of `empTotalTargetMap` and `empTotalActualMap`
- This means attainment is: (YTD New Software Booking ARR deals) / (New Software Booking ARR target) per employee
- The attainment distribution histogram will also reflect Software ARR only
- Add `repsWithTargets` and `totalActiveEmployees` to the interface

**File: `src/components/executive/NorthStarCards.tsx`**

- Card 1: Remove "X% of Budget" subtext, replace with "From finalized payout runs"
- Card 2: Update label to "Software ARR Attainment" and subtext to "Weighted across {N} reps with Software ARR targets"
- Card 4: Change label to "Eligible Employees", display as "{eligible} of {total}" format

### Files Modified
- `src/hooks/useExecutiveDashboard.ts` -- narrow attainment to Software ARR, add `repsWithTargets` and `totalActiveEmployees`
- `src/components/executive/NorthStarCards.tsx` -- update card labels, subtexts, and employee ratio display
