

# Plan: Add "Download Errors/Warnings" Across All Upload and Validation Points

## Current State Summary

The system has **6 distinct upload/validation areas**. Here is the audit:

| # | Component | Location | Has Download Errors? |
|---|-----------|----------|---------------------|
| 1 | **Deals Bulk Upload** | Data Inputs > Deals | YES -- CSV download of row/field/message |
| 2 | **Collections Bulk Upload** | Data Inputs > Collections | YES -- CSV download via `generateCSV` |
| 3 | **Closing ARR Bulk Upload** | Data Inputs > Closing ARR | YES -- CSV download of row/errors |
| 4 | **Employee Bulk Upload** | Admin > People > Bulk Upload | NO -- errors shown inline only |
| 5 | **Performance Targets Bulk Upload** | Admin > Compensation > Perf Targets | NO -- invalid rows shown in table only |
| 6 | **Payout Run Validation** | Admin > Finance > Payout Runs (Create dialog) | NO -- errors/warnings shown inline only |

**3 out of 6 already have Download Errors. 3 need it added.**

---

## Changes Required

### 1. `src/components/admin/BulkUpload.tsx` (Employee Bulk Upload)

**Current behavior**: After upload, errors are displayed as a list of strings in a scrollable div. No download option.

**Add**:
- A "Download Errors" button below the error list (visible only when `result.errors.length > 0`)
- Export as CSV with columns: Row Number (extracted from error string if available), Error Message
- Use the existing `generateCSV` + `downloadCSV` utilities from `src/lib/csvExport.ts`
- File name: `employee_upload_errors_YYYY-MM-DD.csv`

### 2. `src/components/admin/PerformanceTargetsBulkUpload.tsx` (Performance Targets)

**Current behavior**: Invalid rows are shown in a table with red X badges and error text. No download option.

**Add**:
- A "Download Errors" button in the summary bar area (next to the "X invalid" badge), visible when `invalidCount > 0`
- Export invalid rows as CSV with columns: Employee ID, Metric Type, Errors
- Use `generateCSV` + `downloadCSV`
- File name: `performance_targets_upload_errors_YYYY-MM-DD.csv`

### 3. `src/components/admin/PayoutRunManagement.tsx` (Payout Run Validation)

**Current behavior**: Validation errors and warnings are displayed as styled lists inside the Create Payout Run dialog. No download option (this is what the user's screenshot shows).

**Add**:
- A "Download Errors & Warnings" button below the validation results section, visible when there are any errors or warnings
- Export as CSV with columns: Type (Error/Warning), Category, Message, Details
- The `details` array from `ValidationError`/`ValidationWarning` interfaces will be joined into a single cell
- Use `generateCSV` + `downloadCSV`
- File name: `payout_validation_YYYY-MM.csv`

---

## UI Pattern (Consistent Across All 6 Components)

All download buttons will follow the same visual pattern already established by the Deals/Collections/Closing ARR uploads:

- Button variant: `outline`, size: `sm`
- Icon: `Download` (from lucide-react), 4x4, with right margin
- Label: "Download Errors" (or "Download Errors & Warnings" for payout validation)
- Positioned immediately below or beside the error display area

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/BulkUpload.tsx` | Add `handleDownloadErrors` function + Download button in the error results section (~10 lines) |
| `src/components/admin/PerformanceTargetsBulkUpload.tsx` | Add `handleDownloadErrors` function + Download button near the invalid count badge (~15 lines) |
| `src/components/admin/PayoutRunManagement.tsx` | Add `handleDownloadValidation` function + Download button below validation errors/warnings (~20 lines) |

No new files needed. All three files will import `generateCSV` and `downloadCSV` from `src/lib/csvExport.ts` (already available) and `Download` from lucide-react.

