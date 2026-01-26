

## Closing ARR Monthly Data Capture Implementation Plan

### Overview

Create a dedicated "Closing ARR" section within the Data Inputs page for monthly project-level ARR tracking. Users will upload or manually enter the complete project ARR snapshot for each month, with a database-level formula calculating Closing ARR automatically.

---

### Part 1: Database Schema

**New Table: `closing_arr_actuals`**

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| id | uuid | Yes | Primary key |
| month_year | date | Yes | Period (first of month) |
| bu | text | Yes | Business Unit |
| product | text | Yes | Product name |
| pid | text | Yes | Project identifier |
| customer_code | text | Yes | Customer code |
| customer_name | text | Yes | Customer name |
| order_category | text | No | Order category |
| status | text | No | Project status |
| order_category_2 | text | No | Software or Managed Service |
| opening_arr | numeric | No | Opening ARR value |
| cr | numeric | No | Change Request ARR uplift value |
| als_others | numeric | No | ALS + Others ARR uplift value |
| new | numeric | No | New booking value |
| inflation | numeric | No | Inflation value |
| discount_decrement | numeric | No | Discount/Decrement value (stored as positive, applied as negative) |
| churn | numeric | No | Churn value (stored as positive, applied as negative) |
| adjustment | numeric | No | Adjustment value |
| closing_arr | numeric | No | Closing ARR value |
| country | text | No | Country |
| revised_region | text | No | Revised region |
| start_date | date | No | Contract start date |
| end_date | date | No | Contract end date (for eligibility) |
| renewal_status | text | No | Renewal status |
| sales_rep_employee_id | text | No | Sales Rep ID |
| sales_rep_name | text | No | Sales Rep name |
| sales_head_employee_id | text | No | Sales Head ID |
| sales_head_name | text | No | Sales Head name |
| created_at | timestamptz | Yes | Created timestamp |
| updated_at | timestamptz | Yes | Updated timestamp |

**Generated Column Formula:**

**Unique Constraint:**
- Composite unique on `(month_year, pid)` to enforce one record per project per month

**RLS Policies:**
- Same role-based access as deals table (Admin, GTM Ops full access; Finance, Sales Head read-only)

---

### Part 2: Constants

**ORDER_CATEGORY_2 Options:**

| Value | Label |
|-------|-------|
| software | Software |
| managed_service | Managed Service |

---

### Part 3: Hook - useClosingARR.ts

Create a new hook for CRUD operations:

- `useClosingARRData(monthYear)` - Fetch all records for a month
- `useCreateClosingARR()` - Insert new record
- `useUpdateClosingARR()` - Update existing record
- `useDeleteClosingARR()` - Delete record
- `useBulkUpsertClosingARR()` - Upsert multiple records (for bulk upload)

---

### Part 4: Form Dialog - ClosingARRFormDialog

**Form Sections:**

**Section 1: Project Identity**
- Month (date picker, restricted to fiscal year)
- BU (dropdown)
- Product (text)
- PID (text, required)
- Customer Code (text, required)
- Customer Name (text)

**Section 2: Classification**
- Order Category (text)
- Status (text)
- Order Category 2 (dropdown: Software, Managed Service)
- Country (text)
- Revised Region (text)

**Section 3: ARR Components (USD)**

| Field | Input Type | Notes |
|-------|------------|-------|
| Opening ARR | Number | Base value |
| CR (Change Request) | Number | Addition |
| ALS + Others | Number | Addition |
| New | Number | Addition |
| Inflation | Number | Addition |
| Discount/Decrement | Number | Subtraction |
| Churn | Number | Subtraction |
| Adjustment | Number | Can be +/- |
| Closing ARR | Read-only | Auto-calculated |

The form will show a live preview of the calculated Closing ARR as fields are entered.

**Section 4: Contract Dates**
- Start Date (date picker)
- End Date (date picker)
- Renewal Status (text)

**Section 5: Participants**
- Sales Rep (employee ID dropdown + auto-populated name)
- Sales Head (employee ID dropdown + auto-populated name)

---

### Part 5: Table - ClosingARRTable

**Column Layout:**

| Column | Description |
|--------|-------------|
| PID | Project identifier |
| Customer | Customer name |
| BU | Business unit |
| Category | Order Category 2 badge |
| Month | Period (MMM yyyy) |
| Opening ARR | Opening value |
| +/- Changes | Sum of CR, ALS, New, etc. |
| Closing ARR | Calculated value |
| End Date | Contract end |
| Actions | Edit/Delete |

Features:
- Horizontal scrolling for additional columns
- Column toggle to show/hide columns
- Sort by any column
- Filter by BU, Category, Status

---

### Part 6: Bulk Upload - ClosingARRBulkUpload

**CSV Template Headers:**
```text
month_year, bu, product, pid, customer_code, customer_name, order_category, status, order_category_2, opening_arr, cr, als_others, new, inflation, discount_decrement, churn, adjustment, country, revised_region, start_date, end_date, renewal_status, sales_rep_id, sales_head_id
```

**Validation Rules:**
- month_year must be within selected fiscal year
- pid is required
- customer_code is required
- order_category_2 must be "software" or "managed_service" (if provided)
- Employee IDs validated against employees table
- Numeric fields parsed with validation

**Upsert Behavior:**
- If a record with same `(month_year, pid)` exists, update it
- Otherwise, insert new record
- This enables monthly refresh uploads

---

### Part 7: Summary Section - ClosingARRSummary

A read-only summary card showing:
- Total Projects for the month
- Total Opening ARR
- Total Changes (+/-)
- Total Closing ARR
- Eligible Projects (where end_date > Dec 31 of fiscal year)
- Eligible Closing ARR (sum of closing_arr for eligible projects)

---

### Part 8: Data Inputs Page Integration

**Updated Tab Structure:**

```text
Data Inputs Page
├── Deals Section (existing)
│   └── Tabs: All, AMC, Subscription, Managed Services, etc.
│
└── Closing ARR Section (NEW)
    ├── Month Selector
    ├── Quick Stats (Summary)
    ├── Table with Edit/Delete
    ├── Add Record Button
    └── Bulk Upload Button
```

The page will have two main sections:
1. **Deals** - For transactional deal data (existing)
2. **Closing ARR** - For monthly project ARR snapshots (new)

These will be separated by a clear visual divider or nested tabs.

---

### Part 9: Eligibility Logic for Compensation

For compensation calculations, only projects where:
```text
end_date > December 31 of the fiscal year
```
will count toward Closing ARR achievement.

The summary will display:
- Total Closing ARR (all projects)
- Eligible Closing ARR (filtered by end date)

---

### Implementation Phases

| Phase | Tasks |
|-------|-------|
| 1 | Database migration: Create `closing_arr_actuals` table with generated column, unique constraint, RLS policies |
| 2 | Create hook: `src/hooks/useClosingARR.ts` with CRUD operations |
| 3 | Create form dialog: `src/components/data-inputs/ClosingARRFormDialog.tsx` |
| 4 | Create table component: `src/components/data-inputs/ClosingARRTable.tsx` |
| 5 | Create bulk upload: `src/components/data-inputs/ClosingARRBulkUpload.tsx` |
| 6 | Create summary component: `src/components/data-inputs/ClosingARRSummary.tsx` |
| 7 | Update `src/pages/DataInputs.tsx` to add Closing ARR section |
| 8 | Update compensation engine to query this table for Closing ARR achievement |

---

### Files to Create

| File | Purpose |
|------|---------|
| New migration SQL | Create closing_arr_actuals table |
| src/hooks/useClosingARR.ts | CRUD hooks for Closing ARR data |
| src/components/data-inputs/ClosingARRFormDialog.tsx | Add/Edit form for Closing ARR records |
| src/components/data-inputs/ClosingARRTable.tsx | Display table with actions |
| src/components/data-inputs/ClosingARRBulkUpload.tsx | CSV upload with upsert |
| src/components/data-inputs/ClosingARRSummary.tsx | Quick stats cards |

### Files to Modify

| File | Changes |
|------|---------|
| src/pages/DataInputs.tsx | Add Closing ARR section with all new components |
| src/lib/compensationEngine.ts | Add function to calculate Closing ARR achievement |

---

### UI/UX Considerations

1. **Clear Section Separation**: Deals and Closing ARR sections will be visually distinct with headers and dividers
2. **Month Selector**: Shared month selector at page level controls both sections
3. **Inline Editing**: Double-click a cell to edit values directly (optional enhancement)
4. **Formula Preview**: Real-time calculation display in the form as values are entered
5. **Eligibility Indicator**: Visual badge showing if project is eligible (end date > Dec 31)
6. **Bulk Upload Feedback**: Clear success/error messaging with row-level error details
7. **Export Capability**: Download current month's data as CSV for verification

---

### Technical Notes

**Why Full Monthly Upload Works Best Here:**
1. ARR data typically comes from an external source/ERP system
2. Monthly refresh ensures data stays in sync with source
3. Upsert logic prevents duplicate records
4. Generated column handles formula automatically
5. Simpler audit - each month's snapshot is self-contained

**Closing ARR Formula in Database:**
```sql
GENERATED ALWAYS AS (
  COALESCE(opening_arr, 0) + 
  COALESCE(cr, 0) + 
  COALESCE(als_others, 0) + 
  COALESCE(new, 0) + 
  COALESCE(inflation, 0) - 
  COALESCE(discount_decrement, 0) - 
  COALESCE(churn, 0) + 
  COALESCE(adjustment, 0)
) STORED
```

