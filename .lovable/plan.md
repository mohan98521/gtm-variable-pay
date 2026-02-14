

## Remove Unused Participant Roles and Rename Solution Manager

### Overview
Simplify the Deal Form by removing 3 participant fields (Product Specialist, Product Specialist Head, Solution Manager Head) and relabeling "Solution Manager" to "Solution Manager ID". The support team toggles for Sales Engineering and Solution Manager already exist and will remain.

### Changes

**1. File: `src/components/data-inputs/DealFormDialog.tsx` -- Remove fields and relabel**

- Remove the "Product Specialist" form field (lines 870-894)
- Remove the "Product Specialist Head" form field (lines 895-919)
- Remove the "Solution Manager Head" form field (lines 971-995)
- Relabel "Solution Manager" to "Solution Manager ID" in the team/individual toggle section
- Remove the corresponding default values in form.reset() for the removed fields (set them to empty/undefined so they are not submitted)
- Clean up the `onSubmit` function to stop building names for removed fields (`productSpecialistName`, `productSpecialistHeadName`, `solutionManagerHeadName`)

**2. File: `src/hooks/useDeals.ts` -- Update PARTICIPANT_ROLES constant**

Remove from `PARTICIPANT_ROLES`:
- `product_specialist`
- `product_specialist_head`
- `solution_manager_head`

Keep: `sales_rep`, `sales_head`, `sales_engineering`, `sales_engineering_head`, `product_specialist` (removing), `solution_manager`

Updated list:
```
sales_rep, sales_head, sales_engineering, sales_engineering_head, solution_manager
```

**3. File: `src/hooks/useSupportTeams.ts` -- Update TEAM_ROLES constant**

Remove from `TEAM_ROLES`:
- `product_specialist`
- `product_specialist_head`
- `solution_manager_head`

**4. File: `src/components/data-inputs/DealsBulkUpload.tsx` -- Update template and mapping**

- Remove `product_specialist_id`, `product_specialist_head_id`, `solution_manager_head_id` from the CSV template columns and field mapping
- Update the template example rows accordingly

**5. File: `src/components/data-inputs/DealsTable.tsx` -- Remove table columns**

- Remove Product Specialist, Product Specialist Head, and Solution Manager Head columns from the deals table display

### What is NOT changing
- The database columns remain untouched (they will simply be empty/null for new deals)
- Existing deals with data in these fields keep their data
- The Solution Manager field retains its full team/individual toggle functionality -- only the label changes to "Solution Manager ID"
- Sales Rep, Sales Head, Sales Engineering (with team toggle), Sales Engineering Head all stay as-is
- Attribution logic in `useMyDealsWithIncentives.ts`, `useTeamCompensation.ts`, and `fnfEngine.ts` will continue to work (they read whatever is stored in the DB columns)

