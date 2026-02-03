# Deal-Level Variable Pay Attribution: Pro-Rata Allocation

## ✅ IMPLEMENTATION STATUS: COMPLETE

### Completed Components:
1. ✅ Database migration: `deal_variable_pay_attribution` table created with RLS policies
2. ✅ Calculation logic: `src/lib/dealVariablePayAttribution.ts`
3. ✅ Data hook: `src/hooks/useDealVariablePayAttribution.ts`
4. ✅ Hook integration: `src/hooks/useMyDealsWithIncentives.ts` updated
5. ✅ UI display: `src/components/reports/MyDealsReport.tsx` updated with VP columns

---

## Approach Summary

You've proposed a cleaner **Pro-Rata Allocation** method that:
1. Calculates total Variable Pay at the aggregate level (using achievement × multiplier × bonus allocation)
2. Distributes that total to individual deals **proportionally** based on each deal's ARR contribution

```text
Deal Variable Pay = Total Variable Pay × (Deal ARR / Total ARR)
```

This approach:
- Always sums to exactly 100% of the total payout
- Is intuitive and easy to explain
- Updates dynamically every month as new deals/actuals are added
- Provides the exact clawback amount if a deal goes uncollected

---

## Calculation Logic

### Step 1: Calculate Aggregate Variable Pay (Existing Logic)

Using the current compensation engine:

```text
Total Actual ARR = Sum of all YTD deals for this metric
Achievement % = (Total Actual ARR / Target) × 100
Multiplier = Lookup from multiplier_grids based on achievement %
Total Variable Pay = (Achievement % / 100) × Bonus Allocation × Multiplier
```

### Step 2: Allocate to Individual Deals (New Logic)

For each deal:

```text
Deal Proportion = Deal ARR / Total Actual ARR
Deal Variable Pay = Total Variable Pay × Deal Proportion
```

### Example from Your Image

| Deal | Actual ARR | Proportion | Variable Pay Split |
|------|------------|------------|-------------------|
| Deal A | $200,000 | 27.78% | $23,333 |
| Deal B | $300,000 | 41.67% | $35,000 |
| Deal C | $220,000 | 30.56% | $25,667 |
| **Total** | **$720,000** | **100.00%** | **$84,000** |

---

## Data Flow

```text
Monthly Calculation Trigger (on data input or manual recalc):

┌─────────────────────────────────────────────────────────────────┐
│ For each employee with Variable Pay plan:                       │
│                                                                 │
│ 1. Fetch YTD deals where employee is a participant              │
│ 2. Sum total_actual_arr = Σ deal.new_software_booking_arr_usd   │
│ 3. Get employee's target for metric                             │
│ 4. Calculate achievement % = total_actual / target × 100        │
│ 5. Lookup multiplier from plan's multiplier_grid                │
│ 6. Calculate total_variable_pay using compensation engine       │
│                                                                 │
│ 7. For EACH deal:                                               │
│    - proportion = deal_arr / total_actual_arr                   │
│    - deal_variable_pay = total_variable_pay × proportion        │
│    - Apply payout split (booking/collection/year-end)           │
│    - Store/update in deal_variable_pay_attribution table        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Table: `deal_variable_pay_attribution`

```sql
CREATE TABLE deal_variable_pay_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  plan_id UUID REFERENCES comp_plans(id),
  fiscal_year INTEGER NOT NULL,
  calculation_month DATE NOT NULL,      -- Month this was calculated for (latest YTD)
  
  -- Metric context
  metric_name TEXT NOT NULL,            -- 'New Software Booking ARR' or 'Closing ARR'
  deal_value_usd NUMERIC NOT NULL,      -- This deal's contribution (ARR value)
  
  -- Aggregate context at calculation time
  total_actual_usd NUMERIC NOT NULL,    -- Sum of all YTD deals
  target_usd NUMERIC NOT NULL,          -- Employee's annual target
  achievement_pct NUMERIC NOT NULL,     -- Overall achievement percentage
  multiplier NUMERIC NOT NULL,          -- Multiplier applied at this achievement
  total_variable_pay_usd NUMERIC NOT NULL, -- Total payout for this metric
  
  -- Pro-rata allocation
  proportion_pct NUMERIC NOT NULL,      -- deal_value / total_actual × 100
  variable_pay_split_usd NUMERIC NOT NULL, -- This deal's share of variable pay
  
  -- Payout split (from plan_metrics config)
  payout_on_booking_usd NUMERIC NOT NULL,
  payout_on_collection_usd NUMERIC NOT NULL,
  payout_on_year_end_usd NUMERIC NOT NULL,
  
  -- Clawback tracking
  clawback_eligible_usd NUMERIC NOT NULL, -- Amount subject to clawback
  is_clawback_triggered BOOLEAN DEFAULT FALSE,
  clawback_amount_usd NUMERIC DEFAULT 0,
  clawback_date DATE,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(deal_id, employee_id, metric_name, fiscal_year)
);

-- Index for efficient lookups
CREATE INDEX idx_deal_vp_attribution_employee 
  ON deal_variable_pay_attribution(employee_id, fiscal_year);
CREATE INDEX idx_deal_vp_attribution_deal 
  ON deal_variable_pay_attribution(deal_id);
```

---

## Implementation Components

### 1. New Calculation Function: `calculateDealVariablePayAttribution`

**File:** `src/lib/dealVariablePayAttribution.ts`

```typescript
interface DealVariablePayAttribution {
  dealId: string;
  employeeId: string;
  metricName: string;
  dealValueUsd: number;
  proportionPct: number;           // e.g., 27.78
  variablePaySplitUsd: number;     // e.g., $23,333
  payoutOnBookingUsd: number;
  payoutOnCollectionUsd: number;
  payoutOnYearEndUsd: number;
  clawbackEligibleUsd: number;
}

interface AggregateContext {
  totalActualUsd: number;
  targetUsd: number;
  achievementPct: number;
  multiplier: number;
  totalVariablePayUsd: number;
}

function calculateDealVariablePayAttributions(
  deals: Deal[],
  metric: PlanMetric,
  targetUsd: number,
  bonusAllocationUsd: number
): { attributions: DealVariablePayAttribution[]; context: AggregateContext }
```

**Logic:**
1. Sum all deals' metric value (e.g., `new_software_booking_arr_usd`)
2. Calculate achievement % and lookup multiplier using existing `getMultiplierFromGrid`
3. Calculate total variable pay using existing formula
4. For each deal:
   - Calculate proportion = deal_value / total_value
   - Calculate variable_pay_split = total_variable_pay × proportion
   - Apply payout split percentages from plan_metric

### 2. New Hook: `useDealVariablePayAttribution`

**File:** `src/hooks/useDealVariablePayAttribution.ts`

Fetches stored attributions OR calculates on-demand:
- For current month: calculate fresh (real-time accuracy)
- Historical lookups: query stored table

### 3. Update My Deals Report

**File:** `src/components/reports/MyDealsReport.tsx`

Add new columns:
- **Proportion %**: Deal's share of total ARR
- **Variable Pay Split**: Pro-rata share of variable pay
- **VP Paid (Booking)**: Immediate payout portion
- **VP Held (Collection)**: Held until collection
- **VP Held (Year-End)**: Year-end reserve
- **Clawback Eligible**: Amount at risk if uncollected

### 4. Update Hook to Include Variable Pay

**File:** `src/hooks/useMyDealsWithIncentives.ts`

Enhance to calculate both:
- Commission incentives (existing) - for Managed Services, Perpetual, CR/ER, Implementation
- Variable Pay attribution (new) - for New Software Booking ARR metric

---

## Monthly Recalculation Logic

Every time deals or targets are updated:

1. **Trigger**: New deal added, deal value modified, or monthly recalc
2. **Scope**: All deals YTD for the affected employee(s)
3. **Recalculate**: New proportions based on updated total
4. **Persist**: Upsert to `deal_variable_pay_attribution` table

```text
Example: Month 1 has 2 deals totaling $400K, Month 2 adds 1 deal ($320K)

Month 1 Attribution:
- Deal A ($200K): 50% × $X = $Y
- Deal B ($200K): 50% × $X = $Y

After Month 2 (Recalculated for full YTD):
- Deal A ($200K): 27.78% × $X' = $Y'  ← Changed!
- Deal B ($200K): 27.78% × $X' = $Y'  ← Changed!
- Deal C ($320K): 44.44% × $X' = $Z'  ← New
```

---

## Clawback Calculation

When a deal fails collection within the clawback period:

```text
Clawback Amount = deal.variable_pay_split_usd × (payout_on_booking_pct / 100)
```

This is the portion that was paid immediately on booking and now needs to be recovered.

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/` | CREATE | Add `deal_variable_pay_attribution` table |
| `src/lib/dealVariablePayAttribution.ts` | CREATE | Core calculation functions for pro-rata allocation |
| `src/hooks/useDealVariablePayAttribution.ts` | CREATE | Hook to fetch/calculate attributions |
| `src/hooks/useMyDealsWithIncentives.ts` | MODIFY | Integrate variable pay alongside commissions |
| `src/components/reports/MyDealsReport.tsx` | MODIFY | Add Variable Pay columns to table and summary |

---

## Extended Interface for Deals

```typescript
interface DealWithIncentives {
  // ... existing commission fields ...
  
  // NEW: Variable Pay Attribution
  vp_proportion_pct: number;           // Deal's % share of total ARR
  vp_eligible_usd: number;             // Pro-rata share of variable pay
  vp_payout_on_booking_usd: number;    // Paid immediately
  vp_payout_on_collection_usd: number; // Held for collection
  vp_payout_on_year_end_usd: number;   // Reserved for year-end
  vp_clawback_eligible_usd: number;    // Amount at risk
  
  // Aggregate context (for tooltip)
  vp_total_actual_usd: number;         // YTD total
  vp_achievement_pct: number;          // Overall achievement
  vp_multiplier: number;               // Applied multiplier
}
```

---

## UI Enhancement: Updated Summary Section

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ DEAL TOTALS                                                                   │
│ Total Deals: 22  │  Total ARR: $720,000  │  Total TCV: $1.8M                 │
│ [Pending: 15]    [Collected: 6]    [Clawback: 1]                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ COMMISSION INCENTIVES (MS, Perpetual, CR/ER, Impl)                           │
│ Eligible: $12,500  │  Paid (Booking): $8,750  │  Held: $3,750                │
├──────────────────────────────────────────────────────────────────────────────┤
│ VARIABLE PAY (New Software Booking ARR)                                       │
│ Achievement: 120%  │  Multiplier: 1.4x                                        │
│ Total VP: $84,000  │  Paid (Booking): $58,800  │  Held (Collection): $21,000 │
│ Clawback at Risk: $12,000 (2 pending deals)                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| Zero total ARR | Skip calculation (division by zero protected) |
| Single deal | Gets 100% of variable pay |
| Mid-year target change | Recalculate all YTD attributions |
| Deal value = $0 | Gets 0% proportion (filtered out) |
| No plan assignment | Skip variable pay calc; commission-only |
| Gate threshold not met | Total variable pay = 0, all deals get $0 |
| Multi-participant deal | Each participant gets their own attribution |

---

## Summary

This Pro-Rata approach is:
- **Simple**: Deal VP = Total VP × (Deal ARR / Total ARR)
- **Accurate**: Always sums to 100% of total payout
- **Dynamic**: Recalculates monthly with YTD data
- **Clawback-Ready**: Clear amount per deal to recover if uncollected
- **Auditable**: Stores calculation context for transparency

