

## Fix Three Issues: Multiplier Logic, Perpetual License Source, and CR/ER Aggregation

### Issue Analysis

Based on my investigation, here are the **root causes** of each issue:

---

### Issue 1: Multiplier Showing 1.0x Instead of 1.6x for 132.2% Achievement

**Root Cause:** The `plan_metrics` table has `logic_type = "Linear"` for all Farmer plan metrics, but the compensation engine treats "Linear" as a pass-through (returns 1.0 multiplier) because it's designed for direct achievement without multipliers.

**Database Evidence:**
| Metric | Logic Type | Multiplier Grids |
|--------|-----------|------------------|
| New Software Booking ARR | **Linear** | 1.0x (0-100%), 1.4x (100-120%), 1.6x (120-999%) |
| Closing ARR | **Linear** | 0.0x (0-85%), 0.8x (85-95%), 1.0x (95-100%), 1.2x (100%+) |

**Problem in compensationEngine.ts (Line 30-32):**
```typescript
// Handle Linear logic - no multipliers, direct achievement
if (metric.logic_type === "Linear" || grids.length === 0) {
  return 1.0;  // ← This short-circuits before checking grids!
}
```

The logic_type is "Linear" but there ARE multiplier grids defined. The code is incorrectly returning 1.0x before it ever checks the grids.

**Fix:** Change the condition to only skip multiplier lookup if `logic_type === "Linear" AND grids.length === 0`:
```typescript
// Handle Linear logic with no grids - no multipliers, direct achievement
if (metric.logic_type === "Linear" && grids.length === 0) {
  return 1.0;
}
```

---

### Issue 2: Perpetual License Deal Value Showing Incorrect Data

**Root Cause:** There is **no dedicated `perpetual_license_usd` column** in the deals table. The current code is using `tcv_usd` (Total Contract Value) as a proxy when `new_software_booking_arr_usd > 0`, which is incorrect.

**Current Logic (useIncentiveAuditData.ts, Lines 355-360):**
```typescript
// Handle Perpetual License separately - check if deal qualifies
// (tcv_usd when it's a software deal, not managed services)
if (deal.tcv_usd && deal.tcv_usd > 0 && (deal.new_software_booking_arr_usd || 0) > 0) {
  const current = aggregatedValues.get('Perpetual License') || 0;
  aggregatedValues.set('Perpetual License', current + (deal.tcv_usd || 0));
}
```

**Why it's wrong:** 
- TCV (Total Contract Value) includes ALL deal components (ARR, implementation, managed services, etc.)
- For "Farming Sales Rep" the TCV is $4,223,732 which is the sum of ALL their deals' TCV values
- Perpetual License should be a specific license type deal, not derived from TCV

**Solution Options:**
1. **Option A (Recommended):** Add a new column `perpetual_license_usd` to the deals table for explicit capture
2. **Option B:** Use a flag (`eligible_for_perpetual_incentive` already exists in schema!) combined with a value column

The deals table already has `eligible_for_perpetual_incentive` boolean field. We should:
1. Add `perpetual_license_usd` column for the actual value
2. Update the bulk upload to capture this value
3. Update the commission logic to use this explicit column

---

### Issue 3: CR/ER Showing Only $50,000 Instead of $110,000

**Root Cause:** The commission aggregation only uses the `cr_usd` column and ignores the `er_usd` column entirely.

**Current Code (useIncentiveAuditData.ts, Lines 336-341):**
```typescript
const commissionTypeMappings = [
  { type: 'Managed Services', field: 'managed_services_usd' as keyof DealRow },
  { type: 'Implementation', field: 'implementation_usd' as keyof DealRow },
  { type: 'CR/ER', field: 'cr_usd' as keyof DealRow },  // ← Only uses cr_usd!
  // Perpetual License uses tcv_usd...
];
```

**Database Evidence:**
| Deal | CR_USD | ER_USD | Total Should Be |
|------|--------|--------|-----------------|
| Deal 1 | $50,000 | $0 | $50,000 |
| Deal 2 | $0 | $60,000 | $60,000 |
| **Total** | $50,000 | $60,000 | **$110,000** |

**Fix:** CR/ER commission type needs to aggregate BOTH `cr_usd` AND `er_usd` columns.

---

### Implementation Plan

#### Step 1: Fix Multiplier Logic Bug

**File:** `src/lib/compensationEngine.ts`

**Change Lines 29-32:**
```typescript
// BEFORE:
if (metric.logic_type === "Linear" || grids.length === 0) {
  return 1.0;
}

// AFTER:
// Only skip multiplier lookup if Linear AND no grids defined
if (metric.logic_type === "Linear" && grids.length === 0) {
  return 1.0;
}
```

**Impact:** The 132.2% achievement will now correctly look up the multiplier grid and return 1.6x instead of 1.0x.

---

#### Step 2: Add Perpetual License USD Column

**Database Migration:**
```sql
-- Add perpetual_license_usd column to deals table
ALTER TABLE deals ADD COLUMN perpetual_license_usd numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN deals.perpetual_license_usd IS 'Perpetual license deal value in USD for commission calculation';
```

**Files to Update:**
1. `src/components/data-inputs/DealsBulkUpload.tsx` - Add column mapping for bulk upload
2. `src/components/data-inputs/DealFormDialog.tsx` - Add input field for manual entry
3. `src/hooks/useIncentiveAuditData.ts` - Use new column for Perpetual License commission
4. `src/integrations/supabase/types.ts` - Will auto-update with migration

---

#### Step 3: Fix CR/ER Aggregation to Include ER

**File:** `src/hooks/useIncentiveAuditData.ts`

**Change the aggregation logic to combine CR and ER:**

```typescript
// BEFORE (Lines 346-353):
commissionTypeMappings.forEach(({ type, field }) => {
  const value = deal[field] as number | null;
  if (value && value > 0) {
    const current = aggregatedValues.get(type) || 0;
    aggregatedValues.set(type, current + value);
  }
});

// AFTER - Handle CR/ER as a special combined case:
employeeDeals.forEach(deal => {
  // Standard commission types
  const standardMappings = [
    { type: 'Managed Services', field: 'managed_services_usd' },
    { type: 'Implementation', field: 'implementation_usd' },
    { type: 'Perpetual License', field: 'perpetual_license_usd' }, // NEW column
  ];
  
  standardMappings.forEach(({ type, field }) => {
    const value = deal[field as keyof DealRow] as number | null;
    if (value && value > 0) {
      const current = aggregatedValues.get(type) || 0;
      aggregatedValues.set(type, current + value);
    }
  });
  
  // CR/ER is special - combine both columns
  const crValue = (deal.cr_usd || 0) + (deal.er_usd || 0);
  if (crValue > 0) {
    const current = aggregatedValues.get('CR/ER') || 0;
    aggregatedValues.set('CR/ER', current + crValue);
  }
});
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/compensationEngine.ts` | Fix multiplier logic condition (Line 30) |
| Database migration | Add `perpetual_license_usd` column |
| `src/hooks/useIncentiveAuditData.ts` | Fix CR/ER aggregation, use new perpetual_license_usd column |
| `src/components/data-inputs/DealsBulkUpload.tsx` | Add perpetual_license_usd column mapping |
| `src/components/data-inputs/DealFormDialog.tsx` | Add perpetual license input field |
| `src/components/data-inputs/DealsTable.tsx` | Display perpetual license column |

---

### Expected Results After Fix

| Issue | Before | After |
|-------|--------|-------|
| 1. Multiplier for 132.2% | 1.00x | **1.60x** |
| 2. Perpetual License source | Derived from TCV (incorrect) | Explicit `perpetual_license_usd` column |
| 3. CR/ER total | $50,000 (only CR) | **$110,000** (CR + ER) |

---

### Data Flow After Fix

```text
deals table
│
├── cr_usd ─────────────┐
│                       ├──→ CR/ER Commission = (cr_usd + er_usd) × rate
├── er_usd ─────────────┘
│
├── perpetual_license_usd ──→ Perpetual License Commission (NEW)
│
├── managed_services_usd ───→ Managed Services Commission
│
└── implementation_usd ─────→ Implementation Commission
```

