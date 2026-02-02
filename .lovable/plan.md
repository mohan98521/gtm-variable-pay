

# Add Payout Split to Metrics and Integrate Across System

## Problem Summary

The payout split fields (`payout_on_booking_pct` and `payout_on_collection_pct`) were added to the database and the MetricFormDialog, but:

1. **Plan Builder metrics table** does not display the payout split columns
2. **useCurrentUserCompensation hook** still uses hardcoded `0.75` and `0.25` instead of reading from plan metrics
3. **lib/commissions.ts** uses hardcoded 75/25 split instead of reading from plan_commissions
4. **MetricsTable (Dashboard)** shows hardcoded "Paid (75%)" and "Holding (25%)" labels
5. **useIncentiveAuditData** doesn't pass dynamic splits to calculations

---

## Changes Required

### 1. Plan Builder - Display Payout Split in Metrics Table

**File:** `src/pages/PlanBuilder.tsx`

Add two new columns to the metrics table:
- "Upon Bookings" 
- "Upon Collections"

```text
| Metric Name | Weightage | Logic Type | Gate | Upon Bookings | Upon Collections | Actions |
```

### 2. Update MetricCompensation Interface

**File:** `src/hooks/useCurrentUserCompensation.ts`

Add payout split fields to the `MetricCompensation` interface:
```typescript
export interface MetricCompensation {
  // ... existing fields
  payoutOnBookingPct: number;
  payoutOnCollectionPct: number;
}
```

### 3. Use Dynamic Payout Split in useCurrentUserCompensation

**File:** `src/hooks/useCurrentUserCompensation.ts`

Replace hardcoded 75/25:
```typescript
// Before (line 293-294)
const amountPaid = eligiblePayout * 0.75;
const holdback = eligiblePayout * 0.25;

// After
const amountPaid = eligiblePayout * (pm.payout_on_booking_pct / 100);
const holdback = eligiblePayout * (pm.payout_on_collection_pct / 100);
```

### 4. Update CommissionCompensation Interface

**File:** `src/hooks/useCurrentUserCompensation.ts`

Add payout split fields:
```typescript
export interface CommissionCompensation {
  // ... existing fields
  payoutOnBookingPct: number;
  payoutOnCollectionPct: number;
}
```

Fetch and use dynamic splits from `plan_commissions`:
```typescript
// Fetch plan commissions with payout split
const { data: commissions } = await supabase
  .from("plan_commissions")
  .select("commission_type, commission_rate_pct, min_threshold_usd, payout_on_booking_pct, payout_on_collection_pct")
  ...
```

### 5. Update Metrics Table UI to Show Dynamic Labels

**File:** `src/components/dashboard/MetricsTable.tsx`

- Change column headers from hardcoded "Paid (75%)" to dynamic based on metric data
- Display actual booking/collection percentages per metric

### 6. Update lib/commissions.ts to Accept Dynamic Split

**File:** `src/lib/commissions.ts`

Modify `calculateDealCommission` to accept split parameters:
```typescript
export function calculateDealCommission(
  tcvUsd: number,
  commissionRatePct: number,
  minThresholdUsd: number | null = null,
  payoutOnBookingPct: number = 75,  // NEW
  payoutOnCollectionPct: number = 25  // NEW
): { qualifies: boolean; gross: number; paid: number; holdback: number }
```

### 7. Update useIncentiveAuditData for Dynamic Splits

**File:** `src/hooks/useIncentiveAuditData.ts`

Pass dynamic splits from plan_metrics and plan_commissions to calculations.

### 8. Update compensationEngine.ts

**File:** `src/lib/compensationEngine.ts`

Add payout split to `MetricPayoutResult` and use it in calculations.

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/pages/PlanBuilder.tsx` | Add "Upon Bookings" and "Upon Collections" columns to metrics table |
| `src/hooks/useCurrentUserCompensation.ts` | Add payout split fields to interfaces, use dynamic splits from DB |
| `src/components/dashboard/MetricsTable.tsx` | Show dynamic payout percentages in column headers |
| `src/lib/commissions.ts` | Add optional payout split parameters to `calculateDealCommission` |
| `src/lib/compensationEngine.ts` | Add payout split to calculation results |
| `src/hooks/useIncentiveAuditData.ts` | Use dynamic splits in audit calculations |
| `src/hooks/usePlanCommissions.ts` | Include payout split fields in select query |

---

## Visual Changes

### Plan Builder Metrics Table (After)

```text
┌──────────────────────────┬──────────┬─────────────┬──────┬─────────────┬──────────────┬─────────┐
│ Metric Name              │ Weightage│ Logic Type  │ Gate │Upon Bookings│Upon Collect. │ Actions │
├──────────────────────────┼──────────┼─────────────┼──────┼─────────────┼──────────────┼─────────┤
│ New Software Booking ARR │ 50%      │ Stepped Acc │ -    │ 75%         │ 25%          │ ✏️ 🗑️   │
│ Closing ARR              │ 50%      │ Gated Thres │ 85%  │ 75%         │ 25%          │ ✏️ 🗑️   │
└──────────────────────────┴──────────┴─────────────┴──────┴─────────────┴──────────────┴─────────┘
```

### Dashboard Metrics Table (After)

Column headers will show:
- "Paid (75%)" → "Booking (75%)" (or dynamic per metric if they differ)
- "Holding (25%)" → "Collection (25%)" (or dynamic)

---

## Data Flow

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PAYOUT SPLIT FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

  Plan Builder (Admin)
       │
       ▼
  ┌───────────────────┐
  │   plan_metrics    │  ← payout_on_booking_pct, payout_on_collection_pct
  │   plan_commissions│  ← payout_on_booking_pct, payout_on_collection_pct
  └───────────────────┘
       │
       ▼
  ┌───────────────────┐
  │  Calculation      │  ← useCurrentUserCompensation reads dynamic split
  │  Engine           │  ← useIncentiveAuditData reads dynamic split
  └───────────────────┘
       │
       ├─────────────────────────────────────────────┐
       │                                             │
       ▼                                             ▼
  ┌───────────────────┐                        ┌───────────────────┐
  │  Dashboard        │                        │  Reports          │
  │  (MetricsTable)   │                        │  (Incentive Audit)│
  │  Shows dynamic %  │                        │  Shows dynamic %  │
  └───────────────────┘                        └───────────────────┘
```

---

## Impact

This implementation will:
1. Allow admins to configure different booking/collection splits per metric
2. Display the configured splits in the Plan Builder
3. Use the configured splits in all payout calculations
4. Show accurate percentages in Dashboard and Reports
5. Remove all hardcoded 75/25 splits from the codebase

