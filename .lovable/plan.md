

## Blended Pro-Rata Target Bonus for Mid-Year Compensation Changes

### Problem

Currently, the payout engine uses the **active assignment's** `target_bonus_usd` directly for each month. For mid-year changes, this means:
- Jan-May: uses $20,000 (Assignment A's annual target)
- Jun-Dec: uses $24,000 (Assignment B's annual target)

The user's requirement is different: after a mid-year change, the engine should compute a **blended pro-rata annual target** based on the number of days each assignment covers in the calendar year, and use that blended figure from the change date onward.

### Required Logic

Given two assignments in a year:
- Assignment A: $20,000 target, Jan 1 - May 31 (151 days)
- Assignment B: $24,000 target, Jun 1 - Dec 31 (214 days)

```text
Blended Target = (20000 x 151/365) + (24000 x 214/365)
               = 8,274 + 14,071
               = 22,345 (approx)
```

- **Before the change (Jan-May)**: Use $20,000 (original annual target, unchanged)
- **After the change (Jun-Dec)**: Use $22,345 (blended pro-rata target)

This ensures that the YTD VP calculation after a mid-year hike reflects the weighted combination of both assignment periods.

### Changes

#### 1. `src/lib/payoutEngine.ts` -- Add blended target bonus calculation

In `calculateMonthlyPayout()`, after fetching the active `user_targets` assignment (line 968-978):

- **Fetch ALL assignments** for this employee in the fiscal year (not just the active one)
- If there is only one assignment, use its `target_bonus_usd` as-is (no change to current behavior)
- If there are multiple assignments:
  - For each assignment, compute `days = daysInPeriod(max(startDate, Jan1) to min(endDate, Dec31))`
  - Compute `blendedTarget = sum(assignment.target_bonus_usd x days / 365)` across all assignments
  - Determine if the current month falls within the **first** assignment or a later one
  - If current month is in the first assignment: use that assignment's original `target_bonus_usd`
  - If current month is in a subsequent assignment: use the `blendedTarget`

This will be implemented as a new helper function `calculateBlendedTargetBonus()`.

#### 2. `src/lib/compensation.ts` -- Add blended pro-rata utility

Add a new exported function `calculateBlendedProRata()` that:
- Takes an array of `{ targetBonusUsd, startDate, endDate }` segments
- Takes the current month being calculated
- Returns the appropriate target bonus to use (original or blended)
- Uses actual calendar days for precision (not months/12)

This utility can also be reused by the Dashboard and Payout Statement views.

#### 3. `src/hooks/useCurrentUserCompensation.ts` -- Use blended target in dashboard

Update the dashboard calculation hook to use the same blended logic when computing live VP estimates, so the Dashboard preview matches finalized payout run results.

#### 4. `src/hooks/useDashboardPayoutSummary.ts` -- Show blended target in segments

Update the `AssignmentSegment` interface to include a `blendedTargetBonusUsd` field so the Dashboard can display both the original assignment target and the effective blended target.

#### 5. `src/components/reports/PayoutStatement.tsx` -- Show blended target

When displaying the target bonus in the statement header, show the blended pro-rata target when applicable (with a note explaining it is blended).

### Technical Details

**New helper function** in `src/lib/compensation.ts`:

```text
calculateBlendedProRata(segments, currentMonth, fiscalYear)
  -> For each segment, clamp dates to fiscal year boundaries
  -> Compute days per segment
  -> blended = sum(target x days / totalDaysInYear)
  -> If currentMonth is in first segment: return segment's original target
  -> Else: return blended target
```

**Files to modify**:

| File | Change |
|------|--------|
| `src/lib/compensation.ts` | Add `calculateBlendedProRata()` utility function |
| `src/lib/payoutEngine.ts` | Fetch all assignments in fiscal year, compute blended target, use it for VP calculation |
| `src/hooks/useCurrentUserCompensation.ts` | Apply blended logic for live dashboard estimates |
| `src/hooks/useDashboardPayoutSummary.ts` | Add `blendedTargetBonusUsd` to `AssignmentSegment` |
| `src/components/reports/PayoutStatement.tsx` | Display blended target when applicable |

**No database changes required** -- all data already exists in `user_targets`.
