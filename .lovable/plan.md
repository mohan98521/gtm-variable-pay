
# Plan: Address Monthly Payout Lifecycle Gaps

## Executive Summary

This plan addresses four gaps identified in the Payout Run lifecycle implementation to fully align with the specified Monthly Payout Process:

| Gap | Current State | Required Implementation |
|-----|--------------|------------------------|
| **PAID Status** | Lifecycle ends at FINALIZED | Add PAID status with payroll confirmation |
| **Clawback Integration** | 180-day rule exists in DB but not in calculation | Integrate clawback detection into payout engine |
| **XLSX Export** | Only CSV export available | Add multi-sheet Excel export per currency |
| **Adjustments UI** | `payout_adjustments` table exists, no UI | Build adjustment workflow interface |

---

## Gap 1: Add PAID Status

### Current State
- Status flow: `draft` -> `review` -> `approved` -> `finalized`
- No mechanism to mark runs as paid after payroll processing

### Changes Required

**1. Database Migration**
- Update `payout_runs.run_status` constraint to include `'paid'` value
- Add `paid_at` and `paid_by` columns to `payout_runs` table

**2. Hook Updates (`usePayoutRuns.ts`)**
- Update `PayoutRun` interface to include `paid_at` and `paid_by`
- Update status type to include `'paid'`
- Add handling in `useUpdatePayoutRunStatus` for paid transition

**3. UI Updates (`PayoutRunManagement.tsx`)**
- Add "Mark as Paid" button for finalized runs
- Add PAID status badge styling
- Update status flow description

**4. UI Updates (`PayoutRunDetail.tsx`)**
- Display paid_at timestamp when status is PAID
- Show who confirmed payment

---

## Gap 2: Clawback Integration (180-Day Rule)

### Current State
- `deal_collections` table has `first_milestone_due_date`, `is_clawback_triggered`, `clawback_amount_usd`
- Database trigger `auto_create_deal_collection` sets due date 180 days from booking month end
- No integration with payout calculation engine

### Business Rule
Collections not received within 180 days from booking month end trigger a clawback of the booking payout amount.

### Changes Required

**1. Payout Engine Enhancement (`payoutEngine.ts`)**

Add `checkAndApplyClawbacks()` function that:
- Queries `deal_collections` where:
  - `is_collected = false`
  - `first_milestone_due_date < current_date`
  - `is_clawback_triggered = false`
- For each overdue deal:
  - Mark `is_clawback_triggered = true`
  - Set `clawback_triggered_at = now()`
  - Calculate clawback amount from related `deal_variable_pay_attribution` records
- Call this during `runPayoutCalculation()` before main calculations

**2. Clawback Calculation Logic**

```text
For each overdue uncollected deal:
├── Find deal_variable_pay_attribution records for this deal
├── Sum payout_on_booking_usd (this was already paid)
├── Create clawback entry in monthly_payouts with:
│   ├── payout_type: 'Clawback'
│   ├── calculated_amount_usd: negative of booking amount
│   └── Proper LC conversion using compensation rate
└── Update deal_collections.clawback_amount_usd
```

**3. UI Enhancements**

Update `PayoutRunDetail.tsx` to show:
- Clawback section if any clawbacks triggered
- Employee-level clawback amounts
- Link to affected deals

**4. Reporting**
- Add clawback totals to run summary cards
- Include clawback column in export

---

## Gap 3: XLSX Multi-Sheet Export

### Current State
- Only CSV export via manual string building in `PayoutRunDetail.tsx`
- Existing `xlsxExport.ts` utility supports single-sheet export

### Changes Required

**1. Enhance `xlsxExport.ts`**

Add new function for multi-sheet workbooks:

```text
generateMultiSheetXLSX(sheets: {
  sheetName: string;
  data: T[];
  columns: ColumnDef[];
}[]): Blob
```

**2. Update `PayoutRunDetail.tsx`**

Add "Export XLSX" button with multi-sheet output:
- **Summary Sheet**: Run totals, counts, metadata
- **All Employees Sheet**: Complete breakdown (current CSV data)
- **Per-Currency Sheets**: One sheet per currency with LC amounts
- **Clawbacks Sheet** (if any): Clawback details

**3. Column Structure Per Sheet**

| Sheet | Key Columns |
|-------|-------------|
| Summary | Month, Status, Total USD, VP USD, Comm USD, Employee Count |
| All Employees | Employee, Currency, VP USD/Local, Comm USD/Local, Rates, Splits |
| [Currency] Sheet | Employee, VP (Local), Comm (Local), Total (Local), Booking (Local) |
| Clawbacks | Employee, Deal ID, Original Amount, Clawback Amount, Trigger Date |

---

## Gap 4: Payout Adjustments UI

### Current State
- `payout_adjustments` table exists with full schema:
  - `adjustment_type`: correction, clawback_reversal, manual_override
  - `status`: pending, approved, rejected, applied
  - `reason`: required field
  - `applied_to_month`: which future month to apply
- No hooks or UI components

### Changes Required

**1. Create Hook (`usePayoutAdjustments.ts`)**

```text
Hooks to create:
├── usePayoutAdjustments(runId) - List adjustments for a run
├── useCreateAdjustment() - Create new adjustment request
├── useApproveAdjustment() - Approve/reject adjustment
└── useApplyAdjustment() - Apply approved adjustment to future month
```

**2. Create UI Component (`PayoutAdjustments.tsx`)**

Features:
- List of adjustments for the current run with status badges
- "Add Adjustment" button (available in REVIEW status only)
- Adjustment form dialog:
  - Employee selector
  - Adjustment type dropdown
  - Original amount (auto-filled from payout data)
  - Adjustment amount (positive or negative)
  - Reason (required, multiline)
  - Target month for application
- Approve/Reject buttons (for finance role)
- Audit trail display

**3. Integrate into `PayoutRunDetail.tsx`**

- Add "Adjustments" tab or collapsible section
- Show adjustment count badge
- Display pending adjustments warning before approval

**4. Adjustment Application Logic**

When applying adjustments:
- Create adjustment record in target month's `monthly_payouts`
- Mark adjustment as `applied`
- Log in `payout_audit_log`

---

## Implementation Sequence

### Phase A: Database Updates (Migration)
1. Add `paid` status to payout_runs constraint
2. Add `paid_at`, `paid_by` columns

### Phase B: PAID Status Flow
1. Update `usePayoutRuns.ts` types and mutation
2. Update `PayoutRunManagement.tsx` with Mark as Paid button
3. Update `PayoutRunDetail.tsx` with paid info display

### Phase C: Clawback Integration
1. Create `checkAndApplyClawbacks()` in payoutEngine.ts
2. Integrate into `runPayoutCalculation()`
3. Update `PayoutRunDetail.tsx` to show clawbacks
4. Add clawback totals to summary cards

### Phase D: XLSX Export
1. Enhance `xlsxExport.ts` with multi-sheet support
2. Add export button and logic in `PayoutRunDetail.tsx`

### Phase E: Adjustments Workflow
1. Create `usePayoutAdjustments.ts` hook
2. Create `PayoutAdjustments.tsx` component
3. Integrate into `PayoutRunDetail.tsx`
4. Add adjustment application logic

---

## Technical Details

### Database Migration SQL

```text
-- Add paid status
ALTER TABLE payout_runs DROP CONSTRAINT IF EXISTS payout_runs_run_status_check;
ALTER TABLE payout_runs ADD CONSTRAINT payout_runs_run_status_check 
  CHECK (run_status IN ('draft', 'calculating', 'review', 'approved', 'finalized', 'paid'));

-- Add paid columns
ALTER TABLE payout_runs 
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS paid_by uuid;
```

### Clawback Detection Query

```text
SELECT dc.*, d.sales_rep_employee_id, d.project_id
FROM deal_collections dc
JOIN deals d ON d.id = dc.deal_id
WHERE dc.is_collected = false
  AND dc.first_milestone_due_date < CURRENT_DATE
  AND (dc.is_clawback_triggered IS NULL OR dc.is_clawback_triggered = false)
```

### Multi-Sheet Export Structure

```text
Workbook: payout-run-2026-01.xlsx
├── Sheet 1: "Summary"
│   └── Run metadata, totals, status info
├── Sheet 2: "All Employees" 
│   └── Full breakdown with dual currencies
├── Sheet 3: "INR"
│   └── India employees, all amounts in INR
├── Sheet 4: "AED"
│   └── UAE employees, all amounts in AED
├── Sheet 5: "Clawbacks"
│   └── Clawback details (if any)
└── Sheet 6: "Adjustments"
    └── Adjustment records (if any)
```

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

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/xxx.sql` | Create | Add paid status and columns |
| `src/hooks/usePayoutRuns.ts` | Modify | Add paid status handling |
| `src/hooks/usePayoutAdjustments.ts` | Create | Adjustments CRUD hooks |
| `src/lib/payoutEngine.ts` | Modify | Add clawback detection |
| `src/lib/xlsxExport.ts` | Modify | Add multi-sheet support |
| `src/components/admin/PayoutRunManagement.tsx` | Modify | Add PAID badge and button |
| `src/components/admin/PayoutRunDetail.tsx` | Modify | Add XLSX export, clawbacks, adjustments |
| `src/components/admin/PayoutAdjustments.tsx` | Create | Adjustments UI component |

---

## Estimated Effort

| Phase | Complexity | Files |
|-------|------------|-------|
| A: Database | Low | 1 migration |
| B: PAID Status | Low | 3 files |
| C: Clawback Integration | Medium | 2 files |
| D: XLSX Export | Medium | 2 files |
| E: Adjustments Workflow | High | 3 files |

---

## Testing Scenarios

1. **PAID Status**: Finalize run -> Mark as Paid -> Verify timestamp
2. **Clawback**: Create deal with 180+ day old booking -> Run calculation -> Verify clawback triggered
3. **XLSX Export**: Run with multi-currency employees -> Export -> Verify all sheets present
4. **Adjustments**: Create adjustment -> Approve -> Apply to future month -> Verify in target run
