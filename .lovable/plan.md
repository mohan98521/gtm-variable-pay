

## Detailed Workings Report Modifications

### Summary
Three changes to the Detailed Workings report: (1) restructure to a unified single-table-per-employee layout covering all metrics in sequence, (2) add an "Allocated Variable OTE %" column, and (3) increase achievement percentage precision to 4 decimal places.

---

### Change 1: Unified Single-Table Layout

**Current state:** The EmployeeWorkingsCard renders three separate sections/tables -- VP metrics, Three-Way Split, and Payable This Month -- each filtering by component type.

**New structure:** Replace the three-section layout with a single comprehensive table that lists ALL metric rows (VP, Commission, NRR, SPIFF, Deal Team SPIFF, Collection Release, Year-End Release, Clawback) in sequence, grouped by type with sub-header rows. Each row shows the full derivation chain: Target, Actuals, Ach%, Allocated OTE %, Allocated OTE, Multiplier, YTD Eligible, Prior Paid, This Month, and the three-way split (Booking, Collection, Year-End).

The layout will be:

```text
Employee Name (Code) | Plan | Currency | Total: $X,XXX
-------------------------------------------------------------
[Sub-header: Variable Pay]
  Metric 1  | Target | Actuals | Ach% | OTE% | OTE$ | Mult | YTD Elig | Prior | This Mo | Booking | Collection | Year-End
  Metric 2  | ...
  VP Subtotal row

[Sub-header: Commissions]
  Managed Services | ...
  CR/ER | ...

[Sub-header: Additional Pay]
  NRR Additional Pay | ...
  SPIFF | ...
  Deal Team SPIFF | ...

[Sub-header: Releases and Adjustments]
  Collection Release | ...
  Year-End Release | ...
  Clawback | ... (highlighted red)

[Grand Total row]
```

This is built dynamically from the data -- if a new component_type is added to the engine, it will automatically appear in the appropriate group or fall into a catch-all "Other" group.

**File:** `src/components/admin/PayoutRunWorkings.tsx`
- Rewrite `EmployeeWorkingsCard` to render a single table with grouped sub-headers
- Define a component-type ordering map for display sequence
- Use sub-header rows (colSpan) to visually separate groups
- Keep the accordion structure for employee-level expand/collapse

---

### Change 2: Add "Allocated Variable OTE %" Column

The percentage is derived from existing data: `(allocated_ote_usd / target_bonus_usd) * 100`.

**File:** `src/components/admin/PayoutRunWorkings.tsx`
- Add a new column "OTE %" between "Ach %" and "Allocated OTE" in the table header
- Compute and display the percentage per row using the two fields already available in `PayoutMetricDetailRow`

No database or engine changes needed -- both `allocated_ote_usd` and `target_bonus_usd` are already persisted.

---

### Change 3: Achievement % to 4 Decimal Places

**File:** `src/components/admin/PayoutRunWorkings.tsx`
- Update `formatPct` from `value.toFixed(1)` to `value.toFixed(4)`

---

### Technical Details

**Files to modify:**
- `src/components/admin/PayoutRunWorkings.tsx` -- All three changes are in this single file

**No database, engine, or hook changes required.** The data model already supports all the information needed.
