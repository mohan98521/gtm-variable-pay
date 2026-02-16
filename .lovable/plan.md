

## Remove "Att. %" Column from Top Performers Table

### What Changes

The "Att. %" (Attainment %) column in the Top 5 Performers table on the Executive Dashboard is redundant since it duplicates the "Software %" column (both are based on Software ARR achievement). Removing it simplifies the table.

### Technical Details

**File: `src/components/executive/TopPerformers.tsx`**

- Remove the `<TableHead>` for "Att. %" from the header row
- Remove the corresponding `<TableCell>` rendering `p.attainmentPct` from each data row
- Update the empty-state `colSpan` from 7 to 6

No changes needed to the hook or data model -- the `attainmentPct` field can remain in the interface for potential use elsewhere.

### Files Modified
- `src/components/executive/TopPerformers.tsx`

