

# Add "At Year End" Payout Split Component

## Summary

This implementation adds a third payout split component called **"At Year End"** to both metrics and commissions. This component will be held back for year-end adjustments (clawbacks, performance gaps, etc.) and will be released during **December payroll processing**.

The new three-way split: **Upon Bookings + Upon Collections + At Year End = 100%**

---

## Database Schema Changes

### Migration: Add `payout_on_year_end_pct` Column

**Tables to modify:**
- `plan_metrics` - Add `payout_on_year_end_pct numeric DEFAULT 0`
- `plan_commissions` - Add `payout_on_year_end_pct numeric DEFAULT 0`

```sql
-- Add year-end payout split to plan_metrics
ALTER TABLE plan_metrics 
ADD COLUMN payout_on_year_end_pct numeric DEFAULT 0;

-- Add year-end payout split to plan_commissions
ALTER TABLE plan_commissions 
ADD COLUMN payout_on_year_end_pct numeric DEFAULT 0;

-- Add constraint to ensure three-way split sums to 100%
ALTER TABLE plan_metrics 
ADD CONSTRAINT plan_metrics_payout_split_check 
CHECK (payout_on_booking_pct + payout_on_collection_pct + payout_on_year_end_pct = 100);

ALTER TABLE plan_commissions 
ADD CONSTRAINT plan_commissions_payout_split_check 
CHECK (payout_on_booking_pct + payout_on_collection_pct + payout_on_year_end_pct = 100);
```

---

## File Changes

### 1. MetricFormDialog.tsx - Add Third Split Field

**Current state:** Two fields (Booking + Collection = 100%)
**New state:** Three fields (Booking + Collection + Year End = 100%)

**Changes:**
- Add `payout_on_year_end_pct` to the zod schema
- Update validation: sum of all three must equal 100%
- Add third form field with label "At Year End (%)"
- Update auto-calculation logic: when any field changes, intelligently adjust others
- Add tooltip: "Held for year-end adjustments, clawbacks, performance reviews. Released in December payroll."

### 2. CommissionFormDialog.tsx - Add Third Split Field

**Same changes as MetricFormDialog:**
- Add `payout_on_year_end_pct` to schema
- Three-way validation
- Third form field
- Auto-calculation logic

### 3. PlanBuilder.tsx - Add "Year End" Column

**Current table columns:**
| Metric Name | Weightage | Logic Type | Gate | Upon Bookings | Upon Collections | Actions |

**New table columns:**
| Metric Name | Weightage | Logic Type | Gate | Bookings | Collections | Year End | Actions |

**Changes:**
- Add `<TableHead>` for "Year End"
- Add `<TableCell>` displaying `metric.payout_on_year_end_pct ?? 0}%`

### 4. usePlanMetrics.ts - Update Interface

```typescript
export interface PlanMetric {
  // ... existing fields
  payout_on_year_end_pct: number;  // NEW
}
```

### 5. usePlanCommissions.ts - Update Interface & Query

```typescript
export interface PlanCommission {
  // ... existing fields
  payout_on_year_end_pct: number;  // NEW
}
```

Update select query to include the new column.

### 6. useCurrentUserCompensation.ts - Three-Way Split Calculation

**Update interfaces:**
```typescript
export interface MetricCompensation {
  // ... existing fields
  payoutOnYearEndPct: number;      // NEW
  yearEndHoldback: number;          // NEW - calculated amount
}

export interface CommissionCompensation {
  // ... existing fields
  payoutOnYearEndPct: number;      // NEW
  yearEndHoldback: number;          // NEW
}

export interface CurrentUserCompensation {
  // ... existing fields
  totalYearEndHoldback: number;             // NEW
  totalCommissionYearEndHoldback: number;   // NEW
}
```

**Update calculation logic:**
```typescript
// Three-way split
const payoutOnBookingPct = pm.payout_on_booking_pct ?? 75;
const payoutOnCollectionPct = pm.payout_on_collection_pct ?? 25;
const payoutOnYearEndPct = pm.payout_on_year_end_pct ?? 0;

const amountPaid = eligiblePayout * (payoutOnBookingPct / 100);
const holdback = eligiblePayout * (payoutOnCollectionPct / 100);
const yearEndHoldback = eligiblePayout * (payoutOnYearEndPct / 100);
```

### 7. lib/commissions.ts - Add Year-End Parameter

```typescript
export function calculateDealCommission(
  tcvUsd: number,
  commissionRatePct: number,
  minThresholdUsd: number | null = null,
  payoutOnBookingPct: number = 70,
  payoutOnCollectionPct: number = 25,
  payoutOnYearEndPct: number = 5  // NEW
): { 
  qualifies: boolean; 
  gross: number; 
  paid: number; 
  holdback: number;
  yearEndHoldback: number;  // NEW
}
```

### 8. lib/compensationEngine.ts - Add Year-End to Results

```typescript
export interface MetricPayoutResult {
  // ... existing fields
  payoutOnBookingPct: number;
  payoutOnCollectionPct: number;
  payoutOnYearEndPct: number;
  bookingPayout: number;
  collectionHoldback: number;
  yearEndHoldback: number;
}
```

### 9. MetricsTable.tsx (Dashboard) - Add Year End Column

**Current columns:**
| Metric | Target | Actual | Achiev.% | Multiplier | Eligible | Booking | Holdback |

**New columns:**
| Metric | Target | Actual | Achiev.% | Multiplier | Eligible | Booking | Collection | Year End |

**Changes:**
- Rename "Holdback" to "Collection" 
- Add new "Year End" column
- Update header logic to show dynamic percentages
- Add `totalYearEndHoldback` to footer

---

## Year-End Release Logic (December Payroll)

The year-end holdback will be released during December payroll processing. This requires:

1. **Identification**: Track all year-end holdback amounts throughout the year
2. **Processing Month Check**: When processing December payroll, release accumulated year-end holdbacks
3. **Adjustments**: Allow for deductions (clawbacks, performance adjustments) before release

**Implementation in payout processing:**
```typescript
// When processing payouts
if (processingMonth === 12) {
  // Release year-end holdbacks
  const yearEndRelease = calculateYearEndRelease(employeeId, fiscalYear);
  // Apply any deductions
  const netYearEndPayout = yearEndRelease - clawbacks - adjustments;
  // Include in December payout
}
```

---

## Visual Changes

### Metric Form Dialog (After)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Payout Split                                                            │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐      │
│ │ Upon Bookings (%) │ │ Upon Collections  │ │ At Year End (%)   │      │
│ │ [    70         ] │ │ [    25         ] │ │ [    5          ] │      │
│ └───────────────────┘ └───────────────────┘ └───────────────────┘      │
│ Paid immediately on   Held until           Year-end reserve.           │
│ deal booking          collection           Released in December.       │
│                                                                         │
│ ⚠️ Must sum to 100%                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Plan Builder - Metrics Table (After)

```text
┌──────────────────────────┬──────────┬─────────────┬──────┬──────────┬────────────┬──────────┬─────────┐
│ Metric Name              │ Weightage│ Logic Type  │ Gate │ Bookings │ Collections│ Year End │ Actions │
├──────────────────────────┼──────────┼─────────────┼──────┼──────────┼────────────┼──────────┼─────────┤
│ New Software Booking ARR │ 50%      │ Stepped Acc │ -    │ 70%      │ 25%        │ 5%       │ ✏️ 🗑️   │
│ Closing ARR              │ 50%      │ Gated Thres │ 85%  │ 70%      │ 25%        │ 5%       │ ✏️ 🗑️   │
└──────────────────────────┴──────────┴─────────────┴──────┴──────────┴────────────┴──────────┴─────────┘
```

### Dashboard - Metrics Table (After)

```text
┌────────────┬────────────┬────────────┬──────────┬────────────┬──────────────┬────────────┬────────────┬──────────┐
│ Metric     │ Target     │ Actual     │ Achiev.% │ Multiplier │ Eligible     │ Booking    │ Collection │ Year End │
│            │            │            │          │            │ Payout       │ (70%)      │ (25%)      │ (5%)     │
├────────────┼────────────┼────────────┼──────────┼────────────┼──────────────┼────────────┼────────────┼──────────┤
│ New Soft...│ $1.5M      │ $1.8M      │ 120.0%   │ 1.40x      │ $42,000      │ $29,400    │ $10,500    │ $2,100   │
│ Closing ARR│ $2.0M      │ $2.1M      │ 105.0%   │ 1.00x      │ $26,250      │ $18,375    │ $6,563     │ $1,312   │
├────────────┼────────────┼────────────┼──────────┼────────────┼──────────────┼────────────┼────────────┼──────────┤
│ TOTAL      │            │            │          │            │ $68,250      │ $47,775    │ $17,063    │ $3,412   │
└────────────┴────────────┴────────────┴──────────┴────────────┴──────────────┴────────────┴────────────┴──────────┘
```

---

## Data Flow

```text
              Eligible Payout (100%)
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
    ┌─────────┐   ┌─────────┐   ┌─────────┐
    │ Booking │   │Collection│   │Year End │
    │  (70%)  │   │  (25%)  │   │  (5%)   │
    └─────────┘   └─────────┘   └─────────┘
         │             │             │
         ▼             ▼             ▼
    ┌─────────┐   ┌─────────┐   ┌─────────┐
    │  PAID   │   │  HELD   │   │RESERVED │
    │Immediate│   │  Until  │   │  Until  │
    │ on deal │   │collection│   │December │
    └─────────┘   └─────────┘   └─────────┘
         │             │             │
         ▼             ▼             ▼
    ┌─────────┐   ┌─────────┐   ┌─────────┐
    │ Monthly │   │Collection│   │December │
    │ Payroll │   │ Trigger │   │ Payroll │
    └─────────┘   └─────────┘   └─────────┘
```

---

## Files Modified Summary

| File | Action | Description |
|------|--------|-------------|
| New Migration | CREATE | Add `payout_on_year_end_pct` to `plan_metrics` and `plan_commissions` |
| `src/components/admin/MetricFormDialog.tsx` | MODIFY | Add third split field, update validation |
| `src/components/admin/CommissionFormDialog.tsx` | MODIFY | Add third split field, update validation |
| `src/pages/PlanBuilder.tsx` | MODIFY | Add "Year End" column to metrics table |
| `src/hooks/usePlanMetrics.ts` | MODIFY | Add `payout_on_year_end_pct` to interface |
| `src/hooks/usePlanCommissions.ts` | MODIFY | Add `payout_on_year_end_pct` to interface and query |
| `src/hooks/useCurrentUserCompensation.ts` | MODIFY | Add year-end split to calculations and totals |
| `src/lib/commissions.ts` | MODIFY | Add `yearEndHoldback` to calculation function |
| `src/lib/compensationEngine.ts` | MODIFY | Add year-end split to result interfaces |
| `src/components/dashboard/MetricsTable.tsx` | MODIFY | Add "Year End" column with dynamic header |

---

## Backward Compatibility

Existing data with two-way splits (booking + collection = 100%) will:
- Have `payout_on_year_end_pct` default to 0
- Continue working as before with 0% year-end holdback
- Display as X%/Y%/0% in the UI

When updating existing records, users can redistribute percentages to include year-end holdback.

---

## Default Values

| Split Component | Default | Purpose |
|-----------------|---------|---------|
| Upon Bookings | 70% | Immediate payment on deal booking |
| Upon Collections | 25% | Held until collection confirmed |
| At Year End | 5% | Reserve for clawbacks, released in December |

