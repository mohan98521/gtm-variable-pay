

## Remove "Total Projects" Card from Closing ARR Summary

### Change

Remove the first summary card ("Total Projects") from the Closing ARR section on the Data Inputs page. The "Eligible Projects" card already shows the total as a denominator (e.g., "14 / 20"), so the standalone total is redundant.

### File: `src/components/data-inputs/ClosingARRSummary.tsx`

- Delete lines 62-75 (the "Total Projects" Card block)
- Update the grid from `lg:grid-cols-7` to `lg:grid-cols-6` since there will be one fewer card
- Remove the unused `FileSpreadsheet` import if no longer referenced

