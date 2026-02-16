
## Fix: Marginal Stepped Multiplier in Payout Simulator

### Problem

The Payout Simulator on line 150 of `PayoutSimulator.tsx` uses a flat multiplier model:

```
payout = (achievementPct / 100) * allocation * multiplier
```

This applies a single tier's multiplier to the entire achievement. For example, at 106.3% achievement with a 1.2x tier, it calculates `1.063 * allocation * 1.2` -- applying 1.2x to the full amount.

The correct marginal model (already implemented in `calculateMarginalPayout` in `compensationEngine.ts`) should apply each tier incrementally:
- Tier 1 (0-100%): 100% slice at 1.0x
- Tier 2 (100-120%): 6.3% slice at 1.2x (or whatever the tier multiplier is)

### Fix

**File: `src/components/dashboard/PayoutSimulator.tsx`**

1. Import `calculateMarginalPayout` from `compensationEngine.ts` (alongside the existing `getMultiplierFromGrid` import)
2. Replace the payout calculation block (lines 126-150) to use the same branching logic as `calculateMetricPayoutFromPlan`:
   - If logic type is `Stepped_Accelerator` or `Gated_Threshold` with grids: use `calculateMarginalPayout` to get both the payout and the weighted display multiplier
   - Otherwise (Linear): keep the existing flat multiplier approach
3. The `fakeMetric` construction (lines 129-141) is already correct and can be reused as the input to `calculateMarginalPayout`

### Impact

This ensures the simulator matches the actual payout engine calculations. The displayed multiplier will also become the "weighted average" multiplier (e.g., showing ~1.03x for 106% achievement instead of the flat 1.2x), which is more accurate for the marginal model.
