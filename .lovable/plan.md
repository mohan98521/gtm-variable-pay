

## Revised Plan: Complete Deals Schema Redesign for Actuals Input

### Overview
Create a new comprehensive deals table with all required fields for actuals tracking, replacing the current simplified structure. This involves dropping the existing deals/deal_participants tables and creating fresh ones with the complete schema.

---

### Part 1: Database Migration

**A. Drop Existing Tables (in order)**
1. deal_audit_log (has FK to deals)
2. deal_participants (has FK to deals)
3. deals

**B. New `deals` Table Schema**

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| id | uuid | Yes | System-generated unique identifier |
| project_id | text | Yes | Project identifier |
| customer_code | text | Yes | Customer code |
| region | text | Yes | Geographic region |
| country | text | Yes | Country name |
| bu | text | Yes | Business Unit |
| product | text | Yes | Product name |
| type_of_proposal | text | Yes | AMC, Subscription, Managed Services, Perpetual Licence, CR, ER, Implementation |
| gp_margin_percent | numeric | No | Gross profit margin percentage |
| month_year | date | Yes | Period (first of month) |
| first_year_amc_usd | numeric | No | First year AMC value in USD |
| first_year_subscription_usd | numeric | No | First year subscription value in USD |
| new_software_booking_arr_usd | numeric | Generated | Auto-calculated: first_year_amc_usd + first_year_subscription_usd |
| managed_services_usd | numeric | No | Managed services value in USD |
| implementation_usd | numeric | No | Implementation value in USD |
| cr_usd | numeric | No | Change Request value in USD |
| er_usd | numeric | No | Enhancement Request value in USD |
| tcv_usd | numeric | No | Total Contract Value in USD |
| sales_rep_employee_id | text | No | Sales Rep employee ID |
| sales_rep_name | text | No | Sales Rep full name |
| sales_head_employee_id | text | No | Sales Head employee ID |
| sales_head_name | text | No | Sales Head full name |
| sales_engineering_employee_id | text | No | SE employee ID |
| sales_engineering_name | text | No | SE full name |
| sales_engineering_head_employee_id | text | No | SE Head employee ID |
| sales_engineering_head_name | text | No | SE Head full name |
| channel_sales_employee_id | text | No | Channel Sales employee ID |
| channel_sales_name | text | No | Channel Sales full name |
| product_specialist_employee_id | text | No | Product Specialist employee ID |
| product_specialist_name | text | No | Product Specialist full name |
| linked_to_impl | boolean | No | Yes/No - Linked to Implementation |
| eligible_for_perpetual_incentive | boolean | No | Yes/No - Eligible for perpetual licence incentive |
| status | text | Yes | Approval workflow: draft, submitted, approved, rejected |
| notes | text | No | Optional notes |
| created_at | timestamptz | Yes | Creation timestamp |
| updated_at | timestamptz | Yes | Last update timestamp |

**C. New `deal_participants` Table**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| deal_id | uuid | FK to deals |
| employee_id | text | Employee ID |
| participant_role | text | Role from expanded list |
| split_percent | numeric | Attribution percentage |
| created_at | timestamptz | Creation timestamp |

**D. Recreate `deal_audit_log` Table**
Same structure as before with FK to new deals table for change tracking.

**E. Generated Column**
The `new_software_booking_arr_usd` column will be auto-calculated at database level:
```text
COALESCE(first_year_amc_usd, 0) + COALESCE(first_year_subscription_usd, 0)
```

---

### Part 2: Constants Updates

**A. PROPOSAL_TYPES (replaces METRIC_TYPES)**

| Value | Label |
|-------|-------|
| amc | AMC |
| subscription | Subscription |
| managed_services | Managed Services |
| perpetual_licence | Perpetual Licence |
| cr | CR (Change Request) |
| er | ER (Enhancement Request) |
| implementation | Implementation |

**B. PARTICIPANT_ROLES (updated)**

| Value | Label |
|-------|-------|
| sales_rep | Sales Rep |
| sales_head | Sales Head |
| sales_engineering | Sales Engineering |
| sales_engineering_head | Sales Engineering Head |
| channel_sales | Channel Sales |
| product_specialist | Product Specialist |

---

### Part 3: Form Redesign - DealFormDialog

**Section 1: Deal Identity**
- Project ID (text input)
- Customer Code (text input)
- Region (text input)
- Country (text input)
- BU (dropdown with existing business units)
- Product (text input)

**Section 2: Classification**
- Type of Proposal (dropdown: AMC, Subscription, Managed Services, Perpetual Licence, CR, ER, Implementation)
- GP Margin % (number input, 0-100)
- Month (date picker, restricted to fiscal year)
- Linked to Implementation (Yes/No toggle)
- Eligible for Perpetual Licence Incentive (Yes/No toggle)

**Section 3: Value Breakdown (USD)**

| Field | Input Type |
|-------|------------|
| First Year AMC USD | Number input |
| First Year Subscription USD | Number input |
| New Software Booking ARR USD | Read-only (auto-calculated) |
| Managed Services USD | Number input |
| Implementation USD | Number input |
| CR (Change Request) USD | Number input |
| ER (Enhancement Request) USD | Number input |
| TCV USD | Number input |

**Section 4: Participants**
For each role, two fields side by side:
- Employee ID (searchable dropdown from employees table)
- Employee Name (auto-populated when ID selected)

Roles displayed:
1. Sales Rep
2. Sales Head
3. Sales Engineering
4. Sales Engineering Head
5. Channel Sales
6. Product Specialist

**Section 5: Status and Notes**
- Status (dropdown: Draft, Submitted, Approved, Rejected)
- Notes (textarea)

---

### Part 4: Deals Table Display

**Column Layout:**

| Column | Description |
|--------|-------------|
| Project ID | Project identifier |
| Customer | Customer code |
| BU | Business unit |
| Type | Proposal type badge |
| Month | Period (MMM yyyy) |
| ARR USD | New Software Booking ARR |
| TCV USD | Total contract value |
| Status | Status badge with color |
| Actions | Edit/Delete dropdown |

---

### Part 5: Bulk Upload Template

**CSV Columns:**
```text
project_id, customer_code, region, country, bu, product, type_of_proposal, 
gp_margin_percent, month_year, first_year_amc_usd, first_year_subscription_usd, 
managed_services_usd, implementation_usd, cr_usd, er_usd, tcv_usd, 
sales_rep_id, sales_head_id, sales_engineering_id, sales_engineering_head_id, 
channel_sales_id, product_specialist_id, linked_to_impl, 
eligible_for_perpetual_incentive, status, notes
```

**Validation Rules:**
- type_of_proposal must be valid value (amc, subscription, managed_services, perpetual_licence, cr, er, implementation)
- month_year must be within selected fiscal year
- Employee IDs validated against employees table
- Names auto-looked up from employee IDs during import
- linked_to_impl and eligible_for_perpetual_incentive accept: yes, no, y, n, true, false

---

### Part 6: Data Inputs Page Tabs

**Updated Tab Structure by Proposal Type:**
- All (default view)
- AMC
- Subscription
- Managed Services
- Perpetual Licence
- CR (Change Request)
- ER (Enhancement Request)
- Implementation

Each tab filters the deals table by type_of_proposal.

---

### Part 7: RLS Policies

Recreate the same role-based access policies:
- Admins and GTM Ops: Full CRUD access
- Finance, Sales Head, Executive: Read-only access

---

### Implementation Phases

| Phase | Tasks |
|-------|-------|
| 1 | Database migration: Drop existing tables, create new schema with generated column |
| 2 | Recreate audit trigger for automatic change logging |
| 3 | Update useDeals.ts: New interfaces, PROPOSAL_TYPES, updated PARTICIPANT_ROLES |
| 4 | Redesign DealFormDialog with all sections and auto-population logic |
| 5 | Update DealsTable component with new columns |
| 6 | Update DealParticipantsEditor for new role structure |
| 7 | Update DealsBulkUpload with new template and validation |
| 8 | Update DataInputs.tsx tabs to filter by type_of_proposal |

---

### Files to be Modified

| File | Changes |
|------|---------|
| New migration SQL | Drop/recreate tables with new schema |
| src/hooks/useDeals.ts | New Deal interface, PROPOSAL_TYPES, updated constants |
| src/components/data-inputs/DealFormDialog.tsx | Complete redesign with 5 sections |
| src/components/data-inputs/DealsTable.tsx | Updated columns and display |
| src/components/data-inputs/DealParticipantsEditor.tsx | Updated roles |
| src/components/data-inputs/DealsBulkUpload.tsx | New template and validation |
| src/pages/DataInputs.tsx | Tabs by proposal type instead of metric type |
| src/integrations/supabase/types.ts | Auto-updated after migration |

