

# Plan: Phase 6 - Audit & Compliance

## Executive Summary

This phase implements comprehensive audit logging with rate tracking, enhanced adjustment workflows, and builds the remaining reporting suite with dual-currency support. The existing infrastructure provides a solid foundation:

| Component | Current State | Required Work |
|-----------|--------------|---------------|
| `payout_audit_log` table | Exists with basic structure | Enhance with rate tracking columns |
| Database triggers | `log_payout_change`, `log_collection_change` exist | Add `log_payout_run_change` trigger |
| Adjustment workflow | `payout_adjustments` table + UI exists | Enhance approval flow |
| Employee Payout Statement | Implemented | None |
| Management Summary Report | Not implemented | Build new |
| Country/Currency Breakdown | Partial (in PayoutRunDetail) | Extract to standalone report |
| Year-End Holdback Tracker | Not implemented | Build new |
| Audit Trail Export | Not implemented | Build new |

---

## Part 1: Enhanced Audit Logging Schema

### 1.1 Extend payout_audit_log Table

Add new columns to track exchange rates and categorize audit events:

```text
New Columns:
├── audit_category: text ('run_lifecycle', 'calculation', 'rate_usage', 'adjustment')
├── compensation_rate: numeric (rate used for VP)
├── market_rate: numeric (rate used for commissions)
├── rate_type: text ('compensation', 'market')
├── rate_variance_pct: numeric (difference between comp and market rates)
├── is_rate_mismatch: boolean (true if variance > 10%)
└── metadata: jsonb (flexible storage for additional context)
```

### 1.2 Create Audit Event Types

Define standardized event types matching the requirements:

```text
Audit Event Types:
├── RUN_CREATED       - New payout run initialized
├── RUN_CALCULATED    - Calculation completed
├── RUN_STATUS_CHANGE - Status transition (draft → review → approved → finalized → paid)
├── RUN_FINALIZED     - Month locked
├── RATE_USED_COMP    - Compensation rate applied
├── RATE_USED_MARKET  - Market rate applied
├── RATE_MISMATCH     - Significant variance detected
├── PAYOUT_CALCULATED - Individual employee payout calculated
├── CLAWBACK_APPLIED  - Clawback executed
├── ADJUSTMENT_CREATED
├── ADJUSTMENT_APPROVED
├── ADJUSTMENT_REJECTED
└── ADJUSTMENT_APPLIED
```

---

## Part 2: Database Migration

### Migration SQL

```sql
-- Extend payout_audit_log for comprehensive tracking
ALTER TABLE public.payout_audit_log
  ADD COLUMN IF NOT EXISTS audit_category text,
  ADD COLUMN IF NOT EXISTS compensation_rate numeric,
  ADD COLUMN IF NOT EXISTS market_rate numeric,
  ADD COLUMN IF NOT EXISTS rate_type text,
  ADD COLUMN IF NOT EXISTS rate_variance_pct numeric,
  ADD COLUMN IF NOT EXISTS is_rate_mismatch boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Create index for efficient audit queries
CREATE INDEX IF NOT EXISTS idx_payout_audit_log_category 
  ON public.payout_audit_log(audit_category);
CREATE INDEX IF NOT EXISTS idx_payout_audit_log_month 
  ON public.payout_audit_log(month_year);

-- Trigger function to log payout run changes
CREATE OR REPLACE FUNCTION public.log_payout_run_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payout_audit_log (
      payout_run_id, action, entity_type, audit_category, 
      new_values, changed_by, month_year
    )
    VALUES (
      NEW.id, 'created', 'payout_run', 'run_lifecycle',
      to_jsonb(NEW), auth.uid(), NEW.month_year
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.run_status != NEW.run_status THEN
      INSERT INTO public.payout_audit_log (
        payout_run_id, action, entity_type, audit_category,
        old_values, new_values, changed_by, month_year
      )
      VALUES (
        NEW.id, 
        CASE 
          WHEN NEW.run_status = 'finalized' THEN 'finalized'
          WHEN NEW.run_status = 'paid' THEN 'paid'
          ELSE 'status_changed'
        END,
        'payout_run', 'run_lifecycle',
        jsonb_build_object('run_status', OLD.run_status),
        jsonb_build_object('run_status', NEW.run_status),
        auth.uid(), NEW.month_year
      );
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger on payout_runs
CREATE TRIGGER log_payout_run_changes
  AFTER INSERT OR UPDATE ON public.payout_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_payout_run_change();

-- Trigger function to log payout adjustments
CREATE OR REPLACE FUNCTION public.log_adjustment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_month_year date;
BEGIN
  -- Get month from payout run
  SELECT month_year INTO v_month_year
  FROM public.payout_runs
  WHERE id = COALESCE(NEW.payout_run_id, OLD.payout_run_id);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payout_audit_log (
      payout_run_id, action, entity_type, audit_category,
      employee_id, amount_usd, amount_local, local_currency,
      exchange_rate_used, new_values, changed_by, month_year, reason
    )
    VALUES (
      NEW.payout_run_id, 'adjustment_created', 'adjustment', 'adjustment',
      NEW.employee_id, NEW.adjustment_amount_usd, NEW.adjustment_amount_local,
      NEW.local_currency, NEW.exchange_rate_used,
      to_jsonb(NEW), auth.uid(), v_month_year, NEW.reason
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      INSERT INTO public.payout_audit_log (
        payout_run_id, action, entity_type, audit_category,
        employee_id, amount_usd, amount_local, local_currency,
        old_values, new_values, changed_by, month_year, reason
      )
      VALUES (
        NEW.payout_run_id,
        CASE NEW.status
          WHEN 'approved' THEN 'adjustment_approved'
          WHEN 'rejected' THEN 'adjustment_rejected'
          WHEN 'applied' THEN 'adjustment_applied'
          ELSE 'adjustment_updated'
        END,
        'adjustment', 'adjustment',
        NEW.employee_id, NEW.adjustment_amount_usd, NEW.adjustment_amount_local,
        NEW.local_currency,
        jsonb_build_object('status', OLD.status),
        jsonb_build_object('status', NEW.status, 'applied_to_month', NEW.applied_to_month),
        auth.uid(), v_month_year, NEW.reason
      );
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger on payout_adjustments
CREATE TRIGGER log_adjustment_changes
  AFTER INSERT OR UPDATE ON public.payout_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_adjustment_change();
```

---

## Part 3: Audit Logging Utility Functions

### 3.1 New File: `src/lib/auditLogger.ts`

Create utility functions for programmatic audit logging:

```text
Functions:
├── logPayoutCalculation(runId, employeeId, amounts, rates)
│   └── Logs individual payout calculation with rate tracking
│
├── logRateUsage(runId, employeeId, rateType, rate, currency)
│   └── Records exchange rate usage
│
├── logRateMismatch(runId, employeeId, compRate, marketRate, variancePct)
│   └── Flags significant rate differences (>10%)
│
├── logRunFinalization(runId, monthYear)
│   └── Records month lock event
│
└── logClawbackExecution(runId, dealId, amounts)
    └── Records clawback application
```

### 3.2 Update payoutEngine.ts

Integrate audit logging into the calculation flow:

```text
Enhanced Calculation Flow:
1. runPayoutCalculation()
   ├── Log "run_calculated" at start
   │
   ├── For each employee:
   │   ├── Log compensation rate usage
   │   ├── Log market rate usage
   │   ├── Check rate variance → log mismatch if >10%
   │   └── Log individual payout calculation
   │
   └── Log run totals at completion

2. checkAndApplyClawbacks()
   └── Log each clawback execution
```

---

## Part 4: New Reports

### 4.1 Management Summary Report

**Purpose:** Aggregated view for executives in USD

**File:** `src/components/reports/ManagementSummary.tsx`

```text
Management Summary Layout:
┌─────────────────────────────────────────────────────────────────────────┐
│                    MANAGEMENT SUMMARY - FY 2026                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ANNUAL TOTALS (USD)                                                    │
│  ─────────────────────                                                  │
│  Total Variable Pay:           $1,234,567                               │
│  Total Commissions:            $567,890                                 │
│  Total Clawbacks:              ($23,456)                                │
│  Net Payout:                   $1,779,001                               │
│                                                                         │
│  BY QUARTER                                                             │
│  ───────────────────────────────────────────────────────────────        │
│  │ Quarter │ VP (USD)  │ Comm (USD) │ Clawback │ Net Total │            │
│  │ Q1      │ $345,678  │ $156,789   │ ($5,678) │ $496,789  │            │
│  │ Q2      │ $289,012  │ $134,567   │ ($8,901) │ $414,678  │            │
│  │ Q3      │ $312,456  │ $145,678   │ ($4,567) │ $453,567  │            │
│  │ Q4      │ $287,421  │ $130,856   │ ($4,310) │ $413,967  │            │
│                                                                         │
│  BY SALES FUNCTION                                                      │
│  ───────────────────────────────────────────────────────────────        │
│  │ Function   │ Headcount │ VP (USD)  │ Comm (USD) │ Avg/HC   │         │
│  │ Hunter     │ 12        │ $456,789  │ $234,567   │ $57,613  │         │
│  │ Farmer     │ 15        │ $378,901  │ $189,012   │ $37,861  │         │
│  │ CSM        │ 8         │ $234,567  │ $89,012    │ $40,447  │         │
│  │ ...        │ ...       │ ...       │ ...        │ ...      │         │
│                                                                         │
│  [Export XLSX]                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Data Sources:**
- `payout_runs` - Run totals
- `monthly_payouts` - Detailed breakdown
- `employees` - Headcount by function

### 4.2 Country/Currency Breakdown Report

**Purpose:** Local currency grouped analysis

**File:** `src/components/reports/CurrencyBreakdown.tsx`

```text
Currency Breakdown Layout:
┌─────────────────────────────────────────────────────────────────────────┐
│               COUNTRY/CURRENCY BREAKDOWN - January 2026                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  INDIA (INR)                               Comp Rate: 90.00             │
│  ─────────────────────────────────         Market Rate: 85.50           │
│  Employees: 18                                                          │
│  Total VP (INR):     ₹45,67,890            ($50,754 USD)                │
│  Total Comm (INR):   ₹12,34,567            ($14,439 USD @ market)       │
│  Total Payout:       ₹57,02,457            ($65,193 USD)                │
│                                                                         │
│  UAE (AED)                                 Comp Rate: 3.67               │
│  ─────────────────────────────────         Market Rate: 3.67            │
│  Employees: 5                                                           │
│  Total VP (AED):     AED 234,567           ($63,916 USD)                │
│  Total Comm (AED):   AED 89,012            ($24,252 USD)                │
│  Total Payout:       AED 323,579           ($88,168 USD)                │
│                                                                         │
│  ... (other currencies)                                                 │
│                                                                         │
│  [Export by Currency]                                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Year-End Holdback Tracker

**Purpose:** Track accumulated year-end reserves

**File:** `src/components/reports/YearEndHoldbackTracker.tsx`

```text
Year-End Holdback Tracker Layout:
┌─────────────────────────────────────────────────────────────────────────┐
│                   YEAR-END HOLDBACK TRACKER - FY 2026                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SUMMARY                                                                │
│  ─────────────────────────                                              │
│  Total Accumulated Holdback (USD):    $234,567                          │
│  Total Accumulated Holdback (Local):  Varies by currency                │
│  Release Date:                        December 2026 Payroll             │
│                                                                         │
│  BY EMPLOYEE                                                            │
│  ───────────────────────────────────────────────────────────────        │
│  │ Employee       │ Currency │ Comp Rate │ YTD VP Hold │ YTD Comm Hold ││
│  │ John Smith     │ INR      │ 90.00     │ ₹1,57,500   │ ₹45,678       ││
│  │ Jane Doe       │ AED      │ 3.67      │ AED 12,345  │ AED 4,567     ││
│  │ ...            │ ...      │ ...       │ ...         │ ...           ││
│                                                                         │
│  BY MONTH                                                               │
│  ───────────────────────────────────────────────────────────────        │
│  │ Month     │ VP Holdback │ Comm Holdback │ Running Total │            │
│  │ Jan 2026  │ $12,345     │ $4,567        │ $16,912       │            │
│  │ Feb 2026  │ $13,456     │ $5,678        │ $36,046       │            │
│  │ ...       │ ...         │ ...           │ ...           │            │
│                                                                         │
│  [Export Detail]                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Audit Trail Export

**Purpose:** Comprehensive audit log with rate tracking

**File:** `src/components/reports/AuditTrailExport.tsx`

```text
Audit Trail Export Layout:
┌─────────────────────────────────────────────────────────────────────────┐
│                     AUDIT TRAIL EXPORT - FY 2026                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FILTERS                                                                │
│  ───────────────────                                                    │
│  Date Range: [Jan 2026] - [Dec 2026]                                    │
│  Category:   [All ▼]  (Run Lifecycle / Calculation / Rate / Adjustment) │
│  Employee:   [All ▼]                                                    │
│                                                                         │
│  AUDIT LOG                                                              │
│  ───────────────────────────────────────────────────────────────        │
│  │ Timestamp           │ Event            │ Employee   │ Details      │ │
│  │ 2026-01-15 10:23:45 │ RUN_CREATED      │ -          │ Jan 2026     │ │
│  │ 2026-01-15 10:25:12 │ RATE_USED_COMP   │ John Smith │ 90.00 INR/USD│ │
│  │ 2026-01-15 10:25:12 │ RATE_USED_MARKET │ John Smith │ 85.50 INR/USD│ │
│  │ 2026-01-15 10:25:12 │ RATE_MISMATCH    │ John Smith │ 5.26% variance││
│  │ 2026-01-15 10:25:15 │ PAYOUT_CALCULATED│ John Smith │ $5,250 USD   │ │
│  │ 2026-01-15 11:00:00 │ RUN_FINALIZED    │ -          │ Month locked │ │
│  │ 2026-01-20 09:15:30 │ ADJUSTMENT_CREATE│ John Smith │ +$500 correct│ │
│  │ 2026-01-20 14:30:00 │ ADJUSTMENT_APPROV│ John Smith │ Approved     │ │
│                                                                         │
│  [Export Full Audit Trail]                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Hooks to Create

### 5.1 useAuditLog Hook

**File:** `src/hooks/useAuditLog.ts`

```text
Hook Interface:
├── useAuditLog(filters: AuditLogFilters)
│   └── Paginated audit log with filtering
│
├── useAuditLogByRun(runId: string)
│   └── All audit entries for a specific run
│
├── useRateMismatches(year: number)
│   └── All rate mismatch warnings
│
└── AuditLogFilters:
    ├── startDate: string
    ├── endDate: string
    ├── category: string[]
    ├── employeeId?: string
    └── runId?: string
```

### 5.2 useManagementSummary Hook

**File:** `src/hooks/useManagementSummary.ts`

```text
Hook Interface:
├── useManagementSummary(year: number)
│   └── Returns:
│       ├── annualTotals: { vpUsd, commUsd, clawbackUsd, netUsd }
│       ├── byQuarter: { q1, q2, q3, q4 }
│       └── byFunction: Map<salesFunction, totals>
│
└── useManagementSummaryByMonth(year: number)
    └── Monthly breakdown for trend analysis
```

### 5.3 useYearEndHoldbacks Hook

**File:** `src/hooks/useYearEndHoldbacks.ts`

```text
Hook Interface:
├── useYearEndHoldbackSummary(year: number)
│   └── Aggregated totals and projections
│
├── useEmployeeHoldbacks(year: number)
│   └── Per-employee breakdown with currency
│
└── useMonthlyHoldbackAccrual(year: number)
    └── Month-by-month accumulation
```

---

## Part 6: Reports Page Integration

### Update `src/pages/Reports.tsx`

Add new tabs to the Reports page:

```text
Updated Tab Structure:
├── Employee Master (existing)
├── Compensation Snapshot (existing)
├── Incentive Audit (existing)
├── My Deals (existing)
├── My Closing ARR (existing)
├── Payout Statement (existing)
├── Management Summary (NEW - admin only)
├── Currency Breakdown (NEW - admin only)
├── Holdback Tracker (NEW - admin only)
└── Audit Trail (NEW - admin only)
```

**Permission Control:**
- New reports visible only to: admin, gtm_ops, finance, executive roles

---

## Part 7: Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/xxx.sql` | Create | Schema changes + triggers |
| `src/lib/auditLogger.ts` | Create | Audit logging utilities |
| `src/hooks/useAuditLog.ts` | Create | Audit log data hooks |
| `src/hooks/useManagementSummary.ts` | Create | Management summary hook |
| `src/hooks/useYearEndHoldbacks.ts` | Create | Holdback tracking hook |
| `src/components/reports/ManagementSummary.tsx` | Create | Management summary UI |
| `src/components/reports/CurrencyBreakdown.tsx` | Create | Currency breakdown UI |
| `src/components/reports/YearEndHoldbackTracker.tsx` | Create | Holdback tracker UI |
| `src/components/reports/AuditTrailExport.tsx` | Create | Audit trail UI |
| `src/lib/payoutEngine.ts` | Modify | Integrate audit logging |
| `src/pages/Reports.tsx` | Modify | Add new tabs |

---

## Part 8: Implementation Sequence

### Step 1: Database Migration
1. Extend `payout_audit_log` table
2. Create triggers for payout_runs and payout_adjustments

### Step 2: Audit Logging Utilities
1. Create `auditLogger.ts`
2. Integrate into `payoutEngine.ts`

### Step 3: Data Hooks
1. Create `useAuditLog.ts`
2. Create `useManagementSummary.ts`
3. Create `useYearEndHoldbacks.ts`

### Step 4: Report Components
1. Build `ManagementSummary.tsx`
2. Build `CurrencyBreakdown.tsx`
3. Build `YearEndHoldbackTracker.tsx`
4. Build `AuditTrailExport.tsx`

### Step 5: Reports Integration
1. Update `Reports.tsx` with new tabs
2. Add permission checks
3. Test full workflow

---

## Report Matrix Summary

| Report | Primary View | Exchange Rate Display | Export Format |
|--------|--------------|----------------------|---------------|
| Employee Payout Statement | Local Currency | Shows both rates used | Print/PDF |
| Management Summary | USD | Aggregated totals | XLSX |
| Country/Currency Breakdown | Local Currency | Groups by currency | XLSX |
| Year-End Holdback Tracker | Both | Compensation Rate (VP) | XLSX |
| Audit Trail Export | Both | Rate type per line item | CSV/XLSX |

---

## Audit Points Coverage

| Event | What to Log | Implementation |
|-------|-------------|----------------|
| Payout Run Created | run_id, month, created_by | Trigger on payout_runs INSERT |
| Compensation Rate Used | employee_id, rate, source | auditLogger in calculation |
| Market Rate Used | currency, month, rate | auditLogger in calculation |
| Rate Mismatch Detected | comp rate, market rate, variance | auditLogger check in calculation |
| Individual Payout Calculated | USD + LC amounts, rate used, rate type | auditLogger per employee |
| Run Finalized | Month locked, finalizer | Trigger on payout_runs UPDATE |
| Post-Lock Adjustment | Original/new values, reason, approver | Trigger on payout_adjustments |

