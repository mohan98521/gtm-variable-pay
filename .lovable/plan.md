
# Collections Bulk Upload Feature

## Summary

Add the ability to export pending collections to CSV/XLSX, update collection statuses offline, and re-import to bulk update collection records. This follows the same patterns used in DealsBulkUpload and ClosingARRBulkUpload.

---

## How It Works

1. **Export** - Download all pending collections as a spreadsheet (CSV or XLSX)
2. **Edit** - Update the "is_collected" column to "Yes" or "No" in Excel/Google Sheets
3. **Import** - Upload the modified file to bulk update collection statuses

The system matches records by `project_id` and updates the collection status accordingly.

---

## User Flow

```text
Pending Collections Tab
        │
        ├──► [Export] Button
        │         │
        │         ▼
        │    Downloads spreadsheet with:
        │    - project_id (key)
        │    - customer_name
        │    - deal_value_usd
        │    - booking_month
        │    - is_collected (Yes/No)
        │    - collection_date (optional)
        │
        │
        └──► [Import Status] Button
                  │
                  ▼
             Upload Dialog
                  │
                  ▼
             Parse & Validate
                  │
                  ├──► Errors? → Show error list
                  │
                  └──► Valid? → Preview changes → Apply updates
```

---

## Changes Required

### 1. New Component: CollectionsBulkUpload.tsx

A dialog component following the same pattern as `DealsBulkUpload.tsx`:

| Feature | Description |
|---------|-------------|
| File Support | CSV, XLSX, XLS |
| Drag & Drop | Uses react-dropzone |
| Validation | Checks project_id exists, is_collected is valid |
| Preview | Shows records to be updated before applying |
| Error Handling | Downloadable error CSV |

**Template Columns:**

| Column | Required | Description |
|--------|----------|-------------|
| project_id | Yes | Unique identifier to match collection |
| is_collected | Yes | "Yes" or "No" |
| collection_date | No | Date when collected (auto-set if Yes) |
| notes | No | Optional notes |

### 2. Export Enhancement

Add export to both CSV and XLSX formats with a dropdown menu:

```text
[Export ▼]
  ├─ Export to CSV
  └─ Export to Excel
```

Export will include all fields needed for re-import plus reference fields.

### 3. Hook Update: useBulkImportCollections

Add a new mutation in `useCollections.ts` for bulk import that:
- Looks up collections by project_id
- Updates is_collected, collection_date, and notes
- Automatically sets collection_month when marking collected
- Returns success/failure counts

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/data-inputs/CollectionsBulkUpload.tsx` | CREATE | New bulk upload dialog component |
| `src/components/data-inputs/PendingCollectionsTable.tsx` | MODIFY | Add Import button, enhance Export with CSV option |
| `src/hooks/useCollections.ts` | MODIFY | Add `useBulkImportCollections` mutation |
| `src/pages/DataInputs.tsx` | MODIFY | Wire up bulk upload dialog |

---

## Technical Details

### CollectionsBulkUpload Component Structure

```typescript
interface CollectionsBulkUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedCollection {
  project_id: string;
  is_collected: boolean;
  collection_date?: string;
  notes?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}
```

### Template Generation

```typescript
const TEMPLATE_HEADERS = [
  "project_id",
  "customer_name",      // reference only
  "deal_value_usd",     // reference only
  "booking_month",      // reference only
  "is_collected",       // Yes/No - EDITABLE
  "collection_date",    // YYYY-MM-DD - EDITABLE
  "notes"               // optional - EDITABLE
];
```

### Validation Rules

| Field | Rule |
|-------|------|
| project_id | Required, must exist in deal_collections |
| is_collected | Required, must be Yes/No/Y/N/true/false |
| collection_date | Optional, valid date format if provided |

### Bulk Import Mutation Logic

```typescript
useBulkImportCollections() {
  // For each row:
  // 1. Find collection by project_id
  // 2. Update is_collected, collection_date
  // 3. If is_collected = true, set collection_month = first of current month
  // 4. Track success/failure counts
}
```

---

## UI Design

### Export Dropdown (in PendingCollectionsTable)

```text
┌──────────────────────────────────────────────────────────────────┐
│  [Import Status]   [Export ▼]                                    │
│                     ├─ Export to CSV                             │
│                     └─ Export to Excel                           │
└──────────────────────────────────────────────────────────────────┘
```

### Bulk Upload Dialog

```text
┌──────────────────────────────────────────────────────────────────┐
│  Import Collection Status                                    [X] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Upload a CSV or Excel file with collection status updates.      │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │         📄 Drag & drop your file here                     │  │
│  │            or click to browse                              │  │
│  │                                                            │  │
│  │         Supported: .csv, .xlsx, .xls                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Download Template]                                             │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  Preview (5 records to update)                                   │
│  ┌──────────────┬─────────────┬────────────────┐                │
│  │ Project ID   │ Status      │ Collection Date│                │
│  ├──────────────┼─────────────┼────────────────┤                │
│  │ PRJ-ABC123   │ Pending → ✓ │ 2026-02-01     │                │
│  │ PRJ-DEF456   │ Pending → ✓ │ 2026-02-01     │                │
│  └──────────────┴─────────────┴────────────────┘                │
│                                                                  │
│                                    [Cancel]  [Apply Updates]     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Export File Format

When exporting, the file will contain:

| Column | Source | Editable |
|--------|--------|----------|
| project_id | deal_collections.project_id | No (key) |
| customer_name | deal_collections.customer_name | No (reference) |
| deal_value_usd | deal_collections.deal_value_usd | No (reference) |
| booking_month | deal_collections.booking_month | No (reference) |
| type_of_proposal | deal.type_of_proposal | No (reference) |
| sales_rep_name | deal.sales_rep_name | No (reference) |
| is_collected | "No" (since pending) | **Yes** |
| collection_date | empty | **Yes** |
| notes | empty | **Yes** |

Users edit the `is_collected`, `collection_date`, and `notes` columns, then re-import.

---

## Validation & Error Handling

Errors are displayed inline with a downloadable CSV option:

```text
┌──────────────────────────────────────────────────────────────────┐
│  ⚠️ 3 validation errors found                    [Download Errors]│
├──────────────────────────────────────────────────────────────────┤
│  Row 4: project_id "XXX-123" not found                           │
│  Row 7: is_collected must be Yes or No                           │
│  Row 12: collection_date format invalid                          │
└──────────────────────────────────────────────────────────────────┘
```

---

## Audit Trail

All bulk updates are tracked through the existing `payout_audit_log` trigger which captures:
- Previous values (is_collected = false)
- New values (is_collected = true, collection_date, etc.)
- User who made the change
- Timestamp
