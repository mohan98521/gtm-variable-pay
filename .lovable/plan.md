

## Grant `tab:support_teams` Permission

### What needs to happen

A database migration will insert 6 rows into the `role_permissions` table -- one for each existing role -- to control access to the Support Teams admin tab:

| Role | Permission Key | Allowed |
|------|---------------|---------|
| admin | tab:support_teams | Yes |
| finance | tab:support_teams | Yes |
| gtm_ops | tab:support_teams | Yes |
| executive | tab:support_teams | No |
| sales_head | tab:support_teams | No |
| sales_rep | tab:support_teams | No |

### Technical Details

- Single SQL migration using `INSERT ... ON CONFLICT DO NOTHING` to safely handle re-runs
- After this migration runs, users with **admin**, **finance**, or **gtm_ops** roles will immediately see the "Support Teams" tab in the Admin page
- No code changes needed -- the UI already checks `tab:support_teams` via the permissions system

