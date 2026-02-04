
# Plan: Incentive Payout Statement

## Overview

Build an employee-facing **Incentive Payout Statement** component that displays a detailed monthly payout breakdown with:
- Dual-currency display (USD and Local Currency)
- Dual-rate conversion visibility (Compensation Rate for VP, Market Rate for Commissions)
- Three-way payout split breakdown (Paid on Booking, Held for Collection, Held for Year-End)
- Clawbacks section
- Summary totals

This will be available to employees in the Reports section and accessible from the Dashboard.

---

## Architecture

```text
INCENTIVE PAYOUT STATEMENT DATA FLOW

┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Employee Data (employees table)                                        │
│  ├── employee_id, full_name                                             │
│  ├── local_currency (e.g., "INR")                                       │
│  └── compensation_exchange_rate (fixed rate for VP)                     │
│                                                                         │
│  Market Exchange Rate (exchange_rates table)                            │
│  └── rate_to_usd for specific month_year                                │
│                                                                         │
│  Payout Data (monthly_payouts table)                                    │
│  ├── payout_type: "Variable Pay", "Perpetual License", etc.             │
│  ├── calculated_amount_usd / calculated_amount_local                    │
│  ├── booking_amount_usd / booking_amount_local                          │
│  ├── collection_amount_usd / collection_amount_local                    │
│  ├── year_end_amount_usd / year_end_amount_local                        │
│  ├── exchange_rate_used (stored rate)                                   │
│  └── exchange_rate_type ("compensation" or "market")                    │
│                                                                         │
│  Performance Data (deals, closing_arr_actuals)                          │
│  └── For achievement calculation details                                │
│                                                                         │
│  Clawback Data (deal_collections + monthly_payouts)                     │
│  └── Clawback entries (negative amounts in monthly_payouts)             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

                                    │
                                    ▼

┌─────────────────────────────────────────────────────────────────────────┐
│                     HOOK: usePayoutStatement                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Fetches and aggregates:                                                │
│  - Current user's employee profile + rates                              │
│  - Monthly payouts for selected month                                   │
│  - Achievement details per metric                                       │
│  - Commission breakdowns                                                │
│  - Clawback entries                                                     │
│                                                                         │
│  Returns: PayoutStatementData                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

                                    │
                                    ▼

┌─────────────────────────────────────────────────────────────────────────┐
│                   UI: PayoutStatement Component                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ HEADER: Employee Info + Month                                   │    │
│  │ ├── Employee: Sales Engineering Rep (IN0001)                    │    │
│  │ ├── Currency: INR                                               │    │
│  │ └── Period: January 2026                                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ VARIABLE PAY SECTION                                            │    │
│  │ ├── Rate Label: "using Compensation Rate: 90.00 INR/USD"        │    │
│  │ │                                                               │    │
│  │ │ For each metric:                                              │    │
│  │ │ ├── Metric Name (e.g., New Software Booking ARR)              │    │
│  │ │ ├── Target | Actual | Achievement %                          │    │
│  │ │ ├── Multiplier applied                                        │    │
│  │ │ ├── Gross VP: USD + Local Currency                            │    │
│  │ │ └── Breakdown:                                                │    │
│  │ │     ├── Paid on Booking                                       │    │
│  │ │     ├── Held for Collection                                   │    │
│  │ │     └── Held for Year-End                                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ COMMISSIONS SECTION                                             │    │
│  │ ├── Rate Label: "using Market Rate: 85.50 INR/USD for Jan 2026" │    │
│  │ │                                                               │    │
│  │ │ For each commission type:                                     │    │
│  │ │ ├── Commission Type (e.g., Perpetual License)                 │    │
│  │ │ ├── Deal Value | Rate %                                       │    │
│  │ │ ├── Gross Commission: USD + Local Currency                    │    │
│  │ │ └── Special handling (e.g., "linked to impl" = 100% held)     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ CLAWBACKS SECTION                                               │    │
│  │ ├── "None this month" OR                                        │    │
│  │ └── List of clawback entries with amounts                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ SUMMARY SECTION                                                 │    │
│  │ ├── PAID THIS MONTH                                             │    │
│  │ │   ├── Variable Pay: Local (USD) @ Rate                        │    │
│  │ │   └── Commissions: Local (USD) @ Rate                         │    │
│  │ │   ────────────────────────                                    │    │
│  │ │   Total Paid: Local (USD)                                     │    │
│  │ │                                                               │    │
│  │ └── HELD FOR LATER                                              │    │
│  │     ├── For Collection: Local (USD) @ Rate                      │    │
│  │     └── For Year-End: Local (USD) @ Rate                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Files to Create

### 1. Hook: usePayoutStatement
**File: `src/hooks/usePayoutStatement.ts`**

A new hook to fetch payout statement data for a specific employee and month:

```text
Interfaces:
├── PayoutStatementData
│   ├── employeeId: string
│   ├── employeeName: string
│   ├── employeeCode: string
│   ├── monthYear: string (e.g., "2026-01")
│   ├── monthLabel: string (e.g., "January 2026")
│   ├── localCurrency: string
│   ├── compensationRate: number
│   ├── marketRate: number
│   ├── variablePayItems: VariablePayItem[]
│   ├── commissionItems: CommissionItem[]
│   ├── clawbackItems: ClawbackItem[]
│   ├── summary: PayoutSummary
│   └── runStatus: string | null

VariablePayItem:
├── metricName: string
├── target: number
├── actual: number
├── achievementPct: number
├── multiplier: number
├── grossUsd: number
├── grossLocal: number
├── paidOnBookingUsd: number
├── paidOnBookingLocal: number
├── heldForCollectionUsd: number
├── heldForCollectionLocal: number
└── heldForYearEndUsd: number
└── heldForYearEndLocal: number

CommissionItem:
├── commissionType: string
├── dealValue: number
├── rate: number
├── grossUsd: number
├── grossLocal: number
├── isLinkedToImpl: boolean (0% booking / 100% collection)
├── paidOnBookingUsd: number
├── paidOnBookingLocal: number
├── heldForCollectionUsd: number
└── heldForCollectionLocal: number
└── heldForYearEndUsd: number
└── heldForYearEndLocal: number

ClawbackItem:
├── dealId: string | null
├── description: string
├── amountUsd: number
└── amountLocal: number

PayoutSummary:
├── totalPaidUsd: number
├── totalPaidLocal: number
├── vpPaidUsd: number
├── vpPaidLocal: number
├── commPaidUsd: number
├── commPaidLocal: number
├── heldCollectionUsd: number
├── heldCollectionLocal: number
├── heldYearEndUsd: number
└── heldYearEndLocal: number
```

Hook functions:
- `usePayoutStatement(monthYear: string)` - For current user
- `usePayoutStatementForEmployee(employeeId: string, monthYear: string)` - For admin view

---

### 2. Component: PayoutStatement
**File: `src/components/reports/PayoutStatement.tsx`**

Main component that renders the full payout statement using the mockup design:

**Sections:**
1. **Header Card** - Employee info, month, currency
2. **Variable Pay Section** - Collapsible cards per metric with full breakdown
3. **Commissions Section** - Collapsible cards per commission type
4. **Clawbacks Section** - List or "None this month"
5. **Summary Section** - Paid this month + Held for later breakdown

**Features:**
- Month selector dropdown
- Currency display toggles (show/hide USD, show/hide local)
- Print/Export to PDF button
- Responsive design for mobile

---

### 3. Component: PayoutStatementPrintable
**File: `src/components/reports/PayoutStatementPrintable.tsx`**

A print-optimized version of the statement for PDF export/printing:
- Clean layout without interactive elements
- Proper page breaks
- Company header/footer
- Signature/date section

---

### 4. Reports Page Tab Integration
**File: `src/pages/Reports.tsx` (modify)**

Add a new "Payout Statement" tab for employees to view their monthly statements:
- Month selector
- Statement display
- Export options

---

### 5. Dashboard Quick Link (Optional Enhancement)
**File: `src/pages/Dashboard.tsx` (modify)**

Add a card or link to view the current month's payout statement from the dashboard.

---

## Technical Implementation Details

### Data Fetching Strategy

The hook will query data differently based on payout run status:

**If payout run exists for month (finalized/approved):**
- Pull data directly from `monthly_payouts` table
- Use stored `exchange_rate_used` and `exchange_rate_type` values
- Include clawback entries (negative amounts)

**If no payout run exists (preview/estimate):**
- Calculate on-the-fly using existing `useCurrentUserCompensation` logic
- Use current exchange rates
- Show as "Estimated" with appropriate badge

### Dual Currency Formatting

```typescript
// Helper function for dual-currency display
function formatDualCurrency(
  usd: number, 
  local: number, 
  currency: string
): string {
  const usdFormatted = formatCurrency(usd); // $5,250
  const localFormatted = formatLocalCurrency(local, currency); // ₹4,72,500
  return `${localFormatted} (${usdFormatted})`;
}

// Currency symbols map
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  INR: '₹',
  AED: 'د.إ',
  NGN: '₦',
  KES: 'KSh',
  SAR: '﷼',
  SGD: 'S$',
  // ... etc
};
```

### Month Selection

```typescript
// Generate available months based on payout runs or current year
function getAvailableMonths(year: number): string[] {
  const months = [];
  const now = new Date();
  
  for (let m = 1; m <= 12; m++) {
    const monthYear = `${year}-${String(m).padStart(2, '0')}`;
    // Only show months up to current month
    if (new Date(`${monthYear}-01`) <= now) {
      months.push(monthYear);
    }
  }
  return months;
}
```

---

## UI Component Breakdown

### PayoutStatement.tsx Structure

```text
<PayoutStatementContainer>
  │
  ├── <StatementHeader>
  │   ├── Employee name + code
  │   ├── Month/Year display
  │   ├── Currency badge
  │   └── Status badge (if from payout run)
  │
  ├── <MonthSelector>
  │   └── Dropdown with available months
  │
  ├── <VariablePaySection>
  │   ├── Section title with compensation rate callout
  │   │
  │   └── For each metric:
  │       └── <MetricPayoutCard>
  │           ├── Metric name
  │           ├── Achievement row (Target | Actual | %)
  │           ├── Multiplier badge
  │           ├── Gross amounts (USD + Local)
  │           └── Three-way breakdown list
  │
  ├── <CommissionsSection>
  │   ├── Section title with market rate callout
  │   │
  │   └── For each commission:
  │       └── <CommissionPayoutCard>
  │           ├── Commission type
  │           ├── Deal value + Rate
  │           ├── Gross amounts (USD + Local)
  │           ├── Special handling badge (linked to impl)
  │           └── Three-way breakdown list
  │
  ├── <ClawbacksSection>
  │   └── List or "None this month" message
  │
  └── <SummarySection>
      ├── "PAID THIS MONTH" box
      │   ├── VP line with rate
      │   ├── Commission line with rate
      │   └── Total line
      │
      └── "HELD FOR LATER" box
          ├── For Collection line
          └── For Year-End line
</PayoutStatementContainer>
```

---

## Permissions

| Access Level | Capability |
|--------------|------------|
| Sales Rep | View own payout statements only |
| Sales Head | View own + direct reports' statements |
| Admin/GTM Ops/Finance | View all employee statements |

---

## Integration Points

### Existing Hooks to Leverage

1. **`useCurrentUserCompensation`** - For fallback calculation when no payout run exists
2. **`useEmployeePayouts`** - From `useMonthlyPayouts.ts` for fetching stored payouts
3. **`useExchangeRateByMonth`** - For market rate display
4. **Employee compensation_exchange_rate** - From employees table

### New Queries Required

1. Get employee with compensation details:
```sql
SELECT id, employee_id, full_name, local_currency, compensation_exchange_rate
FROM employees 
WHERE employee_id = $1
```

2. Get monthly payouts for employee and month:
```sql
SELECT * FROM monthly_payouts 
WHERE employee_id = $1 AND month_year = $2
ORDER BY payout_type
```

3. Get market rate for month:
```sql
SELECT rate_to_usd FROM exchange_rates
WHERE currency_code = $1 AND month_year = $2
```

---

## Implementation Sequence

### Phase 1: Core Hook
1. Create `usePayoutStatement.ts` with interfaces
2. Implement data fetching from `monthly_payouts`
3. Add fallback to live calculation when no payout run exists
4. Add clawback detection

### Phase 2: Main Component
1. Create `PayoutStatement.tsx` with full layout
2. Implement Variable Pay section with metric cards
3. Implement Commissions section
4. Implement Clawbacks section
5. Implement Summary section

### Phase 3: Month Selection & Navigation
1. Add month selector dropdown
2. Handle month changes
3. Show loading states

### Phase 4: Print/Export
1. Create `PayoutStatementPrintable.tsx`
2. Add print CSS
3. Add PDF export option

### Phase 5: Reports Integration
1. Add "Payout Statement" tab to Reports.tsx
2. Add employee selector for admin view
3. Wire up permissions

---

## Styling Approach

The component will follow existing design patterns:
- Use existing Card, Badge, Table components from shadcn/ui
- Follow the Azentio dark theme color scheme
- Use the existing `formatCurrency` patterns
- Responsive breakpoints for mobile viewing

The statement layout uses a clean, structured format:
- Clear section headers with rate callouts
- Indented sub-items for hierarchy
- Color coding: green for paid, muted for held, red for clawbacks
- Separator lines between major sections
