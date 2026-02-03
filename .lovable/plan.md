

# Fix Collection Logic, Payout Eligibility, and Three-Way Splits in Reports & Dashboard

## Problem Summary

Several components in the Reports and Dashboard sections are **NOT correctly displaying the three-way payout split** (Booking/Collection/Year-End). Instead, they use a legacy two-way split (75/25) which is incorrect.

## Issues to Fix

### Issue 1: CommissionTable.tsx - Missing Year-End Column

**Current State (WRONG):**
```
| Commission Type | Deal Value | Rate | Gross Payout | Paid (75%) | Holding (25%) |
```

**Correct State:**
```
| Commission Type | Deal Value | Rate | Gross Payout | Booking (X%) | Collection (Y%) | Year-End (Z%) |
```

**Problem:** The component only shows 2 payout columns with hardcoded "75%" and "25%" labels. It doesn't:
- Accept `totalYearEndHoldback` prop
- Show the year-end holdback column
- Use plan-defined split percentages in the header

### Issue 2: useIncentiveAuditData.ts - Commission Calculation Missing Year-End

**Current State (lines 443-451):**
```typescript
const calcResult = calculateDealCommission(
  dealValue,
  commConfig.commission_rate_pct,
  commConfig.min_threshold_usd,
  payoutOnBookingPct,
  payoutOnCollectionPct  // ← Missing payoutOnYearEndPct!
);
```

**Problems:**
1. Not fetching `payout_on_year_end_pct` from plan_commissions query (line 202)
2. Not passing year-end pct to `calculateDealCommission`
3. `CommissionDetail` interface missing `yearEndHoldback` field
4. Not tracking `totalCommissionYearEndHoldback`

### Issue 3: Reports.tsx - Export Missing Year-End Column

**Current export (lines 430-445):**
```typescript
exportData.push({
  // ...
  payout: comm.immediatePayout.toFixed(2),
  holdback: comm.holdback.toFixed(2),
  // ← Missing yearEndHoldback!
});
```

### Issue 4: useMyDealsWithIncentives.ts - Commission Actual Paid Missing Exempt Logic

**Current logic (lines 647-654):**
```typescript
let actualPaid = incentiveCalc.totalBooking;
if (isCollected) {
  actualPaid += incentiveCalc.totalCollection;
}
if (isClawback) {
  actualPaid = 0;
}
```

**Missing:** Clawback exempt plans should receive full payout immediately, but this logic doesn't check for exemption status on commissions.

---

## Technical Implementation

### 1. Update CommissionTable.tsx

**Changes:**
- Add `totalYearEndHoldback` prop
- Update column headers to show plan-defined percentages (similar to MetricsTable)
- Add Year-End column

```typescript
interface CommissionTableProps {
  commissions: CommissionCompensation[];
  totalGrossPayout: number;
  totalPaid: number;
  totalHoldback: number;
  totalYearEndHoldback: number;  // NEW
}

// Table header should show:
<TableHead className="text-right font-semibold">Booking (X%)</TableHead>
<TableHead className="text-right font-semibold">Collection (Y%)</TableHead>
<TableHead className="text-right font-semibold">Year-End (Z%)</TableHead>  // NEW

// Each row should show:
<TableCell className="text-right text-success">
  {formatCurrency(commission.amountPaid)}
</TableCell>
<TableCell className="text-right text-muted-foreground">
  {formatCurrency(commission.holdback)}
</TableCell>
<TableCell className="text-right text-warning">  // NEW
  {formatCurrency(commission.yearEndHoldback)}
</TableCell>
```

### 2. Update useIncentiveAuditData.ts

**Changes:**
- Update `PlanCommissionRow` interface to include `payout_on_year_end_pct`
- Update query to fetch `payout_on_year_end_pct`
- Update `CommissionDetail` interface to include `yearEndHoldback`
- Pass all 6 parameters to `calculateDealCommission`
- Track `totalCommissionYearEndHoldback`

```typescript
// Update interface
interface PlanCommissionRow {
  // ... existing fields
  payout_on_year_end_pct: number | null;  // NEW
}

export interface CommissionDetail {
  // ... existing fields
  yearEndHoldback: number;  // NEW
}

// Update query (line 202)
.select("id, plan_id, commission_type, commission_rate_pct, min_threshold_usd, is_active, payout_on_booking_pct, payout_on_collection_pct, payout_on_year_end_pct")

// Update calculation
const payoutOnYearEndPct = commConfig.payout_on_year_end_pct ?? 5;

const calcResult = calculateDealCommission(
  dealValue,
  commConfig.commission_rate_pct,
  commConfig.min_threshold_usd,
  payoutOnBookingPct,
  payoutOnCollectionPct,
  payoutOnYearEndPct  // NEW
);
```

### 3. Update IncentiveAuditRow Interface

Add `totalCommissionYearEndHoldback` to the interface and calculations.

### 4. Update Reports.tsx Export

Add year-end holdback column to the export.

### 5. Update Dashboard.tsx

Pass `totalCommissionYearEndHoldback` prop to CommissionTable.

### 6. Update useMyDealsWithIncentives.ts - Commission Actual Paid

Add exemption logic for commission actual paid calculation:

```typescript
// Get clawback exempt status for this deal's plan
const isCommissionClawbackExempt = vpAttr?.isClawbackExempt ?? false;

// Calculate actual paid based on exemption and collection status
let actualPaid = 0;
if (isCommissionClawbackExempt) {
  // Exempt: Full payout immediately
  actualPaid = incentiveCalc.totalEligible;
} else if (linkedToImpl) {
  // Linked to impl: 100% on collection
  actualPaid = isCollected ? incentiveCalc.totalEligible : 0;
} else {
  // Standard: Booking paid immediately, rest on collection
  actualPaid = incentiveCalc.totalBooking;
  if (isCollected) {
    actualPaid += incentiveCalc.totalCollection + incentiveCalc.totalYearEnd;
  }
}

if (isClawback && !isCommissionClawbackExempt) {
  actualPaid = 0;
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/dashboard/CommissionTable.tsx` | Add year-end column, update header labels to use plan splits |
| `src/pages/Dashboard.tsx` | Pass `totalCommissionYearEndHoldback` prop |
| `src/hooks/useIncentiveAuditData.ts` | Add year-end split to commission calculation, update interfaces |
| `src/pages/Reports.tsx` | Add year-end column to export |
| `src/hooks/useMyDealsWithIncentives.ts` | Add exempt logic to commission actual_paid calculation |

---

## Summary of Changes

| Area | Before | After |
|------|--------|-------|
| CommissionTable columns | 2 (75%/25%) | 3 (Booking/Collection/Year-End with plan splits) |
| Commission calculations | Missing year-end | Full three-way split |
| Incentive Audit export | 2 columns | 3 columns |
| Commission actual paid | No exempt logic | Respects clawback exemption |

