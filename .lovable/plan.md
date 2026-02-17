

## Fix: Multiplier Boundary Bug in payoutEngine.ts

### Problem
The `findMultiplier` function (line 737-744) iterates through multiplier tiers in their default (ascending) order. When a renewal period sits on a boundary (e.g., 2 years matching both a "1-2 years" tier at 1.0x and a "2-3 years" tier at 1.1x), the first match wins -- which is the lower, less specific tier.

### Solution
Sort `multiplierTiers` in descending order by `min_years` before iterating, so the highest (most specific) tier is checked first. This matches the pattern already used by `findRenewalMultiplier` in `useClosingArrRenewalMultipliers.ts`.

### Technical Details

**File: `src/lib/payoutEngine.ts` (lines 737-744)**

Replace:
```typescript
const findMultiplier = (years: number): number => {
  for (const m of multiplierTiers) {
    if (years >= m.min_years && (m.max_years === null || years <= m.max_years)) {
      return m.multiplier_value;
    }
  }
  return 1.0;
};
```

With:
```typescript
const findMultiplier = (years: number): number => {
  const sorted = [...multiplierTiers].sort((a: any, b: any) => b.min_years - a.min_years);
  for (const m of sorted) {
    if (years >= m.min_years && (m.max_years === null || years <= m.max_years)) {
      return m.multiplier_value;
    }
  }
  return 1.0;
};
```

One line added, no other files affected. After this fix, a 2-year renewal will correctly match the 2-3 tier (1.1x) instead of the 1-2 tier (1.0x).
