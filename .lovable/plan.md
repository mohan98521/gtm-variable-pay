

# Fix Clawback-Exempt Payout Logic

## Problem Statement

The current implementation incorrectly treats clawback-exempt plans as if **all portions are paid immediately**. This is wrong.

### What Clawback-Exempt Actually Means:
| Split Category | Standard Plan Behavior | Clawback-Exempt Behavior |
|----------------|----------------------|-------------------------|
| Upon Booking (75%) | Paid on booking | ✅ Paid on booking (no change) |
| Upon Collection (0-25%) | Held until collection confirmed | ✅ **Paid immediately** (no collection dependency) |
| At Year-End (5-25%) | Held until December | ❌ **Still held until December** |
| Clawback Risk | If not collected in 180 days, booking portion clawed back | ✅ No clawback risk |

### Key Insight:
- **Clawback-Exempt** eliminates the **collection dependency**, NOT the year-end hold
- The "Upon Collection" portion becomes immediately payable because there's no need to wait for collection
- The "At Year-End" portion is still held until December - this is for adjustments, reconciliation, and final payout processing

## Current Code Issues

### Issue 1: `useMyDealsWithIncentives.ts` (Lines 651-665)
The `actualPaid` calculation treats clawback-exempt as "full payout immediately":
```typescript
if (isClawbackExempt) {
  // WRONG: Full payout immediately regardless of collection status
  actualPaid = incentiveCalc.totalEligible;  // ❌ Includes year-end portion
}
```

**Should be:**
```typescript
if (isClawbackExempt) {
  // Correct: Booking + Collection paid immediately, Year-End still held
  actualPaid = incentiveCalc.totalBooking + incentiveCalc.totalCollection;  // ✅
}
```

### Issue 2: `PayoutSettingsCard.tsx` (Lines 196-200)
The UI messaging is misleading:
```
"all portions are payable immediately with no clawback risk"
```

**Should clarify:**
- Booking and Collection portions are payable immediately
- Year-End portion is still held until December
- No clawback risk on any portion

### Issue 3: Memory Entry Correction
The memory `business-logic/clawback-exemption-policy` incorrectly states:
> "100% payout on booking regardless of collection status"

This needs correction to reflect the accurate business logic.

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useMyDealsWithIncentives.ts` | Fix `actualPaid` calculation for clawback-exempt plans |
| `src/components/admin/PayoutSettingsCard.tsx` | Update messaging to clarify year-end is still held |

## Technical Implementation

### 1. Fix `useMyDealsWithIncentives.ts` (Lines 651-665)

```typescript
// Calculate actual paid based on collection status and exemption
let actualPaid = 0;
if (isClawbackExempt) {
  // Clawback exempt: Booking + Collection portions paid immediately
  // Year-End portion is still held until December for reconciliation
  actualPaid = incentiveCalc.totalBooking + incentiveCalc.totalCollection;
} else if (linkedToImpl) {
  // Linked to implementation: 100% on collection only
  actualPaid = isCollected ? incentiveCalc.totalEligible : 0;
} else {
  // Standard: Booking paid immediately, rest on collection
  actualPaid = incentiveCalc.totalBooking;
  if (isCollected) {
    actualPaid += incentiveCalc.totalCollection + incentiveCalc.totalYearEnd;
  }
}
```

### 2. Update `PayoutSettingsCard.tsx` Messaging

Replace the current clawback-exempt explanation with:
```tsx
<p className="text-xs text-muted-foreground">
  Employees receive the Booking and Collection portions of their payout 
  immediately upon deal booking, with no dependency on actual collection. 
  The Year-End portion is still held until December for reconciliation 
  and adjustments. There is no clawback risk on any portion.
</p>
```

## Impact Summary

### For Clawback-Exempt Employee Example (Sales Engineering Rep):
- **Gross Payout**: $15,645
- **Split**: 75% Booking / 0% Collection / 25% Year-End

| Split | Amount | Current (Wrong) | Corrected |
|-------|--------|-----------------|-----------|
| Upon Booking | $11,734 | ✅ Paid immediately | ✅ Paid immediately |
| Upon Collection | $0 | N/A | N/A |
| At Year-End | $3,911 | ❌ Paid immediately | ✅ Held until December |
| **Total Paid Now** | — | $15,645 | **$11,734** |
| **Held for Year-End** | — | $0 | **$3,911** |

## Payout Flow Comparison (Visual)

```text
STANDARD PLAN (with clawback):
├── Booking Month
│   └── Pay 75% (Booking Portion) → Subject to Clawback
├── Collection Confirmed (or 180-day deadline)
│   ├── Collected → Pay 25% (Collection + Year-End)
│   └── Not Collected → Clawback 75%
└── December
    └── Release any remaining Year-End holdback

CLAWBACK-EXEMPT PLAN (corrected):
├── Booking Month
│   └── Pay 75% + 0% (Booking + Collection) → NO Clawback Risk
└── December
    └── Release 25% (Year-End Portion)
```

