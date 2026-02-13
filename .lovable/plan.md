

## Fix: Full Deal Payout on Post-Clawback Collection

### Problem

The business rule states: "If we cannot collect within the clawback period, the entire amount due on this deal will become payable after collections, and whatever was paid will be clawed back."

The current implementation correctly claws back the booking portion. However, when a clawback-triggered deal is **eventually collected**, the system only releases the original `payout_on_collection_usd` (the held collection portion). It does NOT release the full deal amount.

After clawback, the deal effectively becomes "100% payable upon collection." The collection release should pay out the **full variable pay split** for that deal, not just the collection holdback.

### Current Flow (Broken)

1. Deal booked -- employee receives `payout_on_booking_usd` (e.g., 70%)
2. 180 days pass, not collected -- clawback triggers, -70% deducted
3. Deal eventually collected -- system releases only `payout_on_collection_usd` (e.g., 25%)
4. Result: Employee nets only 25% instead of the full 100%

### Correct Flow (After Fix)

1. Deal booked -- employee receives `payout_on_booking_usd` (e.g., 70%)
2. 180 days pass, not collected -- clawback triggers, -70% deducted
3. Deal eventually collected -- system releases the **full** `variable_pay_split_usd` (100%)
4. Clawback ledger entry marked as `recovered`
5. Result: Employee nets 100% (clawback reversed through full collection release)

### Changes

#### 1. Update `calculateCollectionReleases` in `src/lib/payoutEngine.ts`

Modify the VP release query to check if each collected deal has `is_clawback_triggered = true` in its `deal_variable_pay_attribution` records:

- If **not** clawback-triggered: release `payout_on_collection_usd` (current behavior)
- If **clawback-triggered**: release the full `variable_pay_split_usd` (booking + collection + year-end)

This ensures the employee receives the entire deal amount upon eventual collection, offsetting the earlier clawback.

#### 2. Resolve Clawback Ledger on Collection

When a clawback-triggered deal is collected and the full amount is released, update the corresponding `clawback_ledger` entry:

- Set `status` to `recovered`
- Set `recovered_amount_usd` to `original_amount_usd`
- Set `last_recovery_month` to the current payout month

This prevents the `applyClawbackRecoveries` function from double-deducting an already-resolved clawback.

#### 3. Add Notes for Audit Trail

When releasing a clawback-triggered deal's full amount, include a descriptive note on the Collection Release payout record (e.g., "Full release for clawback-reversed deal [Project ID]") so finance teams can trace the logic.

### Technical Details

**File**: `src/lib/payoutEngine.ts`

**Function**: `calculateCollectionReleases` (lines 740-783)

- Expand the `deal_variable_pay_attribution` query to also select `variable_pay_split_usd` and `is_clawback_triggered`
- After summing, for clawback-triggered deals: use `variable_pay_split_usd` instead of `payout_on_collection_usd`
- After calculating releases, query `clawback_ledger` for matching `deal_id` entries with status `pending` or `partial`, and mark them `recovered`

No database migration is needed -- all required columns and tables already exist.

