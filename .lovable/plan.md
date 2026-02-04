

# Phase 3: Payout Calculation Engine Implementation

## Overview

Building a complete payout calculation engine that creates payout runs, calculates Variable Pay and Commissions for all employees, and implements the dual-rate conversion logic (Compensation Rate for VP, Market Rate for Commissions).

---

## Architecture Summary

```text
PAYOUT CALCULATION FLOW

┌─────────────────────────────────────────────────────────────────────────┐
│                        PAYOUT RUN CREATION                              │
│                                                                         │
│  1. Admin creates Payout Run for Month X                                │
│     └── Status: DRAFT                                                   │
│                                                                         │
│  2. System validates prerequisites:                                     │
│     ├── All active employees have compensation_exchange_rate            │
│     └── Monthly exchange_rates exist for all currencies (commissions)   │
│                                                                         │
│  3. Run Calculation:                                                    │
│     ├── For each active employee:                                       │
│     │   ├── VARIABLE PAY:                                               │
│     │   │   ├── Fetch plan metrics + multiplier grids                   │
│     │   │   ├── Aggregate YTD deals for New Software ARR                │
│     │   │   ├── Get latest snapshot for Closing ARR                     │
│     │   │   ├── Calculate achievement × multiplier × allocation         │
│     │   │   ├── Apply three-way split (Booking/Collection/Year-End)     │
│     │   │   └── Convert USD → LC using COMPENSATION RATE                │
│     │   │                                                               │
│     │   ├── COMMISSIONS:                                                │
│     │   │   ├── Aggregate deal values by commission type                │
│     │   │   ├── Apply plan commission rates                             │
│     │   │   ├── Apply three-way split                                   │
│     │   │   └── Convert USD → LC using MARKET RATE                      │
│     │   │                                                               │
│     │   └── Persist to monthly_payouts + deal_variable_pay_attribution  │
│     │                                                                   │
│     └── Update payout_runs with totals                                  │
│         └── Status: REVIEW                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Files to Create

### 1. Payout Engine Library
**File: `src/lib/payoutEngine.ts`**

Core calculation engine with:
- `validatePayoutRunPrerequisites()` - Check exchange rates and employee data
- `calculateEmployeeVariablePay()` - VP calculation with compensation rate conversion
- `calculateEmployeeCommissions()` - Commission calculation with market rate conversion
- `calculateMonthlyPayout()` - Orchestrates full calculation for one employee
- `runPayoutCalculation()` - Full batch calculation for all employees
- Interfaces for typed results (EmployeePayoutResult, PayoutRunResult, etc.)

### 2. Payout Runs Hook
**File: `src/hooks/usePayoutRuns.ts`**

React Query hooks for:
- `usePayoutRuns()` - List all payout runs with filtering
- `usePayoutRun()` - Single payout run details
- `useCreatePayoutRun()` - Create new draft payout run
- `useRunPayoutCalculation()` - Trigger calculation for a payout run
- `useUpdatePayoutRunStatus()` - Move between statuses (review, approved, finalized)
- `useFinalizePayoutRun()` - Lock the month and finalize

### 3. Monthly Payouts Hook
**File: `src/hooks/useMonthlyPayouts.ts`**

React Query hooks for:
- `useMonthlyPayouts()` - Get payouts for a run or month
- `useEmployeePayouts()` - Get payouts for specific employee
- `usePayoutSummary()` - Aggregated summary by currency/country

### 4. Payout Run Management UI
**File: `src/components/admin/PayoutRunManagement.tsx`**

Admin interface with:
- List of payout runs with status badges
- Create new payout run button
- Run calculation action
- Status transition buttons (Review → Approved → Finalized)
- Drill-down to view employee payouts
- Validation warnings display

### 5. Payout Run Detail View
**File: `src/components/admin/PayoutRunDetail.tsx`**

Detailed view showing:
- Run summary (total USD, VP, Commissions)
- Employee breakdown table with:
  - Employee name, currency
  - VP (USD + LC) with rate used
  - Commissions (USD + LC) with rate used
  - Booking/Collection/Year-End splits
- Filter by currency/country
- Export to CSV/Excel

### 6. Admin Page Tab Integration
**File: `src/pages/Admin.tsx` (modify)**

Add new "Payout Runs" tab to admin section with PayoutRunManagement component.

---

## Technical Implementation Details

### Dual Rate Conversion Logic

```typescript
// For Variable Pay - use employee's fixed compensation rate
function convertVPToLocal(amountUsd: number, employee: Employee): number {
  const rate = employee.compensation_exchange_rate ?? 1;
  return amountUsd * rate;
}

// For Commissions - use monthly market rate
async function convertCommissionToLocal(
  amountUsd: number, 
  currencyCode: string,
  monthYear: string
): Promise<number> {
  const rate = await getMarketExchangeRate(currencyCode, monthYear);
  return amountUsd * rate;
}
```

### Employee Payout Calculation Flow

```typescript
interface EmployeePayoutCalculation {
  employeeId: string;
  employeeName: string;
  localCurrency: string;
  
  // Variable Pay
  variablePayUsd: number;
  variablePayLocal: number;
  vpCompensationRate: number;
  vpBookingUsd: number;
  vpBookingLocal: number;
  vpCollectionUsd: number;
  vpCollectionLocal: number;
  vpYearEndUsd: number;
  vpYearEndLocal: number;
  
  // Commissions
  commissionsUsd: number;
  commissionsLocal: number;
  commissionMarketRate: number;
  commBookingUsd: number;
  commBookingLocal: number;
  commCollectionUsd: number;
  commCollectionLocal: number;
  commYearEndUsd: number;
  commYearEndLocal: number;
  
  // Totals
  totalPayoutUsd: number;
  totalPayoutLocal: number;
  totalBookingUsd: number;
  totalBookingLocal: number;
}
```

### Prerequisite Validation

Before running calculations, the engine validates:

1. **Compensation Rates**: All active employees have `compensation_exchange_rate` set
2. **Market Rates**: All employee currencies have exchange rates for the target month
3. **Plan Assignments**: Employees have performance targets configured
4. **Month Not Locked**: The month doesn't have a finalized payout run

### Database Writes

For each employee calculation, persist to:

1. **`monthly_payouts`** - One row per employee per payout type (Variable Pay, each Commission type)
   - Links to `payout_run_id`
   - Stores USD and Local amounts
   - Records exchange rate used and type

2. **`deal_variable_pay_attribution`** - One row per deal per employee
   - Pro-rata VP allocation
   - Local currency conversions
   - Links to `payout_run_id`

---

## UI Components Design

### Payout Runs List

| Month | Status | Total Payout (USD) | Employees | Actions |
|-------|--------|-------------------|-----------|---------|
| Jan 2026 | Finalized | $125,000 | 12 | View |
| Feb 2026 | Review | $98,500 | 12 | Approve, View |
| Mar 2026 | Draft | - | - | Calculate, Delete |

### Status Flow

```text
DRAFT → [Calculate] → REVIEW → [Approve] → APPROVED → [Finalize] → FINALIZED
                        ↑
                        └── [Recalculate] ───┘
```

### Create Payout Run Dialog

- Month/Year selector (YYYY-MM format)
- Validation checks displayed:
  - Exchange rates status
  - Employee data completeness
  - Existing run warning
- Notes field
- Create button

### Employee Payouts Table (within Run Detail)

| Employee | Currency | VP (USD) | VP (Local) | Comp Rate | Comm (USD) | Comm (Local) | Market Rate | Total (USD) |
|----------|----------|----------|------------|-----------|------------|--------------|-------------|-------------|
| John Doe | INR | $5,250 | ₹4,72,500 | 90.00 | $1,500 | ₹1,28,250 | 85.50 | $6,750 |
| Jane Smith | AED | $8,000 | 29,380 | 3.67 | $2,000 | 7,100 | 3.55 | $10,000 |

---

## Integration with Existing Code

### Leveraging Existing Modules

1. **`compensationEngine.ts`** - Use existing `calculateAchievementPercent()`, `getMultiplierFromGrid()`, `calculateMetricPayoutFromPlan()`

2. **`commissions.ts`** - Use existing `calculateDealCommission()`, `getCommissionForType()`

3. **`dealVariablePayAttribution.ts`** - Use existing `calculateDealVariablePayAttributions()` for deal-level VP distribution

4. **`useCurrentUserCompensation.ts`** - Reference for employee → plan mapping logic and actuals aggregation

5. **`useExchangeRates.ts`** - Use existing hooks for fetching market rates

### New Queries Added

- Fetch all active employees with compensation details
- Fetch plan metrics and commissions for each employee's plan
- Aggregate deals by employee for the calculation month
- Upsert monthly_payouts records
- Upsert deal_variable_pay_attribution records

---

## Implementation Sequence

### Step 1: Core Engine Library (payoutEngine.ts)
- Type definitions for all calculation results
- Prerequisite validation functions
- Single-employee VP calculation
- Single-employee Commission calculation
- Full batch calculation orchestrator

### Step 2: React Hooks (usePayoutRuns.ts, useMonthlyPayouts.ts)
- CRUD operations for payout_runs
- Calculation trigger mutation
- Status transition mutations
- Query hooks for payouts data

### Step 3: UI Components
- PayoutRunManagement.tsx - List and create runs
- PayoutRunDetail.tsx - View run details and employee breakdowns

### Step 4: Admin Integration
- Add "Payout Runs" tab to Admin page
- Wire up permissions for access control

---

## Permissions Required

| Action | Roles Allowed |
|--------|--------------|
| View Payout Runs | admin, gtm_ops, finance |
| Create Payout Run | admin, gtm_ops |
| Run Calculation | admin, gtm_ops |
| Approve Run | admin, finance |
| Finalize Run | admin |
| View Employee Details | admin, gtm_ops, finance |

---

## Testing Scenarios

1. **Happy Path**: Create run → Calculate → Review → Approve → Finalize
2. **Missing Exchange Rates**: Validation should block calculation
3. **Missing Employee Compensation Rate**: Validation should warn
4. **Recalculation**: Should update existing monthly_payouts
5. **Multi-Currency**: Verify correct rates applied to VP vs Commissions
6. **Month Lock**: Verify deals cannot be modified after finalization

