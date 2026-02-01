

## Update Date Format for Bulk Upload (MMM-YYYY)

### Overview

Update the bulk upload validation for both Deals and Closing ARR to accept user-friendly `MMM-YYYY` format (e.g., "Jan-2026") instead of requiring the database format `YYYY-MM-DD`.

---

### Current vs Proposed Format

| Component | Current Format | New Format |
|-----------|----------------|------------|
| Database Storage | `2026-01-01` (date) | `2026-01-01` (no change) |
| CSV Upload Input | `YYYY-MM-DD` required | `MMM-YYYY` or `YYYY-MM-DD` accepted |
| UI Display | "January 2026" | "January 2026" (no change) |
| CSV Template Example | `2026-01-01` | `Jan-2026` |

---

### Technical Approach

**No database changes required** - only client-side parsing logic needs updating.

The solution will:
1. Create a shared date parsing utility that accepts both formats
2. Parse `MMM-YYYY` (e.g., "Jan-2026", "Feb-2026") and convert to `YYYY-MM-01`
3. Continue accepting `YYYY-MM-DD` format for backward compatibility
4. Update CSV template examples to show the new user-friendly format
5. Update validation error messages

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/data-inputs/DealsBulkUpload.tsx` | Add `parseMonthYear` function; update validation regex; update template example |
| `src/components/data-inputs/ClosingARRBulkUpload.tsx` | Add `parseMonthYear` function; update `parseDate` function for month_year field |

---

### Implementation Details

**1. New Date Parsing Function**

Create a utility function to parse multiple date formats:

```typescript
const parseMonthYear = (value: string): string | null => {
  if (!value || value.trim() === "") return null;
  
  const trimmed = value.trim();
  
  // Format 1: YYYY-MM-DD (existing format)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Format 2: MMM-YYYY (e.g., "Jan-2026")
  const monthMap: Record<string, string> = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };
  
  const match = trimmed.match(/^([a-zA-Z]{3})-(\d{4})$/);
  if (match) {
    const monthNum = monthMap[match[1].toLowerCase()];
    if (monthNum) {
      return `${match[2]}-${monthNum}-01`;
    }
  }
  
  return null; // Invalid format
};
```

**2. Update DealsBulkUpload.tsx Validation**

Replace the current validation:
```typescript
// Current (line 255)
if (!deal.month_year || !deal.month_year.match(/^\d{4}-\d{2}-\d{2}$/)) {
  errors.push({ row, field: "month_year", message: "Invalid date format. Use YYYY-MM-DD" });
}
```

With:
```typescript
// New validation
const parsedDate = parseMonthYear(deal.month_year);
if (!parsedDate) {
  errors.push({ row, field: "month_year", message: "Invalid date format. Use MMM-YYYY (e.g., Jan-2026)" });
} else if (!isMonthInFiscalYear(parsedDate)) {
  errors.push({ row, field: "month_year", message: `Month must be within fiscal year ${selectedYear}` });
}
```

**3. Update CSV Template**

Change the example row from:
```
"2026-01-01"
```
To:
```
"Jan-2026"
```

**4. Update Alert Message**

Change from:
```
All deals must have a month_year within FY 2026 (Jan-Dec 2026).
```
To:
```
All deals must have a month_year (e.g., Jan-2026) within FY 2026.
```

---

### Backward Compatibility

The solution maintains backward compatibility:
- `YYYY-MM-DD` format still works (for existing CSV files)
- `MMM-YYYY` format now also works (user-friendly)
- Both formats are parsed and converted to the database format before storage

---

### Summary of Changes

| Change | Deals Bulk Upload | Closing ARR Bulk Upload |
|--------|-------------------|-------------------------|
| Add `parseMonthYear` function | ✅ | ✅ |
| Update validation logic | ✅ | ✅ |
| Update template example | ✅ | ✅ (if applicable) |
| Update help text/alert | ✅ | ✅ |

