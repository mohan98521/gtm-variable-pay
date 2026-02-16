

## Rearrange Admin Navigation Order

### What Changes

Reorder the top-level section tabs in the Admin page from the current order (Compensation, People, Finance, System) to:

1. **People**
2. **Compensation**
3. **Finance**
4. **System**

### Technical Details

**File modified:** `src/pages/Admin.tsx`

Simply reorder the `sections` array so the "people" section comes first, followed by "compensation", "finance", and "system". No other changes needed -- all items, icons, and permission checks remain the same.

