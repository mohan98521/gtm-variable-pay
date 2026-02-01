

## Add Performance Targets Permission to Database

### Current Status

The Performance Targets Management UI has been implemented, but the `tab:performance_targets` permission needs to be added to the `role_permissions` table for admin and gtm_ops roles.

### Required Database Change

Insert two records into the `role_permissions` table:

| Role | Permission Key | Is Allowed |
|------|---------------|------------|
| admin | tab:performance_targets | true |
| gtm_ops | tab:performance_targets | true |

### Implementation

Create a database migration to insert these permission records:

```sql
INSERT INTO role_permissions (role, permission_key, is_allowed)
VALUES 
  ('admin', 'tab:performance_targets', true),
  ('gtm_ops', 'tab:performance_targets', true)
ON CONFLICT (role, permission_key) DO NOTHING;
```

This will:
1. Add the permission for admin users to see the Performance Targets tab
2. Add the permission for gtm_ops users to see the Performance Targets tab
3. Use `ON CONFLICT DO NOTHING` to avoid errors if the records already exist

### Result

After this migration runs, users with admin or gtm_ops roles will be able to see and access the Performance Targets tab in the Admin section.

