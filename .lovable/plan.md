
# Fix Bulk Upload Validation for Managed Services

## Problem Summary
The bulk upload for **Deals** and **Closing ARR** fails when users provide `order_category_2` or `type_of_proposal` as "managed service" (with space) or "Managed Service" because the system currently only accepts exact matches like `managed_service` or `managed_services`.

## Root Cause
- **Closing ARR**: Uses `managed_service` (singular with underscore) as the internal value
- **Deals**: Uses `managed_services` (plural with underscore) as the internal value
- Validation logic doesn't normalize user input variations (spaces, casing, singular vs plural)

## Solution

### 1. Standardize to Plural "Managed Services"
Update both modules to use `managed_services` consistently as the internal value and "Managed Services" as the display label.

### 2. Add Normalization Logic for Bulk Uploads
Create a normalization function that maps all variations to the standard value:
- "managed service" → "managed_services"
- "managed_service" → "managed_services"  
- "Managed Service" → "managed_services"
- "Managed Services" → "managed_services"

---

## Files to Modify

### File 1: `src/hooks/useClosingARR.ts`
**Change:** Update `ORDER_CATEGORY_2_OPTIONS` to use plural form

```typescript
// Line 8 - Change from:
{ value: "managed_service", label: "Managed Service" },

// To:
{ value: "managed_services", label: "Managed Services" },
```

### File 2: `src/components/data-inputs/ClosingARRBulkUpload.tsx`
**Changes:**
1. Add normalization function for order_category_2
2. Update validation error message
3. Apply normalization before storing

```typescript
// Add normalization function
const normalizeCategory = (value: string | undefined): string | null => {
  if (!value) return null;
  const normalized = value.toLowerCase().trim().replace(/\s+/g, '_');
  // Map singular to plural
  if (normalized === 'managed_service') return 'managed_services';
  return normalized;
};

// Update validation (around line 149-153):
const normalizedCategory = normalizeCategory(row.order_category_2);
if (normalizedCategory && !validCategories.has(normalizedCategory)) {
  errors.push("order_category_2 must be 'software' or 'managed_services'");
}

// Apply normalized value when building data (line 180):
order_category_2: normalizeCategory(row.order_category_2),
```

### File 3: `src/components/data-inputs/DealsBulkUpload.tsx`
**Changes:**
1. Add normalization function for type_of_proposal
2. Apply normalization during parsing and validation

```typescript
// Add normalization function
const normalizeProposalType = (value: string | undefined): string => {
  if (!value) return '';
  const normalized = value.toLowerCase().trim().replace(/\s+/g, '_');
  // Map singular to plural for managed services
  if (normalized === 'managed_service') return 'managed_services';
  return normalized;
};

// Update parseCSV function (line 220):
type_of_proposal: normalizeProposalType(deal.type_of_proposal),

// Update rowsToParsedDeals function (line 279):
type_of_proposal: normalizeProposalType(deal.type_of_proposal),

// Validation will now work correctly since normalization happens first
```

### File 4: `src/components/data-inputs/ClosingARRTable.tsx`
**Change:** Update badge display label to "Managed Services"

```typescript
// Around line 151 - Change from:
const label = category === "software" ? "Software" : "Managed Service";

// To:
const label = category === "software" ? "Software" : "Managed Services";
```

---

## Database Migration
Normalize any existing records to use the plural form:

```sql
-- Update existing Closing ARR records
UPDATE closing_arr_actuals 
SET order_category_2 = 'managed_services' 
WHERE order_category_2 = 'managed_service';

-- Update existing Deals records (if any use singular)
UPDATE deals 
SET type_of_proposal = 'managed_services' 
WHERE type_of_proposal = 'managed_service';
```

---

## Summary of Changes

| Component | Current Value | New Value |
|-----------|--------------|-----------|
| Closing ARR Options | `managed_service` | `managed_services` |
| Closing ARR Badge | "Managed Service" | "Managed Services" |
| Closing ARR Bulk Upload | Strict validation | Normalized + flexible |
| Deals Bulk Upload | Strict validation | Normalized + flexible |
| Database Records | Mixed singular | All plural |

## Accepted Input Variations (After Fix)
Users will be able to upload data with any of these values:
- `software`, `Software`, `SOFTWARE`
- `managed_services`, `managed_service`, `Managed Services`, `Managed Service`, `managed services`, `managed service`

All variations will be normalized to the canonical internal values: `software` or `managed_services`.
