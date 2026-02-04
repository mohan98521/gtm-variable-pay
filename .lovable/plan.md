# Plan: Address Monthly Payout Lifecycle Gaps

## ✅ IMPLEMENTATION COMPLETE

All four gaps in the Payout Run lifecycle have been successfully implemented:

| Gap | Status | Implementation |
|-----|--------|----------------|
| **PAID Status** | ✅ Done | Added `paid` status, `paid_at`, `paid_by` columns; UI shows "Mark as Paid" button |
| **Clawback Integration** | ✅ Done | `checkAndApplyClawbacks()` in payoutEngine.ts detects 180-day overdue collections |
| **XLSX Multi-Sheet Export** | ✅ Done | `generateMultiSheetXLSX()` creates workbooks with Summary, All Employees, and per-currency sheets |
| **Adjustments UI** | ✅ Done | `usePayoutAdjustments.ts` hook + `PayoutAdjustments.tsx` component with CRUD and approval workflow |

---

## Files Modified/Created

### Database Migration
- Added `paid_at`, `paid_by`, `total_clawbacks_usd` columns to `payout_runs`

### Hooks
- `src/hooks/usePayoutRuns.ts` - Updated PayoutRun interface and status handling for `paid`
- `src/hooks/usePayoutAdjustments.ts` - **NEW** - CRUD hooks for adjustments workflow

### Libraries
- `src/lib/payoutEngine.ts` - Added `checkAndApplyClawbacks()` function integrated into calculation flow
- `src/lib/xlsxExport.ts` - Added `generateMultiSheetXLSX()` for multi-sheet Excel export

### Components
- `src/components/admin/PayoutRunManagement.tsx` - Added "Mark as Paid" button and status badge
- `src/components/admin/PayoutRunDetail.tsx` - Added XLSX export dropdown, adjustments section, paid confirmation display
- `src/components/admin/PayoutAdjustments.tsx` - **NEW** - Full adjustments UI with create/approve/delete

---

## Status Flow

```
DRAFT → [Calculate] → REVIEW → [Approve] → APPROVED → [Finalize] → FINALIZED → [Mark as Paid] → PAID
```

---

## Technical Implementation Summary

### 1. PAID Status (Phase A & B)
- Database migration added `paid_at`, `paid_by` columns
- `PayoutRun` interface updated with new fields
- "Mark as Paid" button appears for finalized runs
- Status badge shows "Paid" with appropriate styling

### 2. Clawback Integration (Phase C)
- `checkAndApplyClawbacks()` runs before each payout calculation
- Detects overdue `deal_collections` (180+ days past due)
- Creates negative `monthly_payouts` entries with `payout_type: 'Clawback'`
- Updates `deal_variable_pay_attribution` and `deal_collections` with clawback info
- Stores `total_clawbacks_usd` on the payout run

### 3. XLSX Multi-Sheet Export (Phase D)
- Export dropdown with CSV and XLSX options
- Multi-sheet workbook structure:
  - **Summary**: Run metadata and totals
  - **All Employees**: Complete dual-currency breakdown
  - **[Currency]**: One sheet per currency with local amounts

### 4. Adjustments Workflow (Phase E)
- Full CRUD operations via `usePayoutAdjustments` hooks
- Adjustment types: correction, clawback_reversal, manual_override
- Status workflow: pending → approved/rejected → applied
- UI integrated into PayoutRunDetail with pending count badge
- Create adjustments only during REVIEW status

---

## Permissions Matrix

| Action | admin | gtm_ops | finance |
|--------|-------|---------|---------|
| Mark as Paid | Yes | No | No |
| Create Adjustment | Yes | Yes | Yes |
| Approve Adjustment | Yes | No | Yes |
| View Clawbacks | Yes | Yes | Yes |
| Export XLSX | Yes | Yes | Yes |

---

## Future Enhancements

1. Add clawback summary card to PayoutRunDetail showing total clawback amounts
2. Add "Apply to Month" functionality for approved adjustments
3. Add notification system for pending adjustments requiring approval
4. Add audit trail view for payout changes
