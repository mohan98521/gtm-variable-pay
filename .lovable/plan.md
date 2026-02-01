

## Performance Targets Management UI - Quarter-Level Input

### Overview

Build a Performance Targets Management interface where admins/GTM Ops input targets at the **quarterly level (Q1, Q2, Q3, Q4)**, and the system automatically calculates the **Annual Target as the sum of quarterly values**. This provides flexibility for different split percentages per employee/metric.

---

### Key Design Decision: Bottom-Up Approach

| Previous Approach | New Approach |
|------------------|--------------|
| Input Annual Target | Input Q1, Q2, Q3, Q4 |
| Auto-calculate quarters (20/25/25/30) | Auto-calculate Annual = Q1+Q2+Q3+Q4 |
| Fixed percentage splits | Flexible splits per employee |

---

### Database Tables (Already Exist)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `quarterly_targets` | Primary data entry | `employee_id`, `metric_type`, `quarter` (1-4), `target_value_usd`, `effective_year` |
| `performance_targets` | Aggregated annual view | `employee_id`, `metric_type`, `target_value_usd`, `effective_year` |

**Data Flow:**
```text
User inputs Q1, Q2, Q3, Q4 values
          |
          v
[Insert/Update quarterly_targets - 4 records per employee/metric]
          |
          v
[Calculate Annual = Q1+Q2+Q3+Q4]
          |
          v
[Upsert performance_targets - 1 record with aggregated annual]
```

---

### Solution Architecture

#### 1. New Admin Tab: "Performance Targets"

Add alongside existing tabs in `Admin.tsx`:
- Compensation Plans
- Employee Accounts
- Bulk Upload
- **Performance Targets** (NEW)
- Role Management
- Permissions

---

#### 2. Main Component: PerformanceTargetsManagement

**Layout:**
- Stats cards (employees with targets, total annual value, pending)
- Filters (search by employee, filter by metric type)
- Add Target button + Bulk Upload button
- Table with quarterly and annual breakdown

**Table Columns:**
| Employee Name | Employee ID | Metric Type | Q1 (USD) | Q2 (USD) | Q3 (USD) | Q4 (USD) | Annual (USD) | Actions |

- Annual column is calculated and displayed as read-only (greyed out or styled differently)
- Edit and Delete actions per row

---

#### 3. Add/Edit Dialog: PerformanceTargetFormDialog

**Form Fields:**
1. **Employee** - Searchable dropdown from employees table
2. **Metric Type** - Dropdown: "New Software Booking ARR", "Closing ARR", or custom entry
3. **Q1 Target (USD)** - Number input, default 0
4. **Q2 Target (USD)** - Number input, default 0
5. **Q3 Target (USD)** - Number input, default 0
6. **Q4 Target (USD)** - Number input, default 0
7. **Annual Target (USD)** - Read-only, auto-calculated = Q1+Q2+Q3+Q4

**Real-time Calculation:**
As user types in any quarter field, the Annual total updates instantly

**Validation:**
- Employee is required
- Metric type is required
- At least one quarter must have a value > 0
- Show calculated Annual prominently before submission

---

#### 4. Bulk Upload: PerformanceTargetsBulkUpload

**CSV Template Headers:**
```csv
employee_id,metric_type,q1_target_usd,q2_target_usd,q3_target_usd,q4_target_usd
```

**Example Row:**
```csv
EMP001,New Software Booking ARR,200000,250000,250000,300000
```

**Processing Logic:**
1. Parse CSV
2. Validate employee_id exists in employees table
3. Validate metric_type is valid
4. For each row:
   - Upsert 4 records into `quarterly_targets` (Q1, Q2, Q3, Q4)
   - Calculate annual sum
   - Upsert 1 record into `performance_targets`
5. Show progress and results

**Validation:**
- All quarterly values are required (can be 0)
- Annual = Q1+Q2+Q3+Q4 (system calculates, not in CSV)

---

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/admin/PerformanceTargetsManagement.tsx` | Main management component with table, stats, filters |
| `src/components/admin/PerformanceTargetFormDialog.tsx` | Add/Edit dialog with quarter-level inputs |
| `src/components/admin/PerformanceTargetsBulkUpload.tsx` | Bulk upload dialog with CSV handling |
| `src/hooks/usePerformanceTargets.ts` | React Query hooks for CRUD operations |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Admin.tsx` | Add "Performance Targets" tab with Target icon |

---

### Technical Implementation Details

**usePerformanceTargets.ts Hook:**

```text
Exports:
- usePerformanceTargets(effectiveYear): Query that fetches quarterly_targets 
  grouped by employee/metric with calculated annual sum
  
- useEmployeeTargetDetails(employeeId, metricType, year): Get specific target for editing
  
- useCreatePerformanceTarget: Mutation that:
  1. Inserts/updates 4 quarterly_targets records (Q1-Q4)
  2. Calculates annual sum
  3. Upserts performance_targets record
  
- useUpdatePerformanceTarget: Same as create (upsert logic)

- useDeletePerformanceTarget: Mutation that:
  1. Deletes quarterly_targets for employee/metric/year
  2. Deletes performance_targets for same combination
```

**Query Structure for Table:**
```text
SELECT 
  e.full_name,
  e.employee_id,
  qt.metric_type,
  qt.effective_year,
  SUM(CASE WHEN qt.quarter = 1 THEN qt.target_value_usd ELSE 0 END) as q1,
  SUM(CASE WHEN qt.quarter = 2 THEN qt.target_value_usd ELSE 0 END) as q2,
  SUM(CASE WHEN qt.quarter = 3 THEN qt.target_value_usd ELSE 0 END) as q3,
  SUM(CASE WHEN qt.quarter = 4 THEN qt.target_value_usd ELSE 0 END) as q4,
  SUM(qt.target_value_usd) as annual
FROM quarterly_targets qt
JOIN employees e ON e.employee_id = qt.employee_id
WHERE qt.effective_year = :year
GROUP BY e.full_name, e.employee_id, qt.metric_type, qt.effective_year
```

---

### PerformanceTargetsManagement.tsx Structure

```text
Component Structure:
├── Stats Cards (3)
│   ├── Employees with Targets
│   ├── Total Annual Value (USD)
│   └── Employees without Targets
│
├── Action Bar
│   ├── Search Input
│   ├── Metric Type Filter (All | New Software Booking ARR | Closing ARR)
│   ├── Add Target Button
│   └── Bulk Upload Button
│
├── Data Table
│   ├── Columns: Employee, ID, Metric, Q1, Q2, Q3, Q4, Annual, Actions
│   ├── Annual column styled as calculated (greyed)
│   └── Row actions: Edit | Delete
│
└── Empty State
    └── "No performance targets for [Year]. Add targets individually or bulk upload."
```

---

### PerformanceTargetFormDialog.tsx Structure

```text
Dialog Content:
├── Header: "Add Performance Target" or "Edit Performance Target"
│
├── Form
│   ├── Employee Select (searchable dropdown)
│   ├── Metric Type Select
│   ├── Quarterly Inputs Grid (2x2 layout)
│   │   ├── Q1 Target (USD)
│   │   ├── Q2 Target (USD)
│   │   ├── Q3 Target (USD)
│   │   └── Q4 Target (USD)
│   │
│   └── Annual Target Display (read-only, highlighted)
│       └── "Annual Target: $1,000,000" (calculated in real-time)
│
└── Footer
    ├── Cancel Button
    └── Save Button
```

---

### Upsert Logic for Create/Update

When saving a target:

```text
1. Delete existing quarterly_targets where:
   - employee_id = selected employee
   - metric_type = selected metric
   - effective_year = current fiscal year

2. Insert 4 new quarterly_targets records:
   - (employee_id, metric, 1, q1_value, year)
   - (employee_id, metric, 2, q2_value, year)
   - (employee_id, metric, 3, q3_value, year)
   - (employee_id, metric, 4, q4_value, year)

3. Calculate annual = q1 + q2 + q3 + q4

4. Upsert performance_targets:
   - ON CONFLICT (employee_id, metric_type, effective_year)
   - UPDATE target_value_usd = annual
```

---

### UI Flow Examples

**Adding a New Target:**
1. Admin clicks "Add Target"
2. Selects "John Doe (EMP001)"
3. Selects "New Software Booking ARR"
4. Enters: Q1=$200,000, Q2=$250,000, Q3=$250,000, Q4=$300,000
5. Sees real-time calculation: "Annual Target: $1,000,000"
6. Clicks Save
7. System creates 4 quarterly records + 1 annual record

**Editing Existing Target:**
1. Admin clicks Edit on a row
2. Dialog opens pre-populated with existing Q1-Q4 values
3. Admin modifies Q3 from $250,000 to $300,000
4. Annual updates to $1,050,000
5. Clicks Save
6. System updates all records

**Bulk Upload:**
1. Download template
2. Fill in: employee_id, metric_type, q1, q2, q3, q4
3. Upload CSV
4. System processes each row, creating/updating records
5. Shows summary: "Created 8 targets, Updated 2 targets"

---

### Permission Integration

Use existing permission system:
- Tab access controlled by `tab:performance_targets` permission (to be added)
- Or reuse existing admin/GTM Ops role checks

---

### Metric Types

Available metric types (from `plan_metrics` table):
- New Software Booking ARR
- Closing ARR

The form will also allow custom metric type entry for flexibility.

---

### Summary

This implementation provides:
1. Dedicated Admin tab for Performance Targets management
2. Quarter-level input (Q1, Q2, Q3, Q4) with flexible percentages
3. Auto-calculated Annual = Sum of quarters
4. Real-time calculation display in the form
5. Table view showing all quarters + annual total
6. Bulk upload with CSV support
7. Uses existing `quarterly_targets` and `performance_targets` tables
8. Supports any split percentage (not locked to 20/25/25/30)

