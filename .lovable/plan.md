
# My Actuals Reports: Deals and Closing ARR

## Overview
Build two new report tabs on the Reports page for all users to view the actual deal and Closing ARR records being used in their incentive computations. Both reports will include:
- Month filter with "Full Year" as default
- All fields captured in the bulk upload
- Export to both CSV and XLSX formats
- For Closing ARR: an "Eligible" column showing which records count toward achievement

---

## Solution Architecture

### New Files to Create

**1. `src/hooks/useMyActualsData.ts`**
A hook to fetch actual deal and closing ARR records for the current user:
- `useMyDeals(selectedMonth)` - Returns full deal records where user is ANY participant (8 roles)
- `useMyClosingARR(selectedMonth)` - Returns full closing ARR records with eligibility flag

**2. `src/components/reports/MyDealsReport.tsx`**
A table component showing all deals for the current user including:
- Month filter (Full Year + individual months)
- All deal fields from bulk upload (approx 30 columns)
- Export CSV and XLSX buttons
- Summary row showing totals

**3. `src/components/reports/MyClosingARRReport.tsx`**
A table component showing all Closing ARR records including:
- Month filter (Full Year + individual months)
- All Closing ARR fields from bulk upload (approx 28 columns)
- Eligible Closing ARR column (calculated: end_date > Dec 31, fiscal year)
- Export CSV and XLSX buttons
- Summary showing Total vs Eligible Closing ARR

**4. `src/lib/xlsxExport.ts`**
A utility for exporting data to XLSX format (Excel):
- Uses existing `xlsx` library already installed
- Companion to existing `csvExport.ts`

---

## Technical Details

### File 1: `src/lib/xlsxExport.ts`

```typescript
import * as XLSX from "xlsx";

export function generateXLSX<T>(
  data: T[],
  columns: { key: keyof T | string; header: string; getValue?: (row: T) => string | number | null }[],
  sheetName: string = "Data"
): Blob {
  // Convert data to array of arrays with headers
  const headers = columns.map(col => col.header);
  const rows = data.map(row => 
    columns.map(col => col.getValue ? col.getValue(row) : row[col.key as keyof T] ?? "")
  );
  
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadXLSX(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
```

### File 2: `src/hooks/useMyActualsData.ts`

```typescript
// All 8 participant role columns
const PARTICIPANT_ROLES = [
  'sales_rep_employee_id',
  'sales_head_employee_id',
  'sales_engineering_employee_id',
  'sales_engineering_head_employee_id',
  'product_specialist_employee_id',
  'product_specialist_head_employee_id',
  'solution_manager_employee_id',
  'solution_manager_head_employee_id',
] as const;

export function useMyDeals(selectedMonth: string | null) {
  // Fetch current user's employee_id
  // Query ALL deal columns for fiscal year
  // Client-side filter for records where user is ANY participant
  // If selectedMonth provided, filter to that month only
  // Return full deal records
}

export function useMyClosingARR(selectedMonth: string | null) {
  // Fetch current user's employee_id
  // Query ALL closing_arr_actuals columns with sales_rep OR sales_head attribution
  // No eligibility filter at query level (we show all, flag eligible ones)
  // If selectedMonth provided, filter to that month only
  // Return full records with calculated 'isEligible' flag
}
```

### File 3: `src/components/reports/MyDealsReport.tsx`

Structure:
- Card with header "My Deals (Actuals)"
- Month filter dropdown: "Full Year" (default) + 12 individual months
- Horizontal scroll table with all deal columns:
  - Project ID, Customer Code, Customer Name, Region, Country
  - BU, Product, Type of Proposal, Month
  - First Year AMC (USD), First Year Subscription (USD), New Software Booking ARR (USD)
  - Managed Services (USD), Implementation (USD), CR (USD), ER (USD)
  - TCV (USD), Perpetual License (USD), GP Margin %
  - Sales Rep Name/ID, Sales Head Name/ID
  - SE Name/ID, SE Head Name/ID
  - Product Specialist Name/ID, Product Specialist Head Name/ID
  - Solution Manager Name/ID, Solution Manager Head Name/ID
  - Status, Notes
- Footer summary: Total ARR
- Export buttons: CSV and XLSX

### File 4: `src/components/reports/MyClosingARRReport.tsx`

Structure:
- Card with header "My Closing ARR (Actuals)"
- Month filter dropdown: "Full Year" (default) + 12 individual months
- Note explaining eligibility: "Records with End Date > Dec 31, {fiscalYear} are eligible for achievement"
- Horizontal scroll table with all columns:
  - Month, BU, Product, PID, Customer Code, Customer Name
  - Order Category, Status, Order Category 2
  - Opening ARR, CR, ALS+Others, New, Inflation
  - Discount/Decrement, Churn, Adjustment, Closing ARR
  - Country, Revised Region, Start Date, End Date, Renewal Status
  - Sales Rep Employee ID, Sales Rep Name
  - Sales Head Employee ID, Sales Head Name
  - **Eligible Closing ARR** (new column: Closing ARR if eligible, 0 if not)
  - **Eligible** (Yes/No indicator)
- Footer summary: Total Closing ARR and Eligible Closing ARR
- Export buttons: CSV and XLSX

### File 5: Update `src/pages/Reports.tsx`

Add two new tabs to the existing TabsList:
- "My Deals" with Briefcase icon
- "My Closing ARR" with Database icon

Add corresponding TabsContent sections using the new components.

---

## Column Specifications

### Deals Report Columns (All Bulk Upload Fields)

| Column | Header | Source |
|--------|--------|--------|
| project_id | Project ID | deal.project_id |
| customer_code | Customer Code | deal.customer_code |
| customer_name | Customer Name | deal.customer_name |
| region | Region | deal.region |
| country | Country | deal.country |
| bu | Business Unit | deal.bu |
| product | Product | deal.product |
| type_of_proposal | Type of Proposal | deal.type_of_proposal |
| month_year | Month | deal.month_year |
| first_year_amc_usd | First Year AMC (USD) | deal.first_year_amc_usd |
| first_year_subscription_usd | First Year Subscription (USD) | deal.first_year_subscription_usd |
| new_software_booking_arr_usd | New Software Booking ARR (USD) | deal.new_software_booking_arr_usd |
| managed_services_usd | Managed Services (USD) | deal.managed_services_usd |
| implementation_usd | Implementation (USD) | deal.implementation_usd |
| cr_usd | CR (USD) | deal.cr_usd |
| er_usd | ER (USD) | deal.er_usd |
| tcv_usd | TCV (USD) | deal.tcv_usd |
| perpetual_license_usd | Perpetual License (USD) | deal.perpetual_license_usd |
| gp_margin_percent | GP Margin % | deal.gp_margin_percent |
| sales_rep_employee_id | Sales Rep ID | deal.sales_rep_employee_id |
| sales_rep_name | Sales Rep Name | deal.sales_rep_name |
| sales_head_employee_id | Sales Head ID | deal.sales_head_employee_id |
| sales_head_name | Sales Head Name | deal.sales_head_name |
| sales_engineering_employee_id | SE ID | deal.sales_engineering_employee_id |
| sales_engineering_name | SE Name | deal.sales_engineering_name |
| sales_engineering_head_employee_id | SE Head ID | deal.sales_engineering_head_employee_id |
| sales_engineering_head_name | SE Head Name | deal.sales_engineering_head_name |
| product_specialist_employee_id | Product Specialist ID | deal.product_specialist_employee_id |
| product_specialist_name | Product Specialist Name | deal.product_specialist_name |
| product_specialist_head_employee_id | Product Specialist Head ID | deal.product_specialist_head_employee_id |
| product_specialist_head_name | Product Specialist Head Name | deal.product_specialist_head_name |
| solution_manager_employee_id | Solution Manager ID | deal.solution_manager_employee_id |
| solution_manager_name | Solution Manager Name | deal.solution_manager_name |
| solution_manager_head_employee_id | Solution Manager Head ID | deal.solution_manager_head_employee_id |
| solution_manager_head_name | Solution Manager Head Name | deal.solution_manager_head_name |
| status | Status | deal.status |
| notes | Notes | deal.notes |

### Closing ARR Report Columns (All Bulk Upload Fields + Eligible)

| Column | Header | Source |
|--------|--------|--------|
| month_year | Month | record.month_year |
| bu | BU | record.bu |
| product | Product | record.product |
| pid | PID | record.pid |
| customer_code | Customer Code | record.customer_code |
| customer_name | Customer Name | record.customer_name |
| order_category | Order Category | record.order_category |
| status | Status | record.status |
| order_category_2 | Order Category 2 | record.order_category_2 |
| opening_arr | Opening ARR | record.opening_arr |
| cr | CR | record.cr |
| als_others | ALS + Others | record.als_others |
| new | New | record.new |
| inflation | Inflation | record.inflation |
| discount_decrement | Discount/Decrement | record.discount_decrement |
| churn | Churn | record.churn |
| adjustment | Adjustment | record.adjustment |
| closing_arr | Closing ARR | record.closing_arr |
| country | Country | record.country |
| revised_region | Revised Region | record.revised_region |
| start_date | Start Date | record.start_date |
| end_date | End Date | record.end_date |
| renewal_status | Renewal Status | record.renewal_status |
| sales_rep_employee_id | Sales Rep ID | record.sales_rep_employee_id |
| sales_rep_name | Sales Rep Name | record.sales_rep_name |
| sales_head_employee_id | Sales Head ID | record.sales_head_employee_id |
| sales_head_name | Sales Head Name | record.sales_head_name |
| eligible_closing_arr | Eligible Closing ARR | calculated |
| is_eligible | Eligible | calculated (Yes/No) |

---

## Summary of Files

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/xlsxExport.ts` | Create | XLSX export utility |
| `src/hooks/useMyActualsData.ts` | Create | Fetch user's deal and closing ARR records |
| `src/components/reports/MyDealsReport.tsx` | Create | Deals report with month filter + export |
| `src/components/reports/MyClosingARRReport.tsx` | Create | Closing ARR report with eligibility + export |
| `src/pages/Reports.tsx` | Update | Add two new tabs for the reports |

---

## Expected Outcome

All users will see two new tabs on the Reports page:
1. **My Deals** - Full list of deals where they are a participant, with all fields from bulk upload
2. **My Closing ARR** - Full list of Closing ARR records with eligibility status and eligible ARR column

Both reports include:
- Month filter with "Full Year" default
- All bulk upload fields displayed
- Export to CSV and XLSX
- Summary totals
