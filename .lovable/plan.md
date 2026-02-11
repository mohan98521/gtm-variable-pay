

## Comprehensive Audit Trail System

### Current State

The system currently captures audit trails for **5 of 12+ key data domains**:

| Domain | Audited? | Mechanism | Log Table |
|--------|----------|-----------|-----------|
| Deals | Yes | DB trigger (`log_deal_changes`) | `deal_audit_log` |
| Monthly Payouts | Yes | DB trigger (`log_payout_change`) | `payout_audit_log` |
| Deal Collections | Yes | DB trigger (`log_collection_change`) | `payout_audit_log` |
| Payout Runs | Yes | DB trigger (`log_payout_run_change`) | `payout_audit_log` |
| Payout Adjustments | Yes | DB trigger (`log_adjustment_change`) | `payout_audit_log` |
| Rate Usage / Mismatches | Yes | Programmatic (`auditLogger.ts`) | `payout_audit_log` |
| Employees | **No** | - | - |
| Comp Plans | **No** | - | - |
| Plan Metrics / Multipliers | **No** | - | - |
| Performance Targets | **No** | - | - |
| Exchange Rates | **No** | - | - |
| Closing ARR | **No** | - | - |
| Plan Assignments | **No** | - | - |
| User Roles | **No** | - | - |

The existing UI (`AuditTrailExport`) only shows `payout_audit_log` and doesn't display `deal_audit_log` entries at all.

---

### What We'll Build

#### Phase 1: Expand Audit Coverage (Database)

Create a unified `system_audit_log` table and add DB triggers for all currently unaudited tables:

**New table: `system_audit_log`**
- `id`, `table_name`, `record_id`, `action` (INSERT/UPDATE/DELETE)
- `old_values` (jsonb), `new_values` (jsonb)
- `changed_by` (uuid), `changed_at` (timestamptz)
- `is_retroactive` (boolean), `reason` (text)

**New triggers on:**
- `employees` -- track all master data changes (compensation, role, status, departure)
- `comp_plans` -- track plan creation, updates, deactivation
- `plan_metrics` -- track metric weightage, logic type changes
- `multiplier_grids` -- track multiplier band changes
- `performance_targets` -- track target value changes
- `exchange_rates` -- track rate updates
- `closing_arr_actuals` -- track ARR data changes
- `user_targets` (plan assignments) -- track assignment changes
- `user_roles` -- track role grants/revocations

Each trigger captures the full OLD and NEW row as JSONB, the acting user, and a table identifier.

#### Phase 2: Unified Audit Log UI (New Dedicated Page)

Replace the existing basic `AuditTrailExport` tab with a comprehensive, auditor-grade interface accessible from the Admin section or Reports.

**2a. Dashboard Summary Cards**
- Total events today / this week / this month
- Breakdown by domain (Deals, Payouts, Config, Master Data)
- Rate mismatch alerts count
- Retroactive change alerts count

**2b. Unified Timeline View**
Merge all three log sources (`deal_audit_log`, `payout_audit_log`, `system_audit_log`) into a single chronological timeline with:
- Color-coded domain badges (Deals = blue, Payouts = green, Config = orange, Master Data = purple)
- Expandable row detail showing full old/new values diff
- "Who changed what, when, and why" at a glance

**2c. Rich Filtering**
- **Date range** picker (not just month dropdown)
- **Domain** filter: Deals, Payouts, Collections, Adjustments, Employees, Plans, Rates, Targets, Roles
- **Action** filter: Created, Updated, Deleted, Status Changed, Rate Mismatch, etc.
- **Employee** filter (searchable)
- **User** filter (who made the change)
- **Retroactive only** toggle
- **Rate mismatches only** toggle

**2d. Detail Panel / Expandable Rows**
When an auditor clicks a row, show:
- Side-by-side diff of old vs new values (changed fields highlighted)
- Full JSON for old/new values
- Related audit entries (e.g., same deal, same payout run)
- User who made the change (resolved name)

**2e. Export**
- Export filtered results to XLSX with all columns
- Separate sheets per domain option

---

### Technical Details

**Database Migration:**
1. Create `system_audit_log` table with RLS (viewable by admin, finance, gtm_ops, executive)
2. Create a reusable `log_system_change()` trigger function that accepts the table name
3. Attach triggers to all 9 unaudited tables
4. Add indexes on `(table_name, changed_at)` and `(changed_by)` for performance

**New/Modified Files:**
- `src/hooks/useUnifiedAuditLog.ts` -- new hook that queries all 3 audit tables and merges them chronologically
- `src/components/audit/AuditDashboard.tsx` -- new: summary cards + unified timeline
- `src/components/audit/AuditTimeline.tsx` -- new: merged timeline table with expandable rows
- `src/components/audit/AuditDetailPanel.tsx` -- new: old/new value diff viewer
- `src/components/audit/AuditFilters.tsx` -- new: rich filtering bar
- `src/components/reports/AuditTrailExport.tsx` -- updated to use the new unified components
- `src/pages/Reports.tsx` -- update the Audit Trail tab to use the new `AuditDashboard`

**Data Flow:**
```text
deal_audit_log ----\
payout_audit_log ---+---> useUnifiedAuditLog() ---> AuditDashboard
system_audit_log --/         (merge + sort)         (summary + timeline + filters)
```

**Diff Viewer Logic:**
Compare `old_values` and `new_values` JSONB objects key-by-key, highlight fields that changed, show human-readable field labels instead of raw column names.
