

## Fix Collection Locking, Date Display, Clawback Logic, and Carry-Forward Tracking

### Issue 1: Collection Lock is Too Restrictive

**Problem**: The database trigger `check_collection_month_lock` checks the `booking_month` of the collection record against locked payout runs. So if January payroll is finalized and locked, January-booked deals cannot have their collection status updated -- even in February. This is wrong because collections happen *after* booking.

**Fix**: Replace the trigger logic. Instead of checking if the *booking month* is locked, the trigger should allow updates to collection status at any time, *except* if the `collection_month` being set matches an already-locked payout run. In other words:
- If the user is marking a deal as collected in February (setting `collection_month = 2026-02-01`), it should succeed as long as February is not locked.
- If February is already locked/finalized, then the update is blocked.
- The booking month lock should have no bearing on collection updates.

**Database migration**: Drop and recreate `check_collection_month_lock()` function to check `NEW.collection_month` against locked runs instead of `NEW.booking_month`.

### Issue 2: Add Collection Date Column to Pending Collections Table

**Problem**: The Pending Collections table does not show a "Collection Date" column. The `collection_date` field exists in the database schema but the user needs to see and set it for payout processing.

**Fix**: The Collection Date is entered when marking a deal as collected (via the form dialog or bulk upload). The current flow already captures it. However, the payout engine uses `collection_month` (not `collection_date`) to determine which collections to release. The `collection_month` is set automatically in bulk upload but NOT in the single-record `useUpdateCollectionStatus` mutation.

**Changes**:
- Update `useUpdateCollectionStatus` hook to also compute and set `collection_month` (first of month from `collection_date`) when marking as collected.
- Update `handleQuickUpdate` in `PendingCollectionsTable` -- when quick-marking "Yes", prompt or default to today's date, and the hook will derive collection_month.
- The payout engine's `calculateCollectionReleases` already correctly queries by `collection_month`, so deals collected by end of Feb (with `collection_month = 2026-02-01`) will be included in the Feb payout run. No engine changes needed for this part.

### Issue 3: Clawback Logic Verification

**Problem**: User wants to confirm: "if we are not able to collect amount within the clawback period then entire amount due on this deal will become payable after collections and whatever amount paid will be clawed back."

**Current logic review**:
- `checkAndApplyClawbacks` finds deals where `is_collected = false` AND `first_milestone_due_date < today`.
- It claws back `payout_on_booking_usd` (the amount paid upon booking) by inserting negative `monthly_payouts` entries.
- After clawback, the deal is marked `is_clawback_triggered = true`.

**Issue**: The clawback currently uses `first_milestone_due_date` as the trigger, not a 180-day calculation from booking. Per business rules, the clawback period is 180 days from booking month end. The trigger should compare `booking_month + 180 days` (or the configured clawback period from the plan) against the current date.

**Fix**: Update `checkAndApplyClawbacks` to calculate the clawback deadline as `booking_month_end + clawback_period_days` from the employee's plan, rather than relying solely on `first_milestone_due_date`. If `first_milestone_due_date` is set, use the earlier of the two.

### Issue 4: Clawback Carry-Forward Tracking

**Problem**: Currently, a clawback is inserted as a single negative `monthly_payouts` record in the detection month. But if the employee doesn't earn enough in that month to offset the clawback, the unrecovered balance needs to carry forward to future months.

**Fix**: Create a `clawback_ledger` table to track outstanding clawback balances per employee per deal:

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| employee_id | uuid | FK to employees |
| deal_id | uuid | FK to deals |
| deal_collection_id | uuid | FK to deal_collections |
| original_amount_usd | numeric | Total clawback amount |
| recovered_amount_usd | numeric | Amount recovered so far (default 0) |
| remaining_amount_usd | numeric | Generated: original - recovered |
| status | text | 'pending', 'partial', 'recovered', 'written_off' |
| triggered_month | date | Month clawback was triggered |
| last_recovery_month | date | Last month a recovery was applied |
| created_at / updated_at | timestamps | |

**Payout engine changes**: After calculating an employee's payable amount for the month, check `clawback_ledger` for pending/partial entries. Deduct from the payable amount (up to the payable amount -- cannot go negative). Update `recovered_amount_usd` accordingly. This ensures carry-forward across months.

### Summary of Changes

| Area | File/Location | Change |
|---|---|---|
| DB Trigger | Migration SQL | Rewrite `check_collection_month_lock()` to check `collection_month` instead of `booking_month` |
| DB Table | Migration SQL | Create `clawback_ledger` table with RLS policies |
| Hook | `src/hooks/useCollections.ts` | Set `collection_month` in `useUpdateCollectionStatus` mutation |
| UI | `src/components/data-inputs/PendingCollectionsTable.tsx` | Update lock logic to not use `booking_month` lock for disabling controls |
| Engine | `src/lib/payoutEngine.ts` | Update `checkAndApplyClawbacks` to use plan clawback period; add clawback ledger integration; add carry-forward deduction logic |
| Engine | `src/lib/payoutEngine.ts` | Insert into `clawback_ledger` when clawback triggered; check ledger during payout calculation |

