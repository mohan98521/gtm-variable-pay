

# Comprehensive Payout Structure Redesign

## Overview

This plan introduces a complete payout management system integrated into compensation plans, covering payout frequency, booking vs collection splits, clawback periods, holdback tracking, collection input management, and approval workflows.

---

## Current State Analysis

| Component | Current State |
|-----------|---------------|
| `comp_plans` table | Basic plan info (name, description, year, active) - NO payout config |
| `plan_metrics` table | Metric weightage + logic type - NO payout split config |
| `plan_commissions` table | Rate + threshold - NO payout split config |
| `deals` table | Has `linked_to_impl` column ✓ |
| `monthly_payouts` table | Exists but NOT populated |
| Calculation logic | 75/25 split is HARDCODED in `useCurrentUserCompensation.ts` |

---

## New Data Model

### 1. Add Payout Configuration to `comp_plans`

```sql
ALTER TABLE comp_plans ADD COLUMN payout_frequency text DEFAULT 'monthly';
ALTER TABLE comp_plans ADD COLUMN clawback_period_days integer DEFAULT 180;
```

**payout_frequency options**: `monthly`, `quarterly`, `half_yearly`, `annual`

### 2. Add Payout Split to `plan_metrics`

```sql
ALTER TABLE plan_metrics ADD COLUMN payout_on_booking_pct numeric DEFAULT 75;
ALTER TABLE plan_metrics ADD COLUMN payout_on_collection_pct numeric DEFAULT 25;
```

These will sum to 100% and replace the hardcoded 75/25 split.

### 3. Add Payout Split to `plan_commissions`

```sql
ALTER TABLE plan_commissions ADD COLUMN payout_on_booking_pct numeric DEFAULT 75;
ALTER TABLE plan_commissions ADD COLUMN payout_on_collection_pct numeric DEFAULT 25;
```

### 4. Create `deal_collections` Table

This new table tracks collection status for each deal:

```sql
CREATE TABLE deal_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  booking_month text NOT NULL,
  project_id text NOT NULL,
  customer_name text,
  deal_value_usd numeric NOT NULL DEFAULT 0,
  is_collected boolean DEFAULT false,
  collection_date date,
  collection_amount_usd numeric,
  first_milestone_due_date date,  -- Calculated: booking_month end + clawback_period
  is_clawback_triggered boolean DEFAULT false,
  clawback_amount_usd numeric,
  notes text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

### 5. Enhance `monthly_payouts` Table

Add columns for comprehensive tracking:

```sql
ALTER TABLE monthly_payouts ADD COLUMN deal_id uuid REFERENCES deals(id);
ALTER TABLE monthly_payouts ADD COLUMN plan_id uuid REFERENCES comp_plans(id);
ALTER TABLE monthly_payouts ADD COLUMN metric_id uuid REFERENCES plan_metrics(id);
ALTER TABLE monthly_payouts ADD COLUMN booking_amount_usd numeric DEFAULT 0;
ALTER TABLE monthly_payouts ADD COLUMN collection_amount_usd numeric DEFAULT 0;
ALTER TABLE monthly_payouts ADD COLUMN clawback_amount_usd numeric DEFAULT 0;
ALTER TABLE monthly_payouts ADD COLUMN approval_status text DEFAULT 'pending';
ALTER TABLE monthly_payouts ADD COLUMN approved_by uuid REFERENCES auth.users(id);
ALTER TABLE monthly_payouts ADD COLUMN approved_at timestamp;
```

### 6. Create `payout_audit_log` Table

```sql
CREATE TABLE payout_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id uuid REFERENCES monthly_payouts(id),
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamp DEFAULT now(),
  reason text
);
```

---

## Database Schema Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            COMPENSATION PLAN STRUCTURE                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────┐       ┌───────────────────────┐
│      comp_plans       │       │    plan_metrics       │
├───────────────────────┤       ├───────────────────────┤
│ id                    │◄──────│ plan_id               │
│ name                  │       │ metric_name           │
│ effective_year        │       │ weightage_percent     │
│ payout_frequency  NEW │       │ logic_type            │
│ clawback_period   NEW │       │ payout_on_booking NEW │
└───────────────────────┘       │ payout_on_collec  NEW │
          │                     └───────────────────────┘
          │
          │                     ┌───────────────────────┐
          └────────────────────►│   plan_commissions    │
                                ├───────────────────────┤
                                │ commission_type       │
                                │ commission_rate_pct   │
                                │ payout_on_booking NEW │
                                │ payout_on_collec  NEW │
                                └───────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA & TRACKING                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────┐       ┌───────────────────────┐
│        deals          │       │   deal_collections    │
├───────────────────────┤       ├───────────────────────┤
│ id                    │◄──────│ deal_id               │
│ project_id            │       │ booking_month         │
│ linked_to_impl        │       │ is_collected          │
│ month_year            │       │ collection_date       │
│ ...                   │       │ is_clawback_triggered │
└───────────────────────┘       │ clawback_amount_usd   │
          │                     └───────────────────────┘
          │
          ▼
┌───────────────────────┐       ┌───────────────────────┐
│   monthly_payouts     │       │   payout_audit_log    │
├───────────────────────┤       ├───────────────────────┤
│ id                    │◄──────│ payout_id             │
│ employee_id           │       │ action                │
│ deal_id           NEW │       │ old_values            │
│ booking_amount    NEW │       │ new_values            │
│ collection_amount NEW │       │ changed_by            │
│ clawback_amount   NEW │       │ changed_at            │
│ approval_status   NEW │       │ reason                │
│ approved_by       NEW │       └───────────────────────┘
└───────────────────────┘
```

---

## UI Changes

### 1. Plan Builder - Payout Settings Section (NEW)

Add a new accordion section in `src/pages/PlanBuilder.tsx`:

**Payout Settings Card:**
- Payout Frequency dropdown (Monthly, Quarterly, Half-Yearly, Annual)
- Clawback Period input (days, default 180)

### 2. Metric Form Dialog - Payout Split (MODIFY)

Update `src/components/admin/MetricFormDialog.tsx`:
- Add "Upon Bookings %" input (default 75)
- Add "Upon Collections %" input (default 25)
- Validation: must sum to 100%

### 3. Commission Form Dialog - Payout Split (MODIFY)

Update `src/components/admin/CommissionFormDialog.tsx`:
- Add "Upon Bookings %" input (default 75)
- Add "Upon Collections %" input (default 25)

### 4. Data Inputs - Collections Tab (NEW)

Add new tab in `src/pages/DataInputs.tsx`:

**Collections Input Section:**
- Automatically populated from deals
- Shows: Booking Month, Project ID, Customer, Deal Value, "Is Collected" (Yes/No dropdown)
- When "Yes" selected, shows Collection Date picker
- Clawback indicator: If not collected by due date, show warning
- Bulk upload support for collection status updates

### 5. New Page: Payout Management (NEW)

Create `src/pages/PayoutManagement.tsx`:

**Features:**
- Batch calculation of payouts
- Approval workflow (pending → approved → paid)
- View all payouts by month/employee
- Holdback tracking dashboard
- Clawback alerts and actions

---

## Logic Changes

### 1. Update Compensation Engine

Modify `src/lib/compensationEngine.ts`:

```typescript
interface PayoutSplitConfig {
  payoutOnBookingPct: number;    // e.g., 75
  payoutOnCollectionPct: number; // e.g., 25
}

function calculateMetricPayout(
  metric: PlanMetric,
  achievement: number,
  config: PayoutSplitConfig
) {
  const eligiblePayout = /* existing calculation */;
  
  return {
    bookingAmount: eligiblePayout * (config.payoutOnBookingPct / 100),
    collectionAmount: eligiblePayout * (config.payoutOnCollectionPct / 100),
  };
}
```

### 2. Handle `linked_to_impl` Deals

For deals where `linked_to_impl = true`:
- Override split to 0% booking / 100% collection
- Full amount paid only when collection confirmed

### 3. Clawback Logic

```typescript
function checkClawback(
  bookingMonthEnd: Date,
  clawbackPeriodDays: number,
  isCollected: boolean,
  collectionDate: Date | null
): ClawbackResult {
  const dueDate = addDays(bookingMonthEnd, clawbackPeriodDays);
  const today = new Date();
  
  if (isCollected && collectionDate && collectionDate <= dueDate) {
    return { triggered: false, amount: 0 };
  }
  
  if (today > dueDate && !isCollected) {
    return { triggered: true, amount: bookingPaidAmount };
  }
  
  return { triggered: false, amount: 0, warning: true };
}
```

### 4. Auto-Populate Collections from Deals

Create a hook `useCollections.ts`:
- Fetch all deals for the selected period
- For each deal, create/update a `deal_collections` record
- Calculate `first_milestone_due_date` based on plan's clawback period

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| **Database** | | |
| New Migration | CREATE | Add columns to `comp_plans`, `plan_metrics`, `plan_commissions` |
| New Migration | CREATE | Create `deal_collections` table |
| New Migration | CREATE | Enhance `monthly_payouts` table |
| New Migration | CREATE | Create `payout_audit_log` table |
| **Plan Builder** | | |
| `PlanBuilder.tsx` | MODIFY | Add Payout Settings accordion section |
| `MetricFormDialog.tsx` | MODIFY | Add booking/collection split inputs |
| `CommissionFormDialog.tsx` | MODIFY | Add booking/collection split inputs |
| `CompPlanFormDialog.tsx` | MODIFY | Add payout frequency + clawback period fields |
| **Data Inputs** | | |
| `DataInputs.tsx` | MODIFY | Add Collections tab |
| New: `CollectionsTable.tsx` | CREATE | Table component for collection tracking |
| New: `CollectionFormDialog.tsx` | CREATE | Form for updating collection status |
| New: `CollectionsBulkUpload.tsx` | CREATE | Bulk upload for collection updates |
| **Hooks** | | |
| New: `useCollections.ts` | CREATE | Hook for collection data CRUD |
| New: `usePayouts.ts` | CREATE | Hook for payout persistence and retrieval |
| `useCurrentUserCompensation.ts` | MODIFY | Use dynamic split from plan config instead of hardcoded |
| `usePlanMetrics.ts` | MODIFY | Include new payout split columns |
| `usePlanCommissions.ts` | MODIFY | Include new payout split columns |
| **Engine** | | |
| `compensationEngine.ts` | MODIFY | Add dynamic split calculation, clawback logic |
| **New Pages** | | |
| New: `PayoutManagement.tsx` | CREATE | Approval workflow and payout dashboard |
| **Navigation** | | |
| `AppSidebar.tsx` | MODIFY | Add Payout Management link (for admin/finance roles) |

---

## Payout Workflow

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PAYOUT LIFECYCLE                                   │
└─────────────────────────────────────────────────────────────────────────────┘

  DEAL BOOKED (Data Inputs)
         │
         ▼
  ┌───────────────────┐
  │   CALCULATED      │  ← Payout computed based on plan config
  │   (booking split) │    e.g., 75% of eligible immediately
  └───────────────────┘
         │
         ▼
  ┌───────────────────┐
  │   PENDING         │  ← Awaiting approval
  └───────────────────┘
         │
         ▼ (Finance approves)
  ┌───────────────────┐
  │   APPROVED        │
  └───────────────────┘
         │
         ├─────────────────────────────────────────────┐
         │                                             │
         ▼                                             ▼
  ┌───────────────────┐                        ┌───────────────────┐
  │   PAID (75%)      │                        │   HELD (25%)      │
  │   Booking amount  │                        │   Collection split│
  └───────────────────┘                        └───────────────────┘
                                                       │
         ┌─────────────────────────────────────────────┤
         │                                             │
         ▼ (Collection confirmed)                      ▼ (Clawback triggered)
  ┌───────────────────┐                        ┌───────────────────┐
  │   RELEASED        │                        │   CLAWBACK        │
  │   Holdback paid   │                        │   Deducted from   │
  └───────────────────┘                        │   future payouts  │
                                               └───────────────────┘
```

---

## Implementation Phases

**Phase 1: Database Schema** (Priority: High)
- Create migrations for all new columns and tables
- Add RLS policies for new tables

**Phase 2: Plan Builder UI** (Priority: High)
- Add Payout Settings section
- Update Metric and Commission form dialogs

**Phase 3: Collections Input** (Priority: High)
- New tab in Data Inputs
- Auto-population logic from deals
- Collection status tracking

**Phase 4: Payout Persistence** (Priority: Medium)
- Batch calculation job
- Save to `monthly_payouts` table
- Audit trail logging

**Phase 5: Approval Workflow** (Priority: Medium)
- Payout Management page
- Status transitions
- Role-based access

**Phase 6: Clawback Processing** (Priority: Low)
- Automatic clawback detection
- Clawback application to future payouts
- Reporting

---

## Approval Required

This plan covers:
1. Payout frequency configuration (Monthly/Quarterly/Half-Yearly/Annual)
2. Metric-level booking vs collection split
3. Commission-level booking vs collection split
4. `linked_to_impl` handling (100% on collection)
5. Clawback period configuration
6. Collections input section with auto-population from deals
7. Audit trail for all payout changes
8. Approval workflow for payouts
9. Holdback release mechanism
10. Removal of hardcoded 75/25 split

Shall I proceed with implementation?

