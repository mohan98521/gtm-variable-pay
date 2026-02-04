
# Plan: Phase 5 - Month-Lock Mechanism Enhancement

## Executive Summary

The database triggers for month locking are already in place for `deals` and `deal_collections` tables. This plan addresses the remaining gaps to complete the month-lock mechanism:

| Gap | Status | Required Work |
|-----|--------|---------------|
| Lock trigger on `deals` | Implemented | None |
| Lock trigger on `deal_collections` | Implemented | None |
| Lock trigger on `closing_arr_actuals` | Missing | Add trigger |
| UI feedback for locked months | Missing | Add visual indicators |
| Hook to check lock status | Missing | Create `useMonthLockStatus` hook |
| Error handling in mutations | Partial | Improve user-facing messages |

---

## Gap 1: Add Lock Trigger for Closing ARR

### Current State
- `closing_arr_actuals` table has no trigger to prevent modifications for locked months
- The existing `check_month_lock` function can be reused

### Database Migration

```sql
-- Add month lock check trigger to closing_arr_actuals
CREATE TRIGGER check_closing_arr_month_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.closing_arr_actuals
  FOR EACH ROW
  EXECUTE FUNCTION public.check_month_lock();
```

This reuses the existing `check_month_lock()` function which:
- Gets `month_year` from the record
- Checks `payout_runs.is_locked` for that month
- Raises exception if locked

---

## Gap 2: Create useMonthLockStatus Hook

### New File: `src/hooks/useMonthLockStatus.ts`

```text
Hook Interface:
├── useMonthLockStatus(monthYear: string)
│   └── Returns: { isLocked: boolean, isLoading: boolean, payoutRun: PayoutRun | null }
│
└── useMonthLockStatuses(months: string[])
    └── Returns: Map<string, boolean> for batch checking
```

Features:
- Queries `payout_runs` for the specific month
- Returns `true` if `is_locked = true`
- Returns `false` if no run exists or run is not locked
- Caches results with React Query

---

## Gap 3: Add Visual Lock Indicators in UI

### 3.1 DataInputs.tsx - Month Selector Lock Badge

When a month is selected and it's locked, show:
- Lock icon next to month in selector
- Alert banner below header: "This month is locked. Changes must go through payout adjustments."
- Disable "Add Deal", "Add Record", "Bulk Upload" buttons

### 3.2 DealsTable.tsx - Disable Edit/Delete for Locked Months

- Hide/disable Edit and Delete actions for deals in locked months
- Show tooltip: "Month is locked - use payout adjustments for corrections"

### 3.3 ClosingARRTable.tsx - Same Treatment

- Disable Edit and Delete for locked month records

### 3.4 PendingCollectionsTable.tsx - Conditional Lock

- Check if the deal's `booking_month` is locked
- If locked, disable the "Mark as Collected" action
- Show tooltip explaining the lock

---

## Gap 4: Improve Error Handling in Mutations

### Updates to Hooks

**useDeals.ts** - Update error handlers:
```typescript
onError: (error: Error) => {
  if (error.message.includes('locked payout month')) {
    toast.error('Cannot modify deal: The month is locked for payouts. Use payout adjustments for corrections.');
  } else {
    toast.error(`Failed to create deal: ${error.message}`);
  }
}
```

**useClosingARR.ts** - Same pattern

**useCollections.ts** - Same pattern

---

## Implementation Details

### Database Trigger Flow

```text
USER ACTION                    DATABASE TRIGGER                      RESULT
─────────────────────────────────────────────────────────────────────────────

Create/Edit Deal      ─────►   check_deals_month_lock     ─────►   ALLOWED or
  in locked month                                                   EXCEPTION

Update Collection     ─────►   check_collections_month_lock ────►  ALLOWED or
  in locked month                                                   EXCEPTION

Create/Edit           ─────►   check_closing_arr_month_lock ────►  ALLOWED or
  Closing ARR                   (NEW - to be added)                 EXCEPTION
  in locked month
```

### Lock Check Query

```sql
SELECT is_locked 
FROM payout_runs 
WHERE month_year = $1
ORDER BY created_at DESC
LIMIT 1;
```

### UI Component Integration

```text
DataInputs.tsx
│
├── useMonthLockStatus(selectedMonth)
│   └── isLocked = true when month is finalized
│
├── If isLocked:
│   ├── Show Alert: "Month locked - use adjustments"
│   ├── Disable: "Add Deal" button
│   ├── Disable: "Add Record" button  
│   └── Disable: "Bulk Upload" button
│
└── Pass isLocked to child tables:
    ├── DealsTable (disable row actions)
    ├── ClosingARRTable (disable row actions)
    └── PendingCollectionsTable (disable mark as collected)
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/xxx.sql` | Create | Add trigger to closing_arr_actuals |
| `src/hooks/useMonthLockStatus.ts` | Create | Hook to check if month is locked |
| `src/pages/DataInputs.tsx` | Modify | Add lock status check and UI feedback |
| `src/components/data-inputs/DealsTable.tsx` | Modify | Pass isLocked prop, disable actions |
| `src/components/data-inputs/ClosingARRTable.tsx` | Modify | Pass isLocked prop, disable actions |
| `src/components/data-inputs/PendingCollectionsTable.tsx` | Modify | Check lock status per deal |
| `src/hooks/useDeals.ts` | Modify | Improve error handling |
| `src/hooks/useClosingARR.ts` | Modify | Improve error handling |
| `src/hooks/useCollections.ts` | Modify | Improve error handling |

---

## Visual Design

### Lock Alert Banner (DataInputs.tsx)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 🔒 Month Locked                                                         │
│                                                                         │
│ December 2025 payouts have been finalized. Direct edits are disabled.  │
│ To make corrections, use the Payout Adjustments workflow in Admin.     │
│                                                                         │
│                                              [View Payout Run →]        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Disabled Button State

```text
Normal:              [+ Add Deal]

Locked (disabled):   [🔒 Add Deal] ← grayed out with lock icon
                      ↓ Tooltip
                     "Month is locked for payouts"
```

### Table Row Actions

```text
Normal:               [...] → Edit | Delete

Locked (disabled):    [...] → (actions grayed out)
                       ↓ Tooltip
                      "Cannot modify - month is locked"
```

---

## Testing Scenarios

1. **Trigger Validation**
   - Create payout run → Finalize → Attempt to add deal → Verify rejection
   - Same for Closing ARR and Collections

2. **UI Lock Display**
   - Select locked month → Verify alert appears
   - Verify Add/Bulk Upload buttons are disabled
   - Verify Edit/Delete actions are disabled in tables

3. **Error Messages**
   - Attempt modification via API → Verify user-friendly error message

4. **Adjustments Path**
   - Confirm that payout adjustments can still be created for locked months
   - Verify adjustment workflow is accessible

---

## Implementation Sequence

### Step 1: Database Migration
- Add `check_closing_arr_month_lock` trigger

### Step 2: Create Lock Status Hook
- Build `useMonthLockStatus.ts`

### Step 3: Update DataInputs Page
- Add lock status check
- Add alert banner
- Disable action buttons

### Step 4: Update Table Components
- Pass `isLocked` prop to tables
- Disable row-level actions

### Step 5: Improve Error Handling
- Update mutation error handlers in hooks
