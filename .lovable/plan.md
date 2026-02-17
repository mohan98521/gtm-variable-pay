

## Clean Up All Payout Run Data

### What Will Be Deleted

1. **Payout Deal Details** -- 83 records linked to the payout run
2. **Payout Audit Log** -- All 491 entries (run lifecycle, calculation, rate usage logs)
3. **Payout Run** -- 1 record (Jan 2026, draft status, ID: `b162977c-...`)
4. **Deal Variable Pay Attribution** -- Already empty (0 records)
5. **Monthly Payouts** -- Already empty (0 records)

### Execution Order

Data will be deleted in dependency order to avoid foreign key conflicts:

1. Delete `payout_deal_details` (references payout_run_id)
2. Delete `deal_variable_pay_attribution` (references payout_run_id) -- already empty but included for safety
3. Delete `monthly_payouts` (references payout_run_id) -- already empty but included for safety
4. Delete `payout_audit_log` -- all 491 entries
5. Delete `payout_runs` -- the single Jan 2026 draft run

### No Code Changes Needed

This is a data-only cleanup. No files will be modified.

