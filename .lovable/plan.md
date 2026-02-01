

## Fix: "Download Errors" Button Not Visible

### Problem Identified

The "Download Errors" button is not appearing because of a CSS issue. The parent container in `DealsBulkUpload.tsx` uses `overflow-hidden` which clips any content that extends beyond the container height.

When validation errors are shown, the content grows to include:
1. Template download section
2. Fiscal year warning alert
3. Dropzone area
4. Parsed results section with error count
5. Error list (ScrollArea)
6. **Download Errors button** (gets cut off)

The button exists in the code but is visually hidden due to the overflow being clipped.

---

### Root Cause

**File:** `src/components/data-inputs/DealsBulkUpload.tsx`  
**Line 541:**
```tsx
<div className="space-y-4 flex-1 overflow-hidden">
```

The `overflow-hidden` class prevents the button from being visible when the content exceeds the container height.

---

### Solution

Change `overflow-hidden` to `overflow-y-auto` to allow vertical scrolling when content exceeds the available space.

| File | Change |
|------|--------|
| `DealsBulkUpload.tsx` | Change `overflow-hidden` to `overflow-y-auto` on line 541 |
| `ClosingARRBulkUpload.tsx` | Verify the same issue doesn't exist (current implementation already works correctly) |

---

### Code Changes

**DealsBulkUpload.tsx - Line 541:**

Before:
```tsx
<div className="space-y-4 flex-1 overflow-hidden">
```

After:
```tsx
<div className="space-y-4 flex-1 overflow-y-auto">
```

---

### Verification

The ClosingARRBulkUpload.tsx file does not have this issue because its content structure is different and the button appears directly after the Alert component within the visible area.

---

### Summary

This is a one-line CSS fix that changes the overflow behavior from clipping content (`overflow-hidden`) to allowing vertical scrolling (`overflow-y-auto`), ensuring the "Download Errors" button is always accessible when validation errors exist.

