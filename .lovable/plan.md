

## Fix: Default Admin Page to Employee Accounts

### Problem
When navigating to the Admin page, it defaults to Compensation Plans instead of Employee Accounts. The fallback values in the state initialization are hardcoded to `"compensation"` and `"plans"`.

### Changes

**File: `src/pages/Admin.tsx`**

Update the fallback values in the `useState` calls on lines 118-120:

- Change `"compensation"` to `"people"` (line 118)
- Change `"plans"` to `"accounts"` (line 120)
- Also update the fallback on line 127 (`resolvedActiveItem` fallback) from `"plans"` to `"accounts"`

This ensures the Admin page always opens to **Employee Accounts** under **People**, even if permissions haven't loaded yet.

