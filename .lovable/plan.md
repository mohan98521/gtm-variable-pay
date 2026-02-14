

## Fix F&F Settlement Engine Gaps

Six targeted fixes to bring the F&F engine to parity with the regular payout engine.

---

### 1. Fix Fiscal Year Range (April-March to Jan-Dec)

**Problem**: `fnfEngine.ts` uses `${fiscalYear}-04-01` to `${fiscalYear+1}-03-31` but the system uses calendar year (Jan-Dec).

**Fix**: Change both `calculateTranche1` and `calculateTranche2` to use `${fiscalYear}-01-01` and `${fiscalYear}-12-31`, matching `payoutEngine.ts`.

---

### 2. Fix Employee Lookup (profiles to employees table)

**Problem**: `FnFSettlementManagement.tsx` imports `useProfiles()` which queries the `profiles` table. The `profiles` table does NOT have `is_active` or `departure_date` fields -- those live on the `employees` table.

**Fix**: 
- Replace `useProfiles()` with a direct query to `employees` table (or reuse existing employee hooks)
- Filter on `employees.is_active = false` and `employees.departure_date IS NOT NULL`
- Use `employees.full_name` and `employees.employee_id` for display and mapping

**Files**: `src/components/admin/FnFSettlementManagement.tsx`

---

### 3. Add Pro-Rated VP Settlement in Tranche 1

**Problem**: Tranche 1 only releases year-end reserves and clawbacks. It does NOT calculate or settle the pro-rated Variable Pay earned up to the departure date.

**Fix**: Add a new section in `calculateTranche1` that:
1. Fetches the employee's plan assignment (`user_targets` + `comp_plans`)
2. Fetches plan metrics and multiplier grids
3. Calculates YTD Variable Pay using the same incremental logic as `payoutEngine.ts` (achievement x multiplier x bonus allocation)
4. Pro-rates by days worked (Jan 1 to departure_date out of 365)
5. Subtracts all prior finalized monthly VP payouts from `monthly_payouts`
6. Creates a `vp_settlement` line for the remaining unsettled VP amount

---

### 4. Add Commission Settlement Lines in Tranche 1

**Problem**: Commissions earned in the departure month (or any unsettled booking-portion commissions) are not included.

**Fix**: Add commission settlement logic in `calculateTranche1` that:
1. Fetches all finalized commission payouts from `monthly_payouts` where `payout_type` starts with commission types
2. Sums year-end reserves from commission records (already handled by `year_end_release`)
3. No additional work needed since commission year-end reserves are already captured by the existing year-end release query -- commissions follow the same `monthly_payouts` persistence. The existing code already picks up commission year-end amounts. Add a note clarifying this in the code.

---

### 5. Add NRR and SPIFF Settlement Lines in Tranche 1

**Problem**: NRR Additional Pay and SPIFF year-end reserves and unsettled amounts are not explicitly handled.

**Fix**: The existing year-end release query already captures ALL payout types (Variable Pay, NRR Additional Pay, SPIFF, commissions) from `monthly_payouts` since it filters on `year_end_amount_usd > 0` without filtering by `payout_type`. This is actually correct. Add explicit comments confirming coverage.

For pro-rated NRR/SPIFF settlement (amounts earned but not yet paid):
1. Sum all prior finalized NRR payouts, calculate YTD NRR using the same formula as `payoutEngine.ts`, create a `nrr_settlement` line for the delta
2. Similarly for SPIFFs: sum prior finalized SPIFF payouts, calculate YTD SPIFF, create a `spiff_settlement` line

---

### 6. Add Duplicate Prevention on Re-Calculation

**Problem**: While `clearTrancheLines` exists, the hooks already call it before recalculating. However, there's no guard against concurrent re-calculations or status-based guards.

**Fix**: Add a status guard in the mutation hooks:
- Before calculating Tranche 1: verify `tranche1_status` is `draft` or `review` (not `approved`/`finalized`/`paid`)
- Before calculating Tranche 2: verify `tranche2_status` is `draft` or `review`
- Throw an error if the tranche is already finalized/paid to prevent accidental overwrites

**Files**: `src/hooks/useFnfSettlements.ts`

---

### 7. Add Audit Logging for F&F Status Changes

**Problem**: Status transitions (draft to review to approved to finalized to paid) are not logged to the `payout_audit_log`.

**Fix**: Add audit log entries in:
- `useCalculateTranche1` / `useCalculateTranche2`: log `fnf_tranche_calculated` after successful calculation
- `useUpdateTrancheStatus`: log `fnf_status_changed` with old/new status

Use the existing `payout_audit_log` table with new action types, or use `system_audit_log` for consistency with other status-change audits. Since `payout_audit_log` already has the right schema (action, entity_type, metadata), we will add F&F-specific actions there.

**Files**: `src/hooks/useFnfSettlements.ts`, `src/lib/auditLogger.ts` (add new `logFnfEvent` function)

---

### Technical Details -- Files to Modify

| File | Changes |
|------|---------|
| `src/lib/fnfEngine.ts` | Fix fiscal year to Jan-Dec; add `calculateVpSettlement()`, `calculateNrrSettlement()`, `calculateSpiffSettlement()` helpers called from `calculateTranche1`; add clarifying comments for commission/NRR/SPIFF year-end coverage |
| `src/hooks/useFnfSettlements.ts` | Add status guards before calculation; add audit logging calls; fix imports |
| `src/components/admin/FnFSettlementManagement.tsx` | Replace `useProfiles()` with employees table query; fix `is_active`/`departure_date` filtering |
| `src/lib/auditLogger.ts` | Add `logFnfEvent()` function for F&F audit entries |

