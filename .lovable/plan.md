

## Add Employee List Export

### Overview
Add an "Export" button to the Employee Accounts header that downloads the current employee list (active or inactive, filtered by search) as an Excel (.xlsx) file.

### Changes

**File: `src/components/admin/EmployeeAccounts.tsx`**

1. Import `Download` icon from lucide-react and the `generateXLSX`/`downloadXLSX` utilities from `src/lib/xlsxExport.ts`
2. Add an "Export" button next to the existing action buttons (before "Add Staff User")
3. The export will:
   - Use the currently displayed (filtered) employee list
   - Include columns: Employee ID, Name, Email, Designation, Sales Function, Department, Region, Business Unit, Group, Country, City, Date of Hire, Departure Date, Local Currency, Manager ID, Employee Role, Incentive Type, Target Bonus %, TFP (Local), TVP (Local), OTE (Local), TFP (USD), TVP (USD), OTE (USD), Account Status, Active Status
   - File named `employees_active.xlsx` or `employees_inactive.xlsx` based on current tab

### Technical Details

| Aspect | Detail |
|--------|--------|
| File modified | `src/components/admin/EmployeeAccounts.tsx` |
| Utilities reused | `generateXLSX`, `downloadXLSX` from `src/lib/xlsxExport.ts` |
| No database changes | Purely a frontend feature |

