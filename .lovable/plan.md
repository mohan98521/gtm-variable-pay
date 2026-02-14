

## Clean All Actuals Data for Fresh Manual Testing

### What Will Be Deleted

All transactional/actuals data will be purged in the correct order (child tables first to respect foreign keys):

1. **deal_variable_pay_attribution** (59 rows) -- depends on deals & monthly_payouts
2. **clawback_ledger** (0 rows) -- depends on deals
3. **deal_collections** (22 rows) -- depends on deals
4. **deal_participants** (0 rows) -- depends on deals
5. **monthly_payouts** (9 rows) -- depends on payout_runs
6. **payout_adjustments** (0 rows) -- depends on payout_runs
7. **payout_runs** (1 row)
8. **deals** (22 rows)
9. **closing_arr_actuals** (12 rows)
10. **fnf_settlements** (0 rows)

### What Will NOT Be Touched

All configuration/setup data remains intact:
- Compensation plans, commissions, metrics, spiffs
- Employee profiles and plan assignments
- Performance targets
- Currencies and exchange rates
- Roles and permissions

### Navigation

After cleanup, the Data Inputs page month selector will be set to **January** of the current fiscal year so you can start fresh.

### Technical Details

A single database migration will execute `TRUNCATE ... CASCADE` on the parent tables, which automatically clears dependent child rows in one operation. This is the safest and fastest approach.

