

# Enhanced Collections Tracking System

## Summary

This plan redesigns the Collections tab in Data Inputs to provide a more intuitive, cumulative tracking system for deal collections. Collections are **automatically generated from Deals** (not Closing ARR) and tracked month-over-month until collected, then moved to a "Collected Deals" report.

---

## Current State Analysis

| Component | Current Behavior |
|-----------|-----------------|
| `deal_collections` table | Auto-populated via trigger when deals are created |
| Collections Tab | Shows all collections filtered by booking month |
| Status Tracking | Simple Yes/No with collection date |
| Audit Trail | Already exists via `payout_audit_log` table |

## Problems to Solve

1. **Closing ARR should NOT be linked to Collections** - Already correct, but need to clarify in UI
2. **Collections view needs improvement** - Currently shows by booking month, not cumulative pending
3. **Month-over-month tracking** - Need to show deals as pending until collected
4. **Collected deals report** - Need separate view for completed collections
5. **Audit trail enhancement** - Capture collection month for payout processing

---

## Changes Required

### 1. Database Schema Enhancement

Add `collection_month` column to track when collection was made (for payroll):

```sql
ALTER TABLE deal_collections 
ADD COLUMN collection_month date;
```

Update trigger to set `collection_month` when `is_collected` changes to true.

### 2. UI Redesign - Collections Tab Split

Replace single Collections table with two sub-tabs:

```text
Collections Tab
├── Pending Collections (default view)
│   └── Shows all deals NOT yet collected (is_collected = false)
│   └── Cumulative view across all months
│   └── Organized by booking month age
│   
└── Collected Deals Report
    └── Shows all collected deals (is_collected = true)
    └── Filtered by collection month
    └── For payroll processing reference
```

### 3. Pending Collections View

**Purpose:** Show all deals where collection is pending, regardless of booking month

**Key Features:**
- Sorted by age (oldest bookings first - priority)
- Shows booking month + how many months pending
- Quick "Mark as Collected" action
- Bulk collection update capability
- Filter by sales rep, BU, region

**Columns:**
| Column | Description |
|--------|-------------|
| Booking Month | When deal was booked |
| Months Pending | Number of months since booking |
| Project ID | Deal identifier |
| Customer | Customer name |
| Type | Type of proposal |
| Sales Rep | Assigned sales rep |
| Deal Value | TCV in USD |
| Due Date | First milestone due date |
| Status | Pending / Overdue |
| Collection | Yes/No dropdown |
| Actions | Edit details |

### 4. Collected Deals Report

**Purpose:** Show all collected deals for payroll processing

**Key Features:**
- Filter by collection month (when marked as collected)
- Shows audit trail of when collection was processed
- Export capability for finance

**Columns:**
| Column | Description |
|--------|-------------|
| Collection Month | Month when marked as collected |
| Booking Month | Original booking month |
| Project ID | Deal identifier |
| Customer | Customer name |
| Type | Type of proposal |
| Sales Rep | Assigned sales rep |
| Deal Value | Amount collected |
| Collection Date | Specific date of collection |
| Updated By | Who marked it collected |

### 5. Updated Hook Functions

**New hooks in `useCollections.ts`:**

```typescript
// Pending collections - cumulative across all months
export function usePendingCollections() {
  return useQuery({
    queryKey: ["deal_collections", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_collections")
        .select(`*, deal:deals(...)`)
        .eq("is_collected", false)
        .eq("is_clawback_triggered", false)
        .order("booking_month", { ascending: true }); // Oldest first
      // ...
    }
  });
}

// Collected deals by collection month
export function useCollectedDeals(collectionMonth?: string) {
  return useQuery({
    queryKey: ["deal_collections", "collected", collectionMonth],
    queryFn: async () => {
      let query = supabase
        .from("deal_collections")
        .select(`*, deal:deals(...)`)
        .eq("is_collected", true);
      
      if (collectionMonth) {
        query = query.eq("collection_month", collectionMonth);
      }
      
      return query.order("collection_date", { ascending: false });
    }
  });
}
```

### 6. Update Collection Mutation

When marking as collected, automatically set `collection_month`:

```typescript
const { data, error } = await supabase
  .from("deal_collections")
  .update({
    is_collected: true,
    collection_date: collectionDate,
    collection_month: format(parseISO(collectionDate), "yyyy-MM-01"),
    collection_amount_usd: amount,
    updated_by: user?.id,
  })
  .eq("id", id);
```

### 7. Enhanced Audit Trail

The existing `payout_audit_log` trigger already captures:
- Old values (before update)
- New values (after update)
- Changed by (user ID)
- Changed at (timestamp)

This automatically tracks when collection status changed from No to Yes.

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| **Database** | | |
| New Migration | CREATE | Add `collection_month` column to `deal_collections` |
| **Components** | | |
| `src/components/data-inputs/PendingCollectionsTable.tsx` | CREATE | New component for pending collections view |
| `src/components/data-inputs/CollectedDealsTable.tsx` | CREATE | New component for collected deals report |
| `src/components/data-inputs/CollectionsTable.tsx` | MODIFY | Update to use new split view design |
| **Hooks** | | |
| `src/hooks/useCollections.ts` | MODIFY | Add `useCollectedDeals` hook, update mutations |
| **Pages** | | |
| `src/pages/DataInputs.tsx` | MODIFY | Redesign Collections tab with sub-tabs |

---

## Visual Design

### Collections Tab - New Layout

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Collections                                                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────┐ ┌─────────────────────────┐                         │
│ │ Pending Collections (24)│ │ Collected Deals Report  │                         │
│ └─────────────────────────┘ └─────────────────────────┘                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ [Stats Cards]                                                                    │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│ │ Total Pending│ │ Overdue      │ │ Due This Month│ │ Total Value │            │
│ │     24       │ │      3       │ │      8        │ │  $4.2M      │            │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                                  │
│ [Table: Pending Collections]                                                     │
│ ┌───────────┬───────┬───────────┬──────────┬─────────┬────────┬────────┬──────┐│
│ │Booking    │Months │Project ID │Customer  │Type     │Sales   │Value   │Status││
│ │Month      │Pending│           │          │         │Rep     │        │      ││
│ ├───────────┼───────┼───────────┼──────────┼─────────┼────────┼────────┼──────┤│
│ │Jan 2026   │  1    │PRJ-ABC123 │Acme Corp │AMC      │John D. │$125,000│ ⚠️   ││
│ │Jan 2026   │  1    │PRJ-DEF456 │Beta Inc  │Subscr.  │Jane S. │$250,000│Pending││
│ │Feb 2026   │  0    │PRJ-GHI789 │Gamma LLC │Impl     │Bob R.  │$180,000│Pending││
│ └───────────┴───────┴───────────┴──────────┴─────────┴────────┴────────┴──────┘│
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Collected Deals Report View

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Collected Deals Report                                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Collection Month: [February 2026 ▼]                              [Export CSV]    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ ┌───────────┬───────────┬───────────┬──────────┬─────────┬────────┬───────────┐│
│ │Collection │Booking    │Project ID │Customer  │Type     │Value   │Collected  ││
│ │Date       │Month      │           │          │         │        │By         ││
│ ├───────────┼───────────┼───────────┼──────────┼─────────┼────────┼───────────┤│
│ │Feb 15, 26 │Nov 2025   │PRJ-XYZ001 │Delta Co  │AMC      │$95,000 │Admin      ││
│ │Feb 10, 26 │Dec 2025   │PRJ-XYZ002 │Echo Ltd  │Subscr.  │$150,000│Finance    ││
│ └───────────┴───────────┴───────────┴──────────┴─────────┴────────┴───────────┘│
│                                                                                  │
│ Total Collected This Month: $245,000                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```text
        Deal Created/Uploaded
               │
               ▼
    ┌─────────────────────────┐
    │ Deals Table             │
    │ (deals)                 │
    └─────────────────────────┘
               │
               │ (Auto-trigger)
               ▼
    ┌─────────────────────────┐
    │ Deal Collections        │
    │ (deal_collections)      │
    │ is_collected = false    │
    └─────────────────────────┘
               │
               ▼
    ┌─────────────────────────┐
    │ Pending Collections Tab │
    │ Shows all pending deals │
    │ Month-over-month        │
    └─────────────────────────┘
               │
               │ (Mark as Collected)
               ▼
    ┌─────────────────────────┐
    │ Deal Collections        │
    │ is_collected = true     │
    │ collection_month = X    │
    └─────────────────────────┘
               │
               ▼
    ┌─────────────────────────┐
    │ Collected Deals Report  │
    │ For payroll processing  │
    └─────────────────────────┘
```

---

## Example Scenario

**Deal X booked in January 2026:**

| Month | Status in Pending Tab | Status in Collected Report |
|-------|----------------------|---------------------------|
| January 2026 | Shows as "Pending" (0 months) | Not visible |
| February 2026 | Shows as "Pending" (1 month) | Not visible |
| March 2026 | User marks as "Collected" | Appears in March report |
| April 2026 | Not visible (already collected) | Visible in March report |

---

## Key Points

1. **Closing ARR is NOT linked to Collections** - Collections only come from Deals
2. **Cumulative view** - Pending tab shows ALL pending deals, not filtered by month
3. **Automatic flow** - Deals automatically create collection records via trigger
4. **Clear separation** - Pending vs Collected in separate views
5. **Payroll integration** - Collection month tracks when processed for payroll
6. **Audit trail** - Already exists via `payout_audit_log` trigger

