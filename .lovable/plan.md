

## Fix Dashboard Issues: Actuals Not Reflecting, Add Commission Metrics, and Redesign What-If Simulator

### Issue Analysis

Based on my investigation, I've identified **three root causes** for the issues:

---

### Issue 1: Actuals Not Reflecting ($0 Displayed)

**Root Cause:** The `SALES_FUNCTION_TO_PLAN` mapping in `useCurrentUserCompensation.ts` is missing key values:

| Employee's sales_function | What Map Has | Comp Plan Name |
|---------------------------|--------------|----------------|
| **Farming** | Missing! | Farmer |
| **Hunting** | Missing! | Hunter |

The employee DU0001 has `sales_function = "Farming"` but the code only maps `"Farmer"`, so plan lookup fails with `ilike("name", "%Farming%")` which returns no results.

**Evidence:**
- Database shows `sales_function` values: `Farming`, `Hunting`, `Farmer - Retain`, etc.
- Comp plan names: `Farmer`, `Hunter`, `Farmer Retain`, etc.
- **$793,159** in actual deals exist for DU0001 in 2026

**Fix:** Add missing mappings:
```typescript
const SALES_FUNCTION_TO_PLAN: Record<string, string> = {
  "Farming": "Farmer",      // ADD THIS
  "Hunting": "Hunter",      // ADD THIS
  "Farmer": "Farmer",
  "Hunter": "Hunter",
  // ... rest stays same
};
```

---

### Issue 2: Commission Structure Metrics Not Displayed

**Root Cause:** The current dashboard only shows **Variable Pay metrics** (New Software Booking ARR, Closing ARR). Commission metrics (Managed Services, Perpetual License, CR/ER, Implementation) are completely missing.

**Data Available in Database:**
| Commission Type | DU0001 Total Actuals |
|-----------------|---------------------|
| Managed Services | $106,875 |
| Perpetual License | $100,000 |
| CR/ER | $110,000 (CR + ER combined) |
| Implementation | $100,000 |

**Plan Commissions Configured:**
| Type | Rate | Min Threshold |
|------|------|---------------|
| Managed Services | 1.5% | None |
| Perpetual License | 4.0% | $50,000 |
| CR/ER | 1.0% | None |
| Implementation | 1.0% | None |

**Fix:** 
1. Add commission fetching to `useCurrentUserCompensation`
2. Add commission display section to Dashboard
3. Include commissions in the metrics table

---

### Issue 3: What-If Simulator Uses Percentage Sliders Instead of Actual Value Inputs

**Current Behavior:** Users adjust achievement % with sliders (80%-200%)

**Requested Behavior:** Users should input **actual values** directly, and the system should:
1. Calculate achievement % from: `Achievement = (Actual / Target) * 100`
2. Look up multiplier based on achievement %
3. Calculate payout using the standard formula

**Fix:** 
- Replace percentage sliders with numeric input fields for actuals
- Add commission metrics to the simulator
- Show real-time calculation: Actuals entered → Achievement % calculated → Multiplier determined → Payout projected

---

### Implementation Plan

#### Step 1: Fix sales_function Mapping

**File:** `src/hooks/useCurrentUserCompensation.ts`

```typescript
const SALES_FUNCTION_TO_PLAN: Record<string, string> = {
  "Farming": "Farmer",       // NEW
  "Hunting": "Hunter",       // NEW
  "Farmer": "Farmer",
  "Hunter": "Hunter",
  "Farmer - Retain": "Farmer Retain",
  "Sales Head - Farmer": "Sales Head Farmer",
  "Sales Head - Hunter": "Sales Head Hunter",
  "CSM": "CSM",
  "Sales Engineering": "Sales Engineering",
  "SE": "Sales Engineering",
  "Solution Architect": "Product Specialist or Solution Architect",
  "Solution Manager": "Product Specialist or Solution Architect",
};
```

#### Step 2: Add Commission Data Fetching

**File:** `src/hooks/useCurrentUserCompensation.ts`

Extend the hook to:
1. Fetch `plan_commissions` for the user's plan
2. Aggregate commission actuals from deals (managed_services_usd, perpetual_license_usd, cr_usd + er_usd, implementation_usd)
3. Calculate commission payouts: `DealValue × Rate` with 75/25 split
4. Return commission data alongside variable pay metrics

New interfaces:
```typescript
export interface CommissionCompensation {
  commissionType: string;
  dealValue: number;
  rate: number;
  minThreshold: number | null;
  grossPayout: number;
  amountPaid: number;      // 75%
  holdback: number;        // 25%
}
```

#### Step 3: Update Dashboard UI

**File:** `src/pages/Dashboard.tsx`

Add new section for Commission Structure:
- Display commission metrics in a dedicated table or combined with variable pay
- Show Deal Value, Rate, Gross Payout, Paid (75%), Holding (25%)

#### Step 4: Redesign What-If Simulator with Input Fields

**File:** `src/components/dashboard/PayoutSimulator.tsx`

Replace sliders with:
```text
┌─────────────────────────────────────────────────────────────────┐
│ What-If Payout Simulator                      [Reset to current] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ VARIABLE PAY METRICS                                            │
│ ┌───────────────────────────────┬───────────────────────────┐  │
│ │ New Software Booking ARR      │ Closing ARR               │  │
│ │ Target: $600,000              │ Target: $1,600,000        │  │
│ │ Simulated Actual: [_________] │ Simulated Actual: [______]│  │
│ │ Achievement: 132.2%           │ Achievement: 0%           │  │
│ └───────────────────────────────┴───────────────────────────┘  │
│                                                                 │
│ COMMISSION METRICS                                              │
│ ┌───────────────────────────────┬───────────────────────────┐  │
│ │ Managed Services              │ Perpetual License         │  │
│ │ Rate: 1.5%                    │ Rate: 4% (Min: $50K)      │  │
│ │ Simulated Deal Value: [_____] │ Simulated Deal Value:[___]│  │
│ └───────────────────────────────┴───────────────────────────┘  │
│ ┌───────────────────────────────┬───────────────────────────┐  │
│ │ CR/ER                         │ Implementation            │  │
│ │ Rate: 1%                      │ Rate: 1%                  │  │
│ │ Simulated Deal Value: [_____] │ Simulated Deal Value:[___]│  │
│ └───────────────────────────────┴───────────────────────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ PROJECTED PAYOUTS                                               │
│ ┌──────────────────┬────────┬──────┬──────────┬──────────────┐ │
│ │ Metric           │ Value  │ Mult │ Payout   │ Logic        │ │
│ ├──────────────────┼────────┼──────┼──────────┼──────────────┤ │
│ │ New SW Booking   │ $793K  │ 1.6x │ $86,143  │ Stepped      │ │
│ │ Closing ARR      │ $0     │ 0.0x │ $0       │ Gated        │ │
│ │ Managed Services │ $107K  │ --   │ $1,603   │ Commission   │ │
│ │ Perpetual License│ $100K  │ --   │ $4,000   │ Commission   │ │
│ │ CR/ER            │ $110K  │ --   │ $1,100   │ Commission   │ │
│ │ Implementation   │ $100K  │ --   │ $1,000   │ Commission   │ │
│ ├──────────────────┼────────┼──────┼──────────┼──────────────┤ │
│ │ TOTAL PROJECTED  │        │      │ $93,846  │              │ │
│ └──────────────────┴────────┴──────┴──────────┴──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

Key changes:
- **Input fields** for entering simulated actuals (not sliders)
- Show **Target** value for reference
- Show **Achievement %** calculated from input
- Show **Multiplier** looked up from plan grids
- Include **all commission types** with rate display

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useCurrentUserCompensation.ts` | Fix mapping, add commission fetching and calculation |
| `src/pages/Dashboard.tsx` | Add commission display section |
| `src/components/dashboard/MetricsTable.tsx` | Optionally combine variable pay and commissions |
| `src/components/dashboard/PayoutSimulator.tsx` | Replace sliders with input fields, add commission metrics |

---

### Expected Results After Fix

| Metric | Before | After |
|--------|--------|-------|
| New Software Booking ARR Actual | $0 | **$793,159** |
| Closing ARR Actual | $0 | $0 (no data, but correctly loaded) |
| Achievement % | 0% | **132.2%** |
| Multiplier | 1.00x | **1.60x** |
| Commission: Managed Services | Not shown | **$106,875 @ 1.5% = $1,603** |
| Commission: Perpetual License | Not shown | **$100,000 @ 4% = $4,000** |
| Commission: CR/ER | Not shown | **$110,000 @ 1% = $1,100** |
| Commission: Implementation | Not shown | **$100,000 @ 1% = $1,000** |
| Simulator | % Sliders | **Actual Value Input Fields** |

---

### Technical Details

**Commission Calculation Formula:**
```
Gross Payout = Deal Value × Rate (if above min threshold)
Amount Paid = Gross Payout × 0.75
Holdback = Gross Payout × 0.25
```

**Variable Pay Calculation Formula:**
```
Achievement % = (Actual / Target) × 100
Multiplier = lookup from multiplier_grids based on Achievement %
Eligible Payout = (Achievement % / 100) × Allocation × Multiplier
Amount Paid = Eligible Payout × 0.75
Holdback = Eligible Payout × 0.25
```

**Data Flow After Fix:**
```text
useCurrentUserCompensation
├── profiles → employee_id (DU0001)
├── employees → sales_function ("Farming") → map to "Farmer"
├── comp_plans → plan_id (Farmer 2026)
├── plan_metrics → variable pay metrics with grids
├── plan_commissions → commission rates
├── performance_targets → target values
├── deals → all participant roles aggregated
│   ├── new_software_booking_arr_usd → Variable Pay
│   ├── managed_services_usd → Commission
│   ├── perpetual_license_usd → Commission
│   ├── cr_usd + er_usd → Commission
│   └── implementation_usd → Commission
└── closing_arr_actuals → Closing ARR
```

