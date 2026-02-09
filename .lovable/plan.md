

# Plan: Add Month Selector for Exchange Rate Template & Upload

## Problem
1. No way to select a specific month before downloading the template -- it defaults to the current month only
2. The template should dynamically include all currencies required for that specific month (based on employee assignments)
3. The "Missing Exchange Rates" warning is also hardcoded to the current month

## Changes (single file: `src/components/admin/ExchangeRateManagement.tsx`)

### 1. Add a Month Picker to the Bulk Upload Card

Add a month input (`<Input type="month" />`) in the upload card, between the header and the Download Template / Add Rate Manually buttons. This `templateMonth` state will:
- Default to the current month (e.g., `2026-02`)
- Drive the template download (currencies + pre-filled rates for that month)
- Update the "Missing Exchange Rates" warning to reflect the selected month

### 2. Update `generateTemplate` to Use Selected Month

Currently it uses `format(new Date(), "yyyy-MM")`. Change it to use the new `templateMonth` state variable so the downloaded CSV contains rows for the selected month.

### 3. Update Missing Rates Warning to Use Selected Month

Currently the warning card checks `currentMonth` (hardcoded to today). Update it to use the `templateMonth` state so it shows which currencies are missing for the month the user is working on.

### 4. UI Layout

The upload section will look like:

```text
+--------------------------------------------------+
| Exchange Rate Bulk Upload                        |
| Upload monthly market exchange rates via CSV...  |
|                                                  |
| Month: [February 2026 v]                        |
|                                                  |
| [Download Template]  [+ Add Rate Manually]       |
|                                                  |
| +----------------------------------------------+|
| |  Drag & drop a CSV file here                 ||
| +----------------------------------------------+|
+--------------------------------------------------+
```

## Technical Details

| What | Detail |
|------|--------|
| New state | `const [templateMonth, setTemplateMonth] = useState(format(new Date(), "yyyy-MM"))` |
| Template download | Replace `format(new Date(), "yyyy-MM")` with `templateMonth` in `generateTemplate()` |
| Missing rates | Replace `currentMonth` (line 423) with `templateMonth` for the warning check |
| Warning text | Update the label from hardcoded `format(new Date(), "MMMM yyyy")` to dynamically parse `templateMonth` |
| Lines affected | ~10 lines modified, ~5 lines added |

No new files, no database changes.

