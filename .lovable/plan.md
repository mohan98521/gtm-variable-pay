

## Fix Target Bonus USD and Add Variable Pay Target Fields

### Problem Summary

The Plan Assignment Dialog has two issues:

1. **Target Bonus (USD) shows as 0** - The form hardcodes `target_bonus_usd: 0` instead of pulling the `tvp_usd` (Target Variable Pay USD) value from the employee database
2. **Missing TVP Local Currency field** - The form doesn't display the Variable Pay Target in Local Currency (`tvp_local_currency`) which would help users understand the compensation structure

---

### Root Cause

In `PlanAssignmentDialog.tsx`, line 160:
```typescript
target_bonus_usd: 0,  // Should be: employee.tvp_usd ?? 0
```

The `Employee` interface in the dialog is also missing `tvp_local_currency` and `tvp_usd` fields, so the data isn't available.

---

### Solution

#### 1. Update Employee Interface

Add the missing fields to the `Employee` interface in `PlanAssignmentDialog.tsx`:

| Field | Type | Description |
|-------|------|-------------|
| tvp_local_currency | number or null | Target Variable Pay in local currency |
| tvp_usd | number or null | Target Variable Pay in USD |

#### 2. Fix Target Bonus USD Mapping

Change line 160 from:
```typescript
target_bonus_usd: 0,
```
to:
```typescript
target_bonus_usd: employee.tvp_usd ?? 0,
```

#### 3. Add TVP Local Currency Field to Form

Add a new input field in the "Local Currency Values" section:

| Current Layout | New Layout |
|----------------|------------|
| TFP (Local), Target Bonus %, OTE (Local) | TFP (Local), Target Bonus %, TVP (Local), OTE (Local) |

This creates a 4-column grid for local currency values.

---

### UI Changes

**Before:**
```text
Local Currency Values
[TFP (Local)] [Target Bonus %] [OTE (Local)]

USD Values  
[TFP (USD)]  [Target Bonus (USD)] [OTE (USD)]
```

**After:**
```text
Local Currency Values
[TFP (Local)] [Target Bonus %]
[TVP (Local)] [OTE (Local)]

USD Values  
[TFP (USD)]  [Target Bonus (USD)] [OTE (USD)]
```

The form will now display the TVP (Variable Pay Target) in local currency for better understanding, and correctly populate the Target Bonus (USD) field from employee master data.

---

### Files to Modify

| File | Changes |
|------|---------|
| src/components/admin/PlanAssignmentDialog.tsx | Add `tvp_local_currency` and `tvp_usd` to Employee interface; Add form field for TVP Local; Fix target_bonus_usd mapping |

---

### Technical Details

1. **Form Schema Update**: Add `tvp_local_currency` field to the Zod schema
2. **Employee Interface Update**: Add `tvp_local_currency?: number | null` and `tvp_usd?: number | null`
3. **Form Reset Logic**: Map `employee.tvp_local_currency` and `employee.tvp_usd` to form values
4. **Submit Payload**: Include `tvp_local_currency` if the `user_targets` table supports it (currently it doesn't store TVP separately, so this will be display-only for reference)

---

### Data Flow

```text
employees table                    PlanAssignmentDialog Form
-----------------                  ------------------------
tfp_local_currency  ──────────────>  TFP (Local)
target_bonus_percent ─────────────>  Target Bonus %
tvp_local_currency  ──────────────>  TVP (Local) [NEW]
ote_local_currency  ──────────────>  OTE (Local)
tfp_usd  ─────────────────────────>  TFP (USD)
tvp_usd  ─────────────────────────>  Target Bonus (USD) [FIXED]
ote_usd  ─────────────────────────>  OTE (USD)
```

---

### Terminology Note

The database uses "TVP" (Target Variable Pay) while the form displays "Target Bonus". These are the same concept:
- **TVP = Target Variable Pay = Target Bonus Amount**
- The formula: `TVP = OTE × Target Bonus %`

