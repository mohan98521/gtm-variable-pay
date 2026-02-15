

## Revised Workings Enhancements

### 1. Remove Currency column
- **Summary view**: Remove "Ccy" column header and data cell
- **Detail view**: Remove currency Badge from accordion trigger

### 2. Add employee metadata columns
Fetch `date_of_hire`, `departure_date`, `is_active`, `business_unit` from the `employees` table in `usePayoutMetricDetails.ts`.

- **Summary view**: Add columns after Emp Name -- Date of Joining, Last Working Day, Status (Active/Inactive), BU
- **Detail view**: Show these fields in the accordion trigger area

### 3. Add Total Variable OTE
- **Summary view**: Add a "Total Variable OTE" column after Plan
- **Detail view**: Display Total Variable OTE as a header line above the metric tables in `EmployeeWorkingsCard`

### 4. Rename "Booking" to "Upon Booking" (split column)
The existing "Booking" column in each metric row represents the portion of incremental eligible allocated to the "Upon Booking" split. Rename it to "Upon Booking" for clarity.

Similarly rename "Collection" to "Upon Collection" and "Year-End" to "At Year End" to match the plan terminology consistently.

### 5. Add Grand Total "Payable This Month" derivation
The true "Current Month Payable" is a derived total that includes:

```text
  Total Upon Booking (across all metrics)
+ Collection Releases (deals collected this month)
+ Year-End Releases (December only)
- Clawback Recovery (carry-forward deductions)
= Current Month Payable
```

Currently, Collection Releases, Year-End Releases, and Clawback Recovery rows only appear when non-zero. The plan is to **always show these rows** as a standard template in the Grand Total section, even when they are zero, so the full derivation is visible.

**Grand Total section will become:**

| Line Item | Amount |
|---|---|
| Total Upon Booking | $X (sum of all metric booking splits) |
| Total Upon Collection (Held) | $X (sum of all metric collection splits) |
| Total At Year End (Held) | $X (sum of all metric year-end splits) |
| Collection Releases | $X (or $0) |
| Year-End Releases | $X (or $0) |
| Clawback Recovery | -$X (or $0) |
| **Current Month Payable** | **$X** (Upon Booking + Releases - Clawbacks) |

This replaces the current single-line Grand Total with a multi-line derivation table.

### Technical Changes

**`src/hooks/usePayoutMetricDetails.ts`**
- Expand `EmployeeWorkings` interface: add `dateOfHire`, `departureDate`, `isActive`, `businessUnit`
- Expand employee select query to include `date_of_hire, departure_date, is_active, business_unit`
- Populate new fields during grouping

**`src/components/admin/PayoutRunWorkings.tsx` (Detail view)**
- Remove currency Badge from accordion trigger
- Add employee metadata (DOJ, LWD, Status, BU) to accordion trigger
- Add Total Variable OTE info line in `EmployeeWorkingsCard` before metric tables
- Rename column labels: "Booking" -> "Upon Booking", "Collection" -> "Upon Collection", "Year-End" -> "At Year End" in `GroupHeader`, `SubtotalRow`
- Replace single-line Grand Total with multi-line derivation table showing all components (Upon Booking total, Upon Collection held, At Year End held, Collection Releases, Year-End Releases, Clawback Recovery, Current Month Payable) -- always displayed even if zero

**`src/components/admin/PayoutRunWorkingsSummary.tsx` (Summary view)**
- Remove "Ccy" column
- Add columns: Date of Joining, Last Working Day, Status, BU, Total Variable OTE
- Rename sub-column labels: "Booking" -> "Upon Booking", "Collection" -> "Upon Collection", "Year-End" -> "At Year End"
- Update Grand Total columns: replace "Booking" with "Current Month Payable" (computed as Upon Booking + Collection Releases + Year-End Releases - Clawback Recovery)
- Keep "Upon Collection (Held)" and "At Year End (Held)" as separate grand total columns

**`src/components/admin/PayoutRunDetail.tsx` (XLSX Export)**
- Remove currency from export columns
- Add Total Variable OTE, Date of Joining, Last Working Day, Status, BU columns
- Rename sub-labels to match: "Upon Booking", "Upon Collection", "At Year End"
- Add "Current Month Payable" as a derived grand total column in the export

### No database or engine changes required
All data (collection releases, year-end releases, clawback recovery) is already persisted in `payout_metric_details` as separate `component_type` rows. The changes are purely display/presentation.
