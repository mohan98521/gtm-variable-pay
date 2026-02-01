
## Modify Deal Participant Fields

### Overview

Update the deals section to remove Channel Sales and add three new participant roles: Product Specialist Head, Solution Manager, and Solution Manager Head.

---

### Changes Summary

| Action | Field |
|--------|-------|
| REMOVE | channel_sales_employee_id, channel_sales_name |
| ADD | product_specialist_head_employee_id, product_specialist_head_name |
| ADD | solution_manager_employee_id, solution_manager_name |
| ADD | solution_manager_head_employee_id, solution_manager_head_name |

---

### Database Migration

**Add new columns:**
```text
product_specialist_head_employee_id (text, nullable)
product_specialist_head_name (text, nullable)
solution_manager_employee_id (text, nullable)
solution_manager_name (text, nullable)
solution_manager_head_employee_id (text, nullable)
solution_manager_head_name (text, nullable)
```

**Note:** The `channel_sales_*` columns will be retained in the database for historical data but removed from the UI. This is safer than dropping columns that may contain data.

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useDeals.ts` | Add new fields to Deal interface and CreateDealInput; update PARTICIPANT_ROLES constant |
| `src/components/data-inputs/DealFormDialog.tsx` | Update form schema; remove Channel Sales field; add 3 new participant dropdowns; update form reset and submit logic |
| `src/components/data-inputs/DealsBulkUpload.tsx` | Update CSV template headers; update ParsedDeal interface; update parsing and upload logic |

---

### Technical Details

**1. Update Deal Interface (`useDeals.ts`)**

Add to the Deal interface:
- `product_specialist_head_employee_id: string | null`
- `product_specialist_head_name: string | null`
- `solution_manager_employee_id: string | null`
- `solution_manager_name: string | null`
- `solution_manager_head_employee_id: string | null`
- `solution_manager_head_name: string | null`

Remove from interface (for UI purposes only, keep in types):
- `channel_sales_employee_id`
- `channel_sales_name`

Update PARTICIPANT_ROLES constant:
- Remove: `{ value: "channel_sales", label: "Channel Sales" }`
- Add: `{ value: "product_specialist_head", label: "Product Specialist Head" }`
- Add: `{ value: "solution_manager", label: "Solution Manager" }`
- Add: `{ value: "solution_manager_head", label: "Solution Manager Head" }`

**2. Update Form Schema (`DealFormDialog.tsx`)**

Add new fields:
- `product_specialist_head_employee_id: z.string().optional()`
- `solution_manager_employee_id: z.string().optional()`
- `solution_manager_head_employee_id: z.string().optional()`

Remove:
- `channel_sales_employee_id`

Update form defaults, reset logic, and submit handlers.

**3. Update Bulk Upload (`DealsBulkUpload.tsx`)**

CSV Template changes:
- Remove: `channel_sales_id`
- Add: `product_specialist_head_id`
- Add: `solution_manager_id`
- Add: `solution_manager_head_id`

Update ParsedDeal interface and field mappings accordingly.

---

### Form Layout After Changes

The Participants section will have 8 dropdowns in a 2-column grid:

| Row | Column 1 | Column 2 |
|-----|----------|----------|
| 1 | Sales Rep | Sales Head |
| 2 | Sales Engineering | Sales Engineering Head |
| 3 | Product Specialist | Product Specialist Head |
| 4 | Solution Manager | Solution Manager Head |

---

### Migration SQL

```sql
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS product_specialist_head_employee_id text,
ADD COLUMN IF NOT EXISTS product_specialist_head_name text,
ADD COLUMN IF NOT EXISTS solution_manager_employee_id text,
ADD COLUMN IF NOT EXISTS solution_manager_name text,
ADD COLUMN IF NOT EXISTS solution_manager_head_employee_id text,
ADD COLUMN IF NOT EXISTS solution_manager_head_name text;
```
