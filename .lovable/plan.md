

## Move F&F Settlements to Finance Section

Relocate the "F&F Settlements" nav item from the **People** section to the **Finance** section, positioning it right after "Payout Runs" so that both regular and F&F payouts are grouped together.

### Changes

**File: `src/pages/Admin.tsx`**

- Remove the `fnf-settlements` entry from the `people` section's `items` array
- Add it to the `finance` section's `items` array, placed after `payout-runs`
- Remove the `UserMinus` icon import (no longer needed in People) -- it will stay since it's used for F&F in Finance

No other files need changes -- the `contentMap`, permission key, and component imports are already wired up correctly.

