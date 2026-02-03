

# Extend My Deals Report with Collections & Incentive Details

## Summary

Enhance the "My Deals" report to show deal-level collection status and calculated incentive amounts, providing complete transparency into:
- Whether each deal has been collected
- Eligible incentive amounts per deal (commissions)
- Payout breakdown: Booking vs Collection vs Year-End
- Total paid vs pending amounts

---

## What Users Will See

### New Columns in the My Deals Table

| Column | Description |
|--------|-------------|
| **Collection Status** | Pending / Collected / Clawback (with visual badge) |
| **Collection Date** | Date when payment was received (if collected) |
| **Linked to Impl** | Yes/No - affects payout timing (0% booking / 100% collection) |
| **Eligible Incentive** | Total commission amount calculated for this deal |
| **Paid (Booking)** | Amount paid immediately upon booking |
| **Held (Collection)** | Amount held until collection confirmed |
| **Held (Year-End)** | Amount reserved for year-end adjustments |
| **Actual Paid** | Amount actually released (based on collection status) |

### New Summary Metrics (Header Section)

```text
Total Deals: 22  |  Total ARR: $1.2M  |  Total TCV: $3.5M
────────────────────────────────────────────────────────────
Total Eligible Incentive: $45,000  |  Paid on Booking: $31,500
Pending Collection Payout: $13,500  |  Collected Payout: $8,500
```

---

## Data Flow

```text
deals table                deal_collections table           plan_commissions table
     │                            │                               │
     └──────────┬─────────────────┴───────────────────────────────┘
                │
                ▼
    useMyDealsWithIncentives()
                │
                ▼
    ┌───────────────────────────────────────────────────────────┐
    │ For each deal:                                            │
    │  1. Join with deal_collections → get collection status    │
    │  2. Determine commission type from type_of_proposal       │
    │  3. Look up commission rate from plan_commissions         │
    │  4. Calculate: Eligible = Value × Rate                    │
    │  5. Apply payout split based on linked_to_impl flag       │
    │  6. Determine actual paid based on is_collected           │
    └───────────────────────────────────────────────────────────┘
                │
                ▼
        Enhanced DealRecord with incentive fields
```

---

## Commission Calculation Logic Per Deal

### Standard Deals (linked_to_impl = false)

Uses plan's configured payout split (e.g., 70/25/5):

```text
Eligible Incentive = Deal Value × Commission Rate %

Paid on Booking    = Eligible × payout_on_booking_pct
Held for Collection = Eligible × payout_on_collection_pct
Held for Year-End  = Eligible × payout_on_year_end_pct
```

### Implementation-Linked Deals (linked_to_impl = true)

Overrides to 0% booking / 100% collection:

```text
Paid on Booking    = $0
Held for Collection = Eligible × 100%
Held for Year-End  = $0
```

### Actual Paid Calculation

```text
If is_collected = true:
  Actual Paid = Paid on Booking + Held for Collection

If is_collected = false:
  Actual Paid = Paid on Booking only (collection portion still held)
```

---

## Commission Type Mapping

The deal's `type_of_proposal` and value columns map to commission types:

| Deal Field | Commission Type | Value Column |
|------------|----------------|--------------|
| Any deal with `managed_services_usd > 0` | Managed Services | managed_services_usd |
| Any deal with `perpetual_license_usd > 0` | Perpetual License | perpetual_license_usd |
| Any deal with `implementation_usd > 0` | Implementation | implementation_usd |
| Any deal with `cr_usd > 0` or `er_usd > 0` | CR/ER | cr_usd + er_usd |

Each deal can generate multiple commission line items if it has values in multiple columns.

---

## Files to Modify

### 1. New Hook: useMyDealsWithIncentives

**File:** `src/hooks/useMyActualsData.ts` (extend existing)

| Addition | Description |
|----------|-------------|
| Extended DealRecord interface | Add collection and incentive fields |
| useMyDealsWithIncentives hook | Joins deals + deal_collections + calculates commissions |

### 2. Update Report Component

**File:** `src/components/reports/MyDealsReport.tsx`

| Change | Description |
|--------|-------------|
| Use new hook | Replace useMyDeals with useMyDealsWithIncentives |
| Add new table columns | Collection Status, Eligible Incentive, Payout breakdown |
| Add summary section | Total incentives, paid vs pending |
| Update export columns | Include all new fields in CSV/XLSX exports |

---

## Technical Implementation Details

### Extended Deal Record Interface

```typescript
interface DealWithIncentives extends DealRecord {
  // Collection fields (from deal_collections)
  is_collected: boolean;
  collection_date: string | null;
  collection_month: string | null;
  is_clawback_triggered: boolean;
  first_milestone_due_date: string | null;
  
  // Calculated incentive fields
  commission_type: string | null;        // Primary commission category
  eligible_incentive_usd: number;        // Total commission for this deal
  payout_on_booking_usd: number;         // Immediate payout portion
  payout_on_collection_usd: number;      // Held until collection
  payout_on_year_end_usd: number;        // Reserved for adjustments
  actual_paid_usd: number;               // Amount actually released
  
  // Per-category breakdown (if deal has multiple commission types)
  incentive_breakdown: {
    type: string;
    value: number;
    rate: number;
    amount: number;
  }[];
}
```

### Query Strategy

```sql
-- Conceptual join (implemented in hook)
SELECT 
  d.*,
  dc.is_collected,
  dc.collection_date,
  dc.is_clawback_triggered,
  dc.first_milestone_due_date
FROM deals d
LEFT JOIN deal_collections dc ON dc.deal_id = d.id
WHERE d.month_year BETWEEN fiscal_year_start AND fiscal_year_end
```

Commission rates are fetched separately from `plan_commissions` and applied client-side per deal.

---

## UI Visual Indicators

### Collection Status Badge

| Status | Visual |
|--------|--------|
| Pending | Yellow badge: "Pending" |
| Collected | Green badge: "Collected" with date |
| Clawback | Red badge: "Clawback" |
| Overdue | Orange badge: "Overdue" (past due date, not collected) |

### Linked to Impl Indicator

| Value | Visual |
|-------|--------|
| true | Icon + "100% on Collection" tooltip |
| false | Standard split display |

---

## Export Enhancements

New columns added to CSV/XLSX exports:

| Column | Description |
|--------|-------------|
| Collection Status | Pending/Collected/Clawback |
| Collection Date | YYYY-MM-DD or empty |
| Linked to Implementation | Yes/No |
| Commission Type | MS/Perpetual/CR-ER/Impl |
| Eligible Incentive (USD) | Calculated commission |
| Paid on Booking (USD) | Immediate portion |
| Held for Collection (USD) | Pending portion |
| Held for Year-End (USD) | Reserved portion |
| Actual Paid (USD) | Released amount |

---

## Summary Totals Calculation

The summary section will show:

```typescript
const totals = useMemo(() => ({
  // Existing
  count: deals.length,
  totalArr: sum(new_software_booking_arr_usd),
  totalTcv: sum(tcv_usd),
  
  // New incentive totals
  totalEligibleIncentive: sum(eligible_incentive_usd),
  totalPaidOnBooking: sum(payout_on_booking_usd),
  totalHeldForCollection: sum(payout_on_collection_usd),
  totalHeldForYearEnd: sum(payout_on_year_end_usd),
  totalActualPaid: sum(actual_paid_usd),
  
  // Collection status counts
  pendingCount: count where is_collected = false,
  collectedCount: count where is_collected = true,
  clawbackCount: count where is_clawback_triggered = true,
}), [deals]);
```

---

## Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| No plan assignment | Show deal data but no incentive calculation (N/A) |
| Commission type not configured | Show deal value but $0 eligible incentive |
| Multiple commission types per deal | Sum all applicable commissions |
| Deal not in deal_collections | Treat as pending (collection tracking started later) |
| Clawback triggered | Show negative adjustment in Actual Paid |

---

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useMyActualsData.ts` | MODIFY | Add useMyDealsWithIncentives hook with extended interface |
| `src/components/reports/MyDealsReport.tsx` | MODIFY | Add new columns, summary section, visual indicators |

