

## Add Proper Permissions for Payout Runs and Exchange Rates

### Problem
The "Payout Runs" and "Exchange Rates" admin tabs currently piggyback on the `tab:bulk_upload` permission, which is incorrect. This means Finance users (who should access these) are blocked, while the permission name doesn't reflect the actual feature.

### Changes

#### 1. Database: Insert new permission rows
Add `tab:payout_runs` and `tab:exchange_rates` permission keys for all 6 roles:

| Role | tab:payout_runs | tab:exchange_rates |
|------|----------------|--------------------|
| admin | true | true |
| gtm_ops | true | true |
| finance | true | true |
| executive | false | false |
| sales_head | false | false |
| sales_rep | false | false |

#### 2. Code: Update permission definitions
**File: `src/lib/permissions.ts`**
- Add two new entries to `PERMISSION_DEFINITIONS`:
  - `tab:payout_runs` -- "Manage payout run lifecycle"
  - `tab:exchange_rates` -- "Manage exchange rates"
- Add both keys to the `PermissionKey` type union

#### 3. Code: Update Admin page permission checks
**File: `src/pages/Admin.tsx`** (lines 63-64)
- Change Exchange Rates from `c.isAdmin() || c.canAccessTab("tab:bulk_upload")` to `c.canAccessTab("tab:exchange_rates")`
- Change Payout Runs from `c.isAdmin() || c.canAccessTab("tab:bulk_upload")` to `c.canAccessTab("tab:payout_runs")`

This removes the hardcoded `isAdmin()` fallback since the database permissions now handle it properly.

### Result
- Finance users will see "Exchange Rates" and "Payout Runs" tabs
- Each tab has its own permission, manageable from the Permissions UI
- No more piggybacking on unrelated permissions

