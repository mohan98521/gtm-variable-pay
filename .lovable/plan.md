

## Add Deal Team SPIFF Permission and Role-Based UI Controls

### What Changes

Currently, the "Deal Team SPIFFs" tab piggybacks on the `tab:payout_runs` permission and has no granular action-level controls. This plan introduces a dedicated permission key and action permissions so Finance and GTM Ops roles can manage SPIFF allocations independently.

### 1. New Permission Keys

Add to `src/lib/permissions.ts`:

| Key | Label | Category | Description |
|---|---|---|---|
| `tab:deal_team_spiffs` | Deal Team SPIFFs | tab | Access the Deal Team SPIFF management section |
| `action:allocate_deal_spiff` | Allocate Deal SPIFF | action | Create/edit SPIFF allocations for deals |
| `action:approve_deal_spiff` | Approve Deal SPIFF | action | Approve or reject pending allocations |

### 2. Database Migration

Insert default permission rows for the three new keys, granting access to `admin`, `finance`, and `gtm_ops` roles:

- `tab:deal_team_spiffs` -- allowed for admin, finance, gtm_ops
- `action:allocate_deal_spiff` -- allowed for admin, finance, gtm_ops
- `action:approve_deal_spiff` -- allowed for admin only (CSO approval flow)

### 3. Admin Navigation Update

In `src/pages/Admin.tsx`, change the Deal Team SPIFFs nav item from:
```
permissionCheck: (c) => c.canAccessTab("tab:payout_runs")
```
to:
```
permissionCheck: (c) => c.canAccessTab("tab:deal_team_spiffs")
```

### 4. UI Permission Guards in DealTeamSpiffManager

In `src/components/admin/DealTeamSpiffManager.tsx`:

- Import `usePermissions` hook
- Use `canPerformAction("action:allocate_deal_spiff")` to show/hide the "Allocate" button and the allocation dialog's save functionality
- Use `canPerformAction("action:approve_deal_spiff")` to show/hide the "Approve" and "Reject" buttons on fully-allocated deals
- Use `canPerformAction("action:allocate_deal_spiff")` to gate the "Settings" config button
- Users without allocate permission see a read-only view (can open dialog in view mode but cannot edit)
- Users without approve permission can allocate but not approve/reject

### Summary of File Changes

| File | Change |
|---|---|
| `src/lib/permissions.ts` | Add 3 new `PermissionKey` entries and their definitions |
| Migration SQL | Insert default `role_permissions` rows for admin, finance, gtm_ops |
| `src/pages/Admin.tsx` | Switch Deal Team SPIFFs to use `tab:deal_team_spiffs` |
| `src/components/admin/DealTeamSpiffManager.tsx` | Add permission-gated UI for allocate, approve, settings actions |

