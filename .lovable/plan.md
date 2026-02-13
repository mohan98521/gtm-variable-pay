

## Marginal Stepped Accelerator Model

### What Changes

Currently, the Stepped Accelerator applies a **single multiplier to the entire achievement**. For example, at 110% achievement with a 1.4x tier, the payout is `$50k x 110% x 1.4 = $77,000`.

The new model applies each tier's multiplier **only to the portion of achievement within that tier** (marginal/incremental approach):

```text
Tier 1 (0-100%):   $50k x 100% x 1.0 = $50,000
Tier 2 (100-120%): $50k x  10% x 1.4 =  $7,000
                                Total = $57,000
```

### How It Works (Your Example)

Target: $1,000k | Bonus: $50k | Achievement: 110%

```text
+-------------------+-------------------+-------------------+-------------------+
| Tier              | Achievement Slice | Multiplier        | Payout            |
+-------------------+-------------------+-------------------+-------------------+
| 0-100%            | 100%              | 1.0x              | $50k x 100% x 1.0 = $50,000 |
| 100-120%          | 10% (of 20 range) | 1.4x              | $50k x 10% x 1.4  = $7,000  |
| 120-999%          | 0% (not reached)  | 1.6x              | $0                 |
+-------------------+-------------------+-------------------+-------------------+
| TOTAL             |                   |                   | $57,000            |
+-------------------+-------------------+-------------------+-------------------+
```

More examples with the same plan:

- **80% Achievement**: Tier 1 only: `$50k x 80% x 1.0 = $40,000`
- **120% Achievement**: Tier 1: `$50k x 100% x 1.0 = $50,000` + Tier 2: `$50k x 20% x 1.4 = $14,000` = **$64,000**
- **150% Achievement**: Tier 1: `$50,000` + Tier 2: `$50k x 20% x 1.4 = $14,000` + Tier 3: `$50k x 30% x 1.6 = $24,000` = **$88,000**

### Impact on Other Logic Types

- **Linear**: No change (already uses 1.0x flat or no grid).
- **Gated Threshold**: No change (gate check happens first, then the same marginal calculation applies to tiers above the gate).

### Technical Details

**File: `src/lib/compensationEngine.ts`**

1. Add a new function `calculateMarginalPayout` that iterates through sorted tiers, computing the achievement slice within each tier and multiplying by that tier's multiplier, then summing the results.

2. Update `calculateMetricPayoutFromPlan` so that for `Stepped_Accelerator` logic, it calls `calculateMarginalPayout` instead of the current `(achievement% / 100) x bonusAllocation x singleMultiplier` formula.

3. Update `generatePayoutProjections` to use the same marginal calculation for Stepped Accelerator metrics.

4. The `getMultiplierFromGrid` function is kept for backward compatibility (used by other files for display/lookup purposes), but the payout formula itself changes.

**Files consuming `compensationEngine.ts` (no formula changes needed, they call the updated functions):**
- `src/hooks/useCurrentUserCompensation.ts` - Uses `getMultiplierFromGrid` for display; payout uses the engine
- `src/hooks/useTeamCompensation.ts` - Same pattern
- `src/hooks/useIncentiveAuditData.ts` - Calls `calculateVariablePayFromPlan`
- `src/lib/dealVariablePayAttribution.ts` - Uses `getMultiplierFromGrid` and `calculateAchievementPercent`
- `src/components/dashboard/PayoutSimulator.tsx` - Uses `getMultiplierFromGrid` for simulation display

**Files that need review for direct payout formulas:**
- `src/lib/payoutEngine.ts` - The main payout run engine; need to verify if it uses its own VP formula or delegates to compensationEngine
- `src/lib/dealVariablePayAttribution.ts` - May have its own payout calculation that needs the same marginal logic

**MetricPayoutResult update:**
- The `multiplier` field will become a **weighted average multiplier** (total payout / (achievement% x bonusAllocation)) for display purposes, since there's no longer a single multiplier value.

