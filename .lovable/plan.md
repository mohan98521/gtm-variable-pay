

## Hide Reports: Incentive Audit, My Deals, My Closing ARR

### What Changes
Comment out (hide) three report tabs and their content panels from the Reports page so they are not visible to users. The code remains in place for future review.

### File: `src/pages/Reports.tsx`
1. **Remove 3 tab triggers** (lines 472-483): Hide the "Incentive Audit", "My Deals", and "My Closing ARR" TabsTrigger elements
2. **Remove 3 tab content panels**:
   - Incentive Audit TabsContent (lines 672-883)
   - My Deals TabsContent (lines 885-888)
   - My Closing ARR TabsContent (lines 890-893)
3. **Remove filter condition**: Update the filter bar visibility check (line 521) to only show for `employees` tab (remove the `activeTab === "audit"` condition since that tab is hidden)
4. **Clean up unused imports**: Remove `useIncentiveAuditData`, `MyDealsReport`, `MyClosingARRReport`, `Calculator`, `Briefcase`, `Database` imports and the `incentiveAuditData`/`filteredAuditData`/`exportIncentiveAudit` code that is no longer rendered

No database changes needed. Single file modified.

