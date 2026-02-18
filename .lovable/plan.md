

## Hide Currency Breakdown Report

### What Changes
Remove the Currency Breakdown tab and its content from the Reports page. The component file remains untouched for future use.

### File: `src/pages/Reports.tsx`

1. **Remove the TabsTrigger** (around line 437-440): Delete the "Currency" tab trigger with the Globe icon
2. **Remove the TabsContent** (lines 625-628): Delete the `<TabsContent value="currency">` block containing `<CurrencyBreakdown />`
3. **Clean up unused imports**: Remove `CurrencyBreakdown` import (line 19) and `Globe` icon import if not used elsewhere

Single file change. No database modifications needed.
