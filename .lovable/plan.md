

## Auto-Calculate OTE = TFP + TVP

### Summary
Make OTE (On-Target Earnings) a computed field that automatically equals TFP + TVP, for both Local Currency and USD values. This applies to the Employee Form, Plan Assignment Dialog, and Employee Bulk Upload.

---

### 1. Employee Form (`EmployeeFormDialog.tsx`)

- Add `useEffect` watchers on `tfp_local_currency` and `tvp_local_currency` to auto-set `ote_local_currency = tfp + tvp`
- Add `useEffect` watchers on `tfp_usd` and `tvp_usd` to auto-set `ote_usd = tfp + tvp`
- Make both OTE fields **read-only** (disabled input with a subtle background) so users see the computed value but cannot manually override it
- Add a small helper text under OTE fields: "Auto-calculated: TFP + TVP"

---

### 2. Plan Assignment Dialog (`PlanAssignmentDialog.tsx`)

- Add `useEffect` watchers on `tfp_local_currency` and `tvp_local_currency` to auto-set `ote_local_currency = tfp + tvp`
- Add `useEffect` watchers on `tfp_usd` and `target_bonus_usd` to auto-set `ote_usd = tfp + target_bonus`
  - Note: This dialog uses `target_bonus_usd` instead of `tvp_usd`. The TVP (Local) field exists, but on the USD side, the equivalent is "Target Bonus (USD)". The formula will be: `ote_usd = tfp_usd + target_bonus_usd`
- Make both OTE fields read-only with helper text

---

### 3. Employee Bulk Upload (`BulkUpload.tsx`)

- During row parsing, after reading `tfp_local_currency`, `tvp_local_currency`, `tfp_usd`, and `tvp_usd`, auto-calculate OTE values:
  - `ote_local_currency = tfp_local_currency + tvp_local_currency`
  - `ote_usd = tfp_usd + tvp_usd`
- If the CSV provides an OTE value that differs from TFP + TVP, override it with the computed value (the formula is the source of truth)
- The OTE columns remain in the CSV template for reference/visibility, but their values are always recalculated

---

### Technical Details

**Files to modify:**

- **`src/components/admin/EmployeeFormDialog.tsx`**
  - Add two `useEffect` hooks using `form.watch` and `form.setValue` for the auto-calculation
  - Set OTE input fields to `readOnly` with `className="bg-muted/50"`
  - Add `FormDescription` with "Auto-calculated: TFP + TVP"

- **`src/components/admin/PlanAssignmentDialog.tsx`**
  - Add two `useEffect` hooks for auto-calculation
  - Local: `ote_local_currency = tfp_local_currency + tvp_local_currency`
  - USD: `ote_usd = tfp_usd + target_bonus_usd`
  - Set OTE input fields to `readOnly` with muted background
  - Add helper description text

- **`src/components/admin/BulkUpload.tsx`**
  - In the row parsing logic (around line 155), after parsing TFP and TVP values, compute OTE:
    ```
    ote_local = (tfp_local || 0) + (tvp_local || 0)
    ote_usd = (tfp_usd || 0) + (tvp_usd || 0)
    ```
  - Override any user-provided OTE values with the computed result

No database changes required -- this is purely a UI/form-level calculation.
