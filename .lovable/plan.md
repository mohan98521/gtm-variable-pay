
## Update Test Case 3.2: Sales Head Hunter (Now Stepped_Accelerator)

### What Changed in the Database

The Sales Head Hunter plan was updated from `Linear` to `Stepped_Accelerator` logic. The multiplier grid remains the same:

| Tier | Range | Multiplier |
|------|-------|-----------|
| 1 | 0-100% | 1.0x |
| 2 | 100-120% | 1.6x |
| 3 | 120-999% | 2.0x |

### Impact on Calculations

**Old behavior (Linear):** A single multiplier from the matching tier is applied to the entire achievement.
- 115% achievement: $25,000 x 1.15 x 1.6 = $46,000
- 120% achievement: $25,000 x 1.20 x 2.0 = $60,000

**New behavior (Stepped_Accelerator / Marginal):** Each tier's multiplier applies only to the achievement slice within that range.

### Updated Test Case 3.2: SH Hunter 115%

```text
Tier 1: 0-100% at 1.0x = $25,000 x (100/100) x 1.0 = $25,000
Tier 2: 100-115% at 1.6x = $25,000 x (15/100) x 1.6 =  $6,000
Total VP = $31,000
```

### Updated Test Case 3.2b: SH Hunter 120%

```text
Tier 1: 0-100% at 1.0x = $25,000 x (100/100) x 1.0 = $25,000
Tier 2: 100-120% at 1.6x = $25,000 x (20/100) x 1.6 =  $8,000
Total VP = $33,000
```

### Changes

**File: `src/lib/__tests__/compensationEngine.test.ts`** (lines 120-142)

1. Update test 3.2 to use `Stepped_Accelerator` logic type with `calculateMarginalPayout` instead of `calculateMetricPayoutFromPlan` with Linear, and expect **$31,000**
2. Update test 3.2b to use `Stepped_Accelerator` logic type with `calculateMarginalPayout`, and expect **$33,000**
3. Update test descriptions to reflect the new plan type
