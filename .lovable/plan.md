

## Audit Trail Gap Analysis and Fix

### Current State
The audit trail covers 10 tables via the `system_audit_log` trigger, plus deals and payouts via their own dedicated audit tables. However, several important areas are missing database-level audit triggers.

### Tables Missing Audit Coverage

| Area | Table(s) Missing | Priority |
|---|---|---|
| Support Tagging | `support_teams`, `support_team_members` | High |
| Sales Function Design | `sales_functions` | High |
| System Admin - Roles | `roles` | High |
| System Admin - Permissions | `role_permissions` | High |
| Comp Plans - Commissions | `plan_commissions` | High |
| Comp Plans - Structures | `commission_structures` | Medium |
| Comp Plans - Renewal Multipliers | `closing_arr_renewal_multipliers` | Medium |
| Deal SPIFFs | `deal_team_spiff_config`, `deal_team_spiff_allocations` | High |
| F&F Settlements | `fnf_settlements`, `fnf_settlement_lines` | High |
| Deal Participants | `deal_participants` | Medium |
| Closing ARR Targets | `closing_arr_targets` | Medium |
| Quarterly Targets | `quarterly_targets` | Medium |
| Currencies | `currencies` | Low |

### Changes

#### 1. Database Migration -- Add audit triggers for all missing tables

A single migration will attach the existing `log_system_change()` trigger function to all 15 missing tables:

- `support_teams`
- `support_team_members`
- `sales_functions`
- `roles`
- `role_permissions`
- `plan_commissions`
- `commission_structures`
- `closing_arr_renewal_multipliers`
- `deal_team_spiff_config`
- `deal_team_spiff_allocations`
- `fnf_settlements`
- `fnf_settlement_lines`
- `deal_participants`
- `closing_arr_targets`
- `quarterly_targets`
- `currencies`

Each trigger follows the same pattern already used for the existing 10 tables:
```sql
CREATE TRIGGER audit_<table_name>
  AFTER INSERT OR UPDATE OR DELETE ON public.<table_name>
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
```

#### 2. Update Unified Audit Log Hook (`src/hooks/useUnifiedAuditLog.ts`)

Expand the `DOMAIN_MAP` and `TABLE_LABELS` constants to recognize the new tables so they display correctly in the Audit Dashboard:

- Support teams/members -> "Configuration" domain
- Sales functions -> "Configuration" domain
- Roles, role_permissions -> "Access Control" domain (new domain)
- Plan commissions, commission_structures, renewal multipliers -> "Configuration" domain
- Deal SPIFF config/allocations -> "Payouts" domain
- F&F settlements/lines -> "Payouts" domain
- Deal participants -> "Deals" domain
- Closing ARR targets, quarterly targets -> "Configuration" domain
- Currencies -> "Configuration" domain

Also add "Access Control" to the `AUDIT_DOMAINS` list and `getDomainColor` function.

#### 3. No other changes needed
The `log_system_change()` trigger function is already generic -- it captures table name, record ID, action, old/new JSONB values, and the acting user. No modification is needed.

### Summary of coverage after fix

All 26+ core tables will have full INSERT/UPDATE/DELETE audit logging, ensuring complete traceability across:
- Employee master data
- Role mapping and permission changes
- Support team tagging
- Sales function design
- Comp plans (metrics, commissions, multipliers, SPIFFs)
- Performance and quarterly targets
- Data inputs (deals, closing ARR)
- F&F settlements
- Deal team SPIFFs
- Currency and exchange rate configuration
