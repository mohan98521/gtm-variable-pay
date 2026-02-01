

## Quick Fix: Add Customer Name Field to Deals

### Overview

Add the missing `customer_name` field to the Data Inputs deals section to match the Closing ARR structure and provide complete customer identification.

---

### Current State

| Table | Has customer_code | Has customer_name |
|-------|-------------------|-------------------|
| `closing_arr_actuals` | ✅ Yes | ✅ Yes |
| `deals` | ✅ Yes | ❌ **Missing** |

---

### Changes Required

**1. Database Migration**

Add a new column to the `deals` table:

```sql
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS customer_name text;
```

**2. Update Hook (`src/hooks/useDeals.ts`)**

Add to the `Deal` interface:
- `customer_name: string | null`

Add to the `CreateDealInput` interface:
- `customer_name?: string`

**3. Update Form Dialog (`src/components/data-inputs/DealFormDialog.tsx`)**

- Add `customer_name` to the Zod schema (optional string)
- Add a new "Customer Name" input field in the Deal Identity section
- Update form defaults and reset logic
- Include in submit data

**4. Update Bulk Upload (`src/components/data-inputs/DealsBulkUpload.tsx`)**

- Add `customer_name` to CSV template headers
- Update `ParsedDeal` interface
- Add field mapping in parse logic

---

### Form Layout After Change

The Deal Identity section will have 4 fields in the first row:

| Field 1 | Field 2 | Field 3 | Field 4 |
|---------|---------|---------|---------|
| Project ID | Customer Code | **Customer Name** | Product |

---

### Technical Details

**Schema field:**
```text
customer_name: z.string().optional()
```

**Form field placement:** Right after Customer Code, before Product in the Deal Identity grid.

**Default value:** Empty string

---

### Files to Modify

| File | Changes |
|------|---------|
| Database | Add `customer_name` column to `deals` table |
| `src/hooks/useDeals.ts` | Add field to interfaces |
| `src/components/data-inputs/DealFormDialog.tsx` | Add form field and validation |
| `src/components/data-inputs/DealsBulkUpload.tsx` | Add to CSV template and parsing |

