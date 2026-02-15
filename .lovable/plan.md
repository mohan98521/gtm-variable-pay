

## Rename Two Columns in Detailed Workings

Rename the column headers in the Detailed Workings table:

| Current Name | New Name |
|---|---|
| Prior Paid | Eligible Till Last Month (USD) |
| This Month | Incremental Eligible in the Month (USD) |

### Technical Details

**File:** `src/components/admin/PayoutRunWorkings.tsx`

- Update the table header labels (lines ~112-113)
- Update the `SubtotalRow` and Grand Total row references to use the new column names consistently
- No changes to data, hooks, or database required

