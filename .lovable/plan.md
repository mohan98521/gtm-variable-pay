

## Full & Final (F&F) Settlement Workflow for Departed Employees

### Overview

Build a two-tranche F&F settlement system that runs at the individual employee level, separate from regular monthly payout runs. Admin/Finance users manually initiate F&F for departed employees, and the system handles immediate settlement (Tranche 1) and post-90-day collection reconciliation (Tranche 2).

### How It Works

**Tranche 1 -- Immediate at Departure:**
- Release all accumulated "At Year End" reserves in full
- Calculate and settle pro-rated bonus (VP) for the partial year up to departure date
- Settle clawback ledger balances (deduct outstanding clawbacks from payout; if payout is insufficient, carry forward remaining balance to Tranche 2)
- Hold "Upon Collection" amounts -- these are NOT released in Tranche 1

**Tranche 2 -- After 90 Days:**
- Check all pending "Upon Collection" holdbacks for deals attributed to this employee
- Release collection holdbacks for deals that WERE collected within 90 days of departure
- Forfeit collection holdbacks for deals NOT collected within 90 days
- Apply any remaining clawback carry-forward from Tranche 1 (deduct from Tranche 2 releases)
- If still unrecovered clawback remains after Tranche 2, it is written off

**Approval Workflow:** Both tranches follow the same lifecycle as regular payout runs: Draft > Review > Approved > Finalized > Paid

---

### Database Changes

**New table: `fnf_settlements`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated |
| employee_id | text | References employees.employee_id |
| departure_date | date | Employee's last working day |
| fiscal_year | integer | The fiscal year of settlement |
| collection_grace_days | integer (default 90) | Configurable grace period |
| tranche1_status | text | draft / review / approved / finalized / paid |
| tranche1_total_usd | numeric | Calculated Tranche 1 total |
| tranche1_calculated_at | timestamptz | When Tranche 1 was calculated |
| tranche1_finalized_at | timestamptz | When Tranche 1 was finalized |
| tranche2_status | text | pending / draft / review / approved / finalized / paid |
| tranche2_eligible_date | date | departure_date + grace_days |
| tranche2_total_usd | numeric | Calculated Tranche 2 total |
| tranche2_calculated_at | timestamptz | When Tranche 2 was calculated |
| tranche2_finalized_at | timestamptz | When Tranche 2 was finalized |
| notes | text | Optional notes |
| created_by | uuid | User who initiated |
| created_at / updated_at | timestamptz | Timestamps |

**New table: `fnf_settlement_lines`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated |
| settlement_id | uuid | FK to fnf_settlements |
| tranche | integer | 1 or 2 |
| line_type | text | year_end_release, vp_settlement, commission_settlement, collection_release, collection_forfeit, clawback_deduction, clawback_carryforward |
| payout_type | text | Original payout type (Variable Pay, Managed Services, etc.) |
| amount_usd | numeric | Amount in USD |
| amount_local | numeric | Amount in local currency |
| local_currency | text | Currency code |
| exchange_rate_used | numeric | Rate used for conversion |
| deal_id | uuid | Related deal (if applicable) |
| source_payout_id | uuid | Reference to original monthly_payouts record |
| notes | text | Description |
| created_at | timestamptz | Timestamp |

RLS policies will mirror existing payout tables -- authenticated users with admin/finance/gtm_ops roles can read/write.

---

### Engine Logic (src/lib/fnfEngine.ts)

**Tranche 1 Calculation:**
1. Fetch employee's departure_date and compensation data
2. Sum all `year_end_amount_usd` from `monthly_payouts` for the fiscal year -- create a "Year-End Release" line
3. Calculate pro-rated VP settlement: Run the same incremental VP logic but capped at the departure month, then create a "VP Settlement" line for any remaining amount
4. Sum outstanding `clawback_ledger` entries (status = pending/partial) -- create a "Clawback Deduction" line
5. If clawback exceeds payout, store the shortfall as a carry-forward amount
6. Identify all "Upon Collection" holdbacks (from `monthly_payouts` where `collection_amount_usd > 0`) -- these are NOT released but tracked for Tranche 2

**Tranche 2 Calculation:**
1. Check if current date >= tranche2_eligible_date (departure + 90 days)
2. For each deal with pending collection holdbacks attributed to this employee:
   - If `deal_collections.is_collected = true` AND `collection_date <= departure_date + 90 days`: create a "Collection Release" line
   - Otherwise: create a "Collection Forfeit" line (amount = 0, recorded for audit)
3. Deduct any clawback carry-forward from Tranche 1
4. Calculate net Tranche 2 payout

---

### UI Components

**1. F&F Settlements Tab (Admin page)**
- New tab under People category: "F&F Settlements" with permission key `tab:fnf_settlements`
- Lists all F&F settlements with employee name, departure date, Tranche 1 status, Tranche 2 status, amounts
- "Initiate F&F" button opens a dialog to select a departed (inactive) employee

**2. Initiate F&F Dialog**
- Dropdown showing only inactive employees with a departure_date set
- Pre-fills departure date and fiscal year
- Editable "Collection Grace Period" field (default: 90 days)
- Optional notes field

**3. F&F Settlement Detail View**
- Two sections: Tranche 1 and Tranche 2
- Each section shows line-item breakdown (year-end releases, VP settlement, clawback deductions, collection releases/forfeits)
- Summary cards showing totals per tranche
- Action buttons following the same workflow: Calculate > Review > Approve > Finalize > Mark as Paid
- Tranche 2 section shows "Eligible after [date]" badge and becomes actionable only after the grace period expires

---

### Hooks

- `src/hooks/useFnfSettlements.ts` -- CRUD operations, status transitions, and calculation triggers for F&F settlements

---

### Permissions

Insert `tab:fnf_settlements` permission for all roles:
- `admin`, `finance`, `gtm_ops`: allowed
- `executive`, `sales_head`, `sales_rep`: not allowed

---

### Files to Create/Modify

| Action | File | Purpose |
|--------|------|---------|
| Create | `supabase/migrations/...fnf_settlements.sql` | New tables + RLS + permissions |
| Create | `src/lib/fnfEngine.ts` | Tranche 1 and Tranche 2 calculation logic |
| Create | `src/hooks/useFnfSettlements.ts` | React Query hooks for F&F CRUD and calculations |
| Create | `src/components/admin/FnFSettlementManagement.tsx` | List view + initiate dialog |
| Create | `src/components/admin/FnFSettlementDetail.tsx` | Detail view with line items and workflow actions |
| Modify | `src/pages/Admin.tsx` | Add F&F Settlements tab |
| Modify | `src/lib/permissions.ts` | Add `tab:fnf_settlements` permission key |

