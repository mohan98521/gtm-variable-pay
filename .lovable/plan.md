

## Mid-Year Compensation Changes and Employee Management Gaps

### Problem Statement

When an employee receives a mid-year compensation change (hike, role movement, transfer), the system needs to:
1. Record the historical compensation values (what was the old OTE/TFP/TVP?)
2. Split the existing plan assignment into a "before" and "after" period with different compensation values
3. Ensure the payout engine correctly pro-rates each period independently
4. Maintain an audit trail of what changed, when, and by whom

### Current Gaps Identified

| Gap | Impact | Severity |
|-----|--------|----------|
| No compensation change history table | Cannot track what OTE/TFP was before a hike | High |
| Employee master edits overwrite values in-place | Historical compensation data is lost forever | High |
| No "Split Assignment" workflow for mid-year changes | Admin must manually end old assignment + create new one with new OTE -- error-prone | High |
| No Change Reason capture (hike, promotion, transfer, correction) | No audit trail for why compensation changed | Medium |
| Payout engine does not blend two assignments in one fiscal year | If assignment A runs Jan-Jun and B runs Jul-Dec, each month picks the right plan, but YTD VP calculation uses a single target_bonus_usd across all months | High |
| No effective-date-aware compensation rate on user_targets | compensation_exchange_rate is on employees table (single value), not per-assignment | Medium |
| No UI to view an employee's compensation timeline/history | Admin cannot see past changes at a glance | Medium |
| Employee deactivation does not auto-end plan assignment | Departing employee's assignment may extend beyond departure date | Low |

---

### Plan

#### 1. New Database Table: `employee_change_log`

Captures a snapshot every time compensation-relevant fields change on the `employees` table or `user_targets` table.

```text
employee_change_log
  id              UUID (PK)
  employee_id     UUID (FK -> employees.id)
  changed_at      TIMESTAMPTZ (default now())
  changed_by      UUID (FK -> auth.users.id)
  change_type     TEXT  -- 'hike', 'promotion', 'transfer', 'correction', 'new_joiner', 'departure'
  change_reason   TEXT  -- free-text note
  field_changes   JSONB -- { "tfp_usd": { "old": 80000, "new": 90000 }, "sales_function": { "old": "Farmer", "new": "Hunter" } }
  effective_date  DATE  -- when the change takes effect
```

- RLS: Readable by admin, finance, gtm_ops. Writable by admin, gtm_ops.

#### 2. Enhanced Employee Edit Flow with Change Capture

**File: `src/components/admin/EmployeeFormDialog.tsx`**

When editing an employee, add:
- A "Change Type" dropdown (Hike, Promotion, Transfer, Correction) -- required when compensation fields change
- An "Effective Date" date picker -- defaults to today
- A "Reason / Notes" text field -- optional
- On save: detect which fields changed, write a row to `employee_change_log`, then update the employee record

**File: `src/hooks/useEmployeeChangeLog.ts`** (new)

- `useEmployeeChangeLog(employeeId)` -- fetches change history for an employee
- `useLogEmployeeChange()` -- mutation to insert a change log entry

#### 3. Mid-Year Assignment Split Workflow

When compensation values change mid-year and the employee has an active plan assignment, the system should offer to split the assignment:

**Workflow:**
1. Admin edits employee OTE from $100k to $120k effective July 1
2. System detects an active `user_targets` assignment spanning Jan 1 - Dec 31 with OTE $100k
3. System prompts: "This employee has an active plan assignment. Would you like to split it at the effective date?"
4. If confirmed:
   - End existing assignment on June 30 (keeping old OTE $100k)
   - Create new assignment starting July 1 through Dec 31 with new OTE $120k
   - Both assignments reference the same plan (unless a plan change is also selected)

**File: `src/components/admin/CompensationChangeDialog.tsx`** (new)

A dedicated dialog that appears when compensation-impacting fields change on an employee. Shows:
- The current active assignment details
- The proposed changes
- Option to split or keep as-is
- Effective date picker
- Change type and reason fields

#### 4. Payout Engine Fix for Multi-Assignment Years

**File: `src/lib/payoutEngine.ts`**

Currently at line 961, the engine fetches a single assignment for the month. This works correctly for monthly calculation since each month picks the right assignment. However, the YTD VP calculation (used for incremental computation) needs to account for different `target_bonus_usd` values across assignments within the same year.

The fix:
- When calculating YTD VP, instead of using a single `targetBonusUsd` for the full year, sum the pro-rated bonus from each assignment period
- For months Jan-Jun with Assignment A ($100k OTE): use A's target_bonus_usd pro-rated for 6 months
- For months Jul-Dec with Assignment B ($120k OTE): use B's target_bonus_usd pro-rated for 6 months
- The incremental calculation (YTD minus prior) naturally handles this since each month's calculation uses that month's active assignment

**Validation**: Confirm that the current incremental model (calculate this month using this month's plan, subtract sum of prior months' finalized payouts) already handles the multi-assignment case correctly. Since each month is calculated independently with its own assignment's bonus, the incremental subtraction should work. Add a comment and test coverage.

#### 5. Employee Compensation Timeline UI

**File: `src/components/admin/EmployeeCompensationTimeline.tsx`** (new)

Add a "Compensation History" section visible when viewing/editing an employee, showing:
- A chronological timeline of all changes from `employee_change_log`
- Each entry shows: date, change type badge, what changed (old value to new value), changed by, reason
- Also shows all plan assignments from `user_targets` interleaved on the timeline

Accessible from the Employee Accounts table via a new "View History" action in the dropdown menu.

#### 6. Auto-End Assignment on Departure

**File: `src/components/admin/EmployeeFormDialog.tsx`**

When an admin sets a `departure_date` on an employee:
- Check if any active `user_targets` assignment has an `effective_end_date` after the departure date
- If so, prompt: "Adjust assignment end date to match departure date?"
- If confirmed, update the assignment's `effective_end_date` to the departure date

#### 7. Compensation Change Audit in Existing Audit System

**File: `src/lib/auditLogger.ts`**

Add `logEmployeeChange()` function that writes to `payout_audit_log` with action type `employee_compensation_changed`, capturing the field changes, effective date, and change type.

---

### Technical Details -- Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Migration SQL | Create | `employee_change_log` table with RLS policies |
| `src/hooks/useEmployeeChangeLog.ts` | Create | Hooks for reading/writing change log |
| `src/components/admin/CompensationChangeDialog.tsx` | Create | Mid-year split workflow dialog |
| `src/components/admin/EmployeeCompensationTimeline.tsx` | Create | Timeline view of compensation history |
| `src/components/admin/EmployeeFormDialog.tsx` | Modify | Add change type/reason/effective date fields; trigger split workflow |
| `src/components/admin/EmployeeAccounts.tsx` | Modify | Add "View History" action to dropdown menu |
| `src/lib/payoutEngine.ts` | Modify | Add comments confirming multi-assignment handling; add blended YTD bonus helper if needed |
| `src/lib/auditLogger.ts` | Modify | Add `logEmployeeChange()` function |
| `src/hooks/usePlanAssignments.ts` | Modify | Add `useSplitAssignment()` mutation for the split workflow |

