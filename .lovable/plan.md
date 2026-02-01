

## Bulk Upload Enhancements

### Overview

This plan addresses four improvements to the bulk upload functionality for both Deals and Closing ARR:

1. **Excel file support** (.xlsx, .xls) in addition to CSV
2. **Error export functionality** - download validation errors as CSV
3. **Case-insensitive validation** for `bu` and `type_of_proposal` columns
4. **Free text BU field** instead of predefined dropdown options

---

### Current State Analysis

| Feature | Current Behavior |
|---------|-----------------|
| File formats | CSV only (`.csv`) |
| Validation errors | Displayed on-screen, no download option |
| Case sensitivity | `type_of_proposal` must match exact case (e.g., "amc" not "AMC") |
| BU field | Dropdown with predefined values: Banking, Insurance, Wealth, Capital Markets, Corporate |

---

### Changes Summary

| Component | Changes |
|-----------|---------|
| `DealsBulkUpload.tsx` | Add Excel support, error export, case-insensitive validation |
| `ClosingARRBulkUpload.tsx` | Add Excel support, error export |
| `DealFormDialog.tsx` | Change BU from Select dropdown to free text Input |
| `useDeals.ts` | Remove BU validation array (no longer needed) |
| `package.json` | Add `xlsx` library dependency |

---

### Implementation Details

#### 1. Add Excel File Support

**Install Dependency:**
```bash
npm install xlsx
```

**Updated Dropzone Configuration:**
```typescript
import * as XLSX from 'xlsx';

const { getRootProps, getInputProps } = useDropzone({
  accept: {
    "text/csv": [".csv"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    "application/vnd.ms-excel": [".xls"],
  },
  maxFiles: 1,
});
```

**Excel Parsing Function:**
```typescript
const parseExcel = (buffer: ArrayBuffer): Record<string, string>[] => {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, {
    raw: false,
    defval: '',
  });
  
  // Normalize headers to lowercase with underscores
  return rows.map(row => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, '_');
      normalized[normalizedKey] = String(value || '').trim();
    }
    return normalized;
  });
};
```

**Updated onDrop Handler:**
```typescript
const onDrop = useCallback((acceptedFiles: File[]) => {
  const file = acceptedFiles[0];
  if (!file) return;

  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension === 'csv') {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const deals = parseCSV(text);
      // ... validation
    };
    reader.readAsText(file);
  } else if (extension === 'xlsx' || extension === 'xls') {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const rows = parseExcel(buffer);
      const deals = rowsToDeals(rows);
      // ... validation
    };
    reader.readAsArrayBuffer(file);
  }
}, []);
```

---

#### 2. Add Error Export/Download Functionality

**New Function:**
```typescript
const handleDownloadErrors = () => {
  const headers = ["Row", "Field", "Error Message"];
  const csvContent = [
    headers.join(","),
    ...validationErrors.map(err => 
      `${err.row},"${err.field}","${err.message.replace(/"/g, '""')}"`
    )
  ].join("\n");
  
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `upload_errors_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
```

**UI Addition (when errors exist):**
```text
┌─────────────────────────────────────────────────────┐
│  ❌ 5 errors                                        │
│  ┌────────────────────────────────────────────────┐ │
│  │ Row 3, bu: Business unit is required           │ │
│  │ Row 5, month_year: Invalid date format...      │ │
│  │ ...                                            │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  [Download Errors]  ← NEW BUTTON                    │
└─────────────────────────────────────────────────────┘
```

---

#### 3. Remove Case Sensitivity for Validation

**Current Code (DealsBulkUpload.tsx):**
```typescript
// Line 268 - Exact match required
if (!validProposalTypes.includes(deal.type_of_proposal)) {
  errors.push({ ... });
}
```

**Updated Code:**
```typescript
// Normalize to lowercase before validation
const normalizedProposalType = deal.type_of_proposal?.toLowerCase().trim();
if (!validProposalTypes.includes(normalizedProposalType)) {
  errors.push({
    row,
    field: "type_of_proposal",
    message: `Invalid type. Must be one of: ${validProposalTypes.join(", ")}`,
  });
}
// Also normalize before storing
deal.type_of_proposal = normalizedProposalType;
```

**Apply same logic in ClosingARRBulkUpload.tsx** for `order_category_2` field.

---

#### 4. Make BU Field Free Text

**Remove Dropdown Validation:**

In `useDeals.ts`, the `BUSINESS_UNITS` constant will be kept for reference but no longer used for strict validation.

**Update DealFormDialog.tsx:**

Change from:
```tsx
<Select onValueChange={field.onChange} value={field.value}>
  <SelectTrigger>
    <SelectValue placeholder="Select BU" />
  </SelectTrigger>
  <SelectContent>
    {BUSINESS_UNITS.map((bu) => (
      <SelectItem key={bu.value} value={bu.value}>{bu.label}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

To:
```tsx
<Input 
  placeholder="Enter business unit (e.g., Banking, Insurance)" 
  {...field} 
/>
```

**Update DealsBulkUpload.tsx Validation:**

Remove:
```typescript
if (!validBusinessUnits.includes(deal.bu)) {
  errors.push({
    row,
    field: "bu",
    message: `Invalid business unit. Must be one of: ${validBusinessUnits.join(", ")}`,
  });
}
```

Keep only required check:
```typescript
if (!deal.bu) {
  errors.push({ row, field: "bu", message: "Business unit is required" });
}
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `xlsx` dependency |
| `src/components/data-inputs/DealsBulkUpload.tsx` | Excel parsing, error export, case-insensitive validation, remove BU list validation |
| `src/components/data-inputs/ClosingARRBulkUpload.tsx` | Excel parsing, error export |
| `src/components/data-inputs/DealFormDialog.tsx` | Change BU from Select to Input |

---

### Updated UI Preview

**Dropzone Text (both components):**

| Current | Updated |
|---------|---------|
| "Drag & drop a CSV file here" | "Drag & drop a CSV or Excel file here" |
| "or click to select a file" | "Supported: .csv, .xlsx, .xls" |

**Error Section (when validation fails):**

```text
┌─ Validation Errors ─────────────────────────────────┐
│                                                     │
│  ❌ 5 errors found                                  │
│                                                     │
│  ┌────────────────────────────────────────────────┐ │
│  │ Row 3: bu - Business unit is required          │ │
│  │ Row 5: month_year - Invalid date format        │ │
│  │ Row 7: sales_rep_id - Employee not found       │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  [📥 Download Errors]                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### Technical Notes

- **Excel dates**: The xlsx library with `raw: false` option automatically converts Excel date cells to strings
- **Header normalization**: Both CSV and Excel headers are normalized to lowercase with underscores for consistent matching
- **Backward compatibility**: CSV files continue to work exactly as before
- **BU field history**: Existing deal records with predefined BU values remain valid; new entries can use any text

