
## Update Audit Trail Filters to Cover All Options

### Problem
The Audit Trail filters have two issues:
1. **Actions dropdown** contains 13 entries, but only 8 actually exist in the database. Many listed actions (like "Finalized", "Paid", "Adjustment Created/Approved/Rejected") never appear in real data, cluttering the filter.
2. **Missing table mapping**: `plan_spiffs` appears in `system_audit_log` data but is not mapped in `DOMAIN_MAP` or `TABLE_LABELS`, so it would show as "System" domain with a raw table name.

### Actual actions in the database
- `INSERT`, `UPDATE`, `DELETE` (system_audit_log)
- `CREATE` (deal_audit_log)
- `created`, `updated`, `deleted`, `status_changed` (payout_audit_log)

### Changes

**File: `src/hooks/useUnifiedAuditLog.ts`**

1. **Clean up `AUDIT_ACTION_TYPES`** -- remove entries that don't exist in the database (`finalized`, `paid`, `rate_mismatch`, `adjustment_created`, `adjustment_approved`, `adjustment_rejected`) and consolidate labels for clarity:
   - `INSERT` -> "Created (System)"
   - `UPDATE` -> "Updated (System)"
   - `DELETE` -> "Deleted (System)"
   - `CREATE` -> "Created (Deal)"
   - `created` -> "Created (Payout)"
   - `updated` -> "Updated (Payout)"
   - `deleted` -> "Deleted (Payout)"
   - `status_changed` -> "Status Changed"

2. **Add `plan_spiffs`** to `DOMAIN_MAP` (mapped to "Configuration") and `TABLE_LABELS` (labeled "Plan SPIFFs").

### Technical Details
- Only `src/hooks/useUnifiedAuditLog.ts` needs editing
- Two constants updated: `AUDIT_ACTION_TYPES` (trimmed from 13 to 8 real entries) and `DOMAIN_MAP`/`TABLE_LABELS` (add `plan_spiffs`)
- No database changes required
