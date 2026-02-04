

# Revised Monthly Payout Process Design

## Implementation Status

### Phase 1: Database Schema ✅ COMPLETED
- [x] Added `compensation_exchange_rate` column to `employees` table
- [x] Created trigger to auto-calculate rate on employee insert/update
- [x] Backfilled existing employees with calculated rates
- [x] Created `payout_runs` table with lifecycle statuses
- [x] Added local currency columns to `monthly_payouts`
- [x] Added local currency columns to `deal_variable_pay_attribution`
- [x] Created `payout_adjustments` table for post-lock corrections
- [x] Created month-lock triggers on `deals` and `deal_collections`
- [x] Enhanced `payout_audit_log` with additional tracking columns

### Phase 2: Exchange Rate Management (In Progress)
- [ ] Create Exchange Rate Management UI in Admin section
- [ ] Bulk upload for monthly market rates
- [ ] Validation: ensure all employee currencies have market rates

### Phase 3: Payout Calculation Engine (Pending)
- [ ] Build payout run creation flow
- [ ] Implement dual-rate conversion logic
- [ ] Integration with existing compensation engine

### Phase 4: Review & Approval Workflow (Pending)
- [ ] Payout run status management
- [ ] Review interface with drill-down by rate type
- [ ] Finalization with month-lock

### Phase 5: Reporting (Pending)
- [ ] Employee payout statement (dual rate display)
- [ ] Management summary dashboard
- [ ] Country/currency breakdown views

### Phase 6: Audit & Compliance (Pending)
- [ ] Comprehensive audit logging with rate tracking
- [ ] Adjustment workflow for locked months

---

## Key Change: Dual Exchange Rate Model

Based on your feedback, the payout system will use **two distinct exchange rate approaches**:

| Payout Type | Exchange Rate Source | Rationale |
|-------------|---------------------|-----------|
| **Variable Pay** | Fixed Compensation Rate (from employee master) | Tied to employee's CTC structure; ensures LC payout matches compensation expectations |
| **Commissions** | Monthly Market Rate (from exchange_rates table) | Deal-driven; uses market rate at time of payout |

### Compensation Exchange Rate Derivation

The rate is derived from the employee's OTE values at time of record creation:

```text
Compensation Exchange Rate = OTE (Local Currency) ÷ OTE (USD)

Example: Sales Engineering Rep (IN0001)
├── OTE Local Currency: ₹25,00,000
├── OTE USD: $27,777.78
└── Compensation Rate: 90.0000 INR/USD
```

This rate remains **constant** for all Variable Pay calculations for that employee, regardless of market fluctuations.

---

## Current State Analysis

### Employee Data Available
| Field | Status | Example (IN0001) |
|-------|--------|------------------|
| `ote_local_currency` | ✅ Exists | ₹25,00,000 |
| `ote_usd` | ✅ Exists | $27,777.78 |
| `local_currency` | ✅ Exists | INR |
| `compensation_exchange_rate` | ❌ **Needs to be added** | 90.0000 |

### Sample Derived Rates from Current Data
| Employee | Currency | OTE (LC) | OTE (USD) | Derived Rate |
|----------|----------|----------|-----------|--------------|
| IN0001 | INR | ₹25,00,000 | $27,778 | 90.0000 |
| IN0006 | INR | ₹20,00,000 | $21,740 | 91.9963 |
| DU0001 | AED | 748,067 | $203,694 | 3.6725 |
| MY0001 | MYR | 500,000 | $115,000 | 4.3478 |
| AF0001 | KES | 10,000,000 | $76,923 | 130.0000 |
| DU0002 | USD | $200,000 | $200,000 | 1.0000 |

---

## Proposed Solution Architecture

### Phase 1: Database Schema Enhancements

**1. Add Compensation Exchange Rate to `employees` Table**

```text
New column:
├── compensation_exchange_rate (numeric)
│   ├── Derived: ote_local_currency / ote_usd
│   ├── Set once when employee is created/updated
│   └── Used for all Variable Pay conversions
```

**2. New Table: `payout_runs`** - Master record for each monthly payout cycle

```text
payout_runs
├── id (uuid, PK)
├── month_year (date) - e.g., 2026-01-01
├── run_status: draft | calculating | review | approved | finalized | paid
├── calculated_by (uuid)
├── calculated_at (timestamp)
├── reviewed_by (uuid)
├── reviewed_at (timestamp)
├── approved_by (uuid)
├── approved_at (timestamp)
├── finalized_by (uuid)
├── finalized_at (timestamp)
├── is_locked (boolean) - Prevents modifications when true
├── total_payout_usd (numeric)
├── total_variable_pay_usd (numeric)
├── total_commissions_usd (numeric)
├── notes (text)
├── created_at (timestamp)
├── updated_at (timestamp)
```

**3. Enhanced `monthly_payouts` Table** - Add local currency fields

```text
New columns to add:
├── payout_run_id (uuid) - Links to parent payout run
├── calculated_amount_local (numeric)
├── paid_amount_local (numeric)
├── booking_amount_local (numeric)
├── collection_amount_local (numeric)
├── holdback_amount_local (numeric)
├── year_end_amount_usd (numeric)
├── year_end_amount_local (numeric)
├── clawback_amount_local (numeric)
├── local_currency (text)
├── exchange_rate_used (numeric) - Rate at time of calculation
├── exchange_rate_type (text) - 'compensation' or 'market'
```

**4. Enhanced `deal_variable_pay_attribution` Table** - Add local currency tracking

```text
New columns to add:
├── payout_run_id (uuid)
├── local_currency (text)
├── compensation_exchange_rate (numeric) - From employee master
├── variable_pay_split_local (numeric)
├── payout_on_booking_local (numeric)
├── payout_on_collection_local (numeric)
├── payout_on_year_end_local (numeric)
```

**5. New Table: `payout_adjustments`** - For post-lock corrections

```text
payout_adjustments
├── id (uuid, PK)
├── payout_run_id (uuid, FK)
├── employee_id (text)
├── original_amount_usd (numeric)
├── adjustment_amount_usd (numeric)
├── original_amount_local (numeric)
├── adjustment_amount_local (numeric)
├── adjustment_type: correction | clawback_reversal | manual_override
├── reason (text) - REQUIRED
├── supporting_documents (jsonb)
├── requested_by (uuid)
├── approved_by (uuid)
├── applied_to_month (date) - Which future month to apply
├── status: pending | approved | rejected | applied
├── created_at (timestamp)
```

---

### Phase 2: Exchange Rate Logic

**Variable Pay Conversion (Fixed Compensation Rate)**

```text
Variable Pay Payout Flow:

1. Calculate VP in USD (existing logic)
   └── Achievement % × Multiplier × Target Bonus USD

2. Convert to Local Currency using COMPENSATION rate
   └── VP_Local = VP_USD × employee.compensation_exchange_rate

Example: Sales Engineering Rep (IN0001)
├── VP Calculated (USD): $5,250 (booking portion)
├── Compensation Rate: 90.0000
└── VP Payout (INR): ₹4,72,500
```

**Commission Conversion (Monthly Market Rate)**

```text
Commission Payout Flow:

1. Calculate Commission in USD (existing logic)
   └── Deal TCV × Commission Rate %

2. Fetch Monthly Exchange Rate
   └── SELECT rate_to_usd FROM exchange_rates 
       WHERE currency_code = 'INR' AND month_year = '2026-01'

3. Convert to Local Currency using MARKET rate
   └── Commission_Local = Commission_USD × monthly_rate

Example: Perpetual License Commission
├── Commission Calculated (USD): $1,500
├── Monthly Rate (Jan 2026): 85.50
└── Commission Payout (INR): ₹1,28,250
```

**Rate Selection Logic**

```text
function getExchangeRate(
  employeeId: string,
  payoutType: 'variable_pay' | 'commission',
  monthYear: string
): { rate: number, rateType: 'compensation' | 'market' } {
  
  if (payoutType === 'variable_pay') {
    // Use fixed compensation rate from employee master
    const employee = getEmployee(employeeId);
    return {
      rate: employee.compensation_exchange_rate,
      rateType: 'compensation'
    };
  } else {
    // Use monthly market rate for commissions
    const marketRate = getMarketRate(employee.local_currency, monthYear);
    return {
      rate: marketRate,
      rateType: 'market'
    };
  }
}
```

---

### Phase 3: Monthly Payout Process Flow

```text
MONTHLY PAYOUT LIFECYCLE

┌─────────────────────────────────────────────────────────────────────────┐
│                           MONTH N (e.g., January)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   WEEK 1-4: Data Entry Period                                           │
│   ├── Deals booked → deals table                                        │
│   ├── Collections confirmed → deal_collections table                    │
│   └── Closing ARR recorded → closing_arr_actuals table                  │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   MONTH-END: Payout Processing (1st-5th of Month N+1)                   │
│                                                                         │
│   Step 1: GTM Ops CREATES Payout Run                                    │
│   └── Status: DRAFT                                                     │
│                                                                         │
│   Step 2: Verify Prerequisites                                          │
│   ├── All employees have compensation_exchange_rate set                 │
│   ├── Monthly market exchange_rates uploaded for commission currencies  │
│   └── All deal data finalized for the month                             │
│                                                                         │
│   Step 3: RUN Payout Calculation                                        │
│   ├── For each active employee:                                         │
│   │   ├── VARIABLE PAY:                                                 │
│   │   │   ├── Calculate VP in USD (achievement × multiplier × bonus)    │
│   │   │   ├── Apply three-way split (Booking/Collection/Year-End)       │
│   │   │   ├── Convert USD → LC using COMPENSATION RATE                  │
│   │   │   └── Store both USD and LC amounts + rate used                 │
│   │   │                                                                 │
│   │   ├── COMMISSIONS:                                                  │
│   │   │   ├── Calculate Commission in USD (TCV × rate %)                │
│   │   │   ├── Apply three-way split based on plan config                │
│   │   │   ├── Convert USD → LC using MONTHLY MARKET RATE                │
│   │   │   └── Store both USD and LC amounts + rate used                 │
│   │   │                                                                 │
│   │   └── Check clawback triggers (180-day rule)                        │
│   └── Status: CALCULATING → REVIEW                                      │
│                                                                         │
│   Step 4: REVIEW Period                                                 │
│   ├── Finance reviews calculated payouts                                │
│   ├── Verify exchange rates applied correctly                           │
│   ├── Adjustments/corrections can be made                               │
│   └── Status: REVIEW                                                    │
│                                                                         │
│   Step 5: APPROVAL                                                      │
│   ├── Finance Manager approves payout run                               │
│   └── Status: APPROVED                                                  │
│                                                                         │
│   Step 6: FINALIZE                                                      │
│   ├── Admin/GTM Ops finalizes the run                                   │
│   ├── is_locked = TRUE (prevents all modifications)                     │
│   └── Status: FINALIZED                                                 │
│                                                                         │
│   Step 7: EXPORT for Payroll                                            │
│   ├── Generate CSV/XLSX per country/currency                            │
│   ├── Separate columns for VP (fixed rate) and Commission (market rate) │
│   └── Status: PAID (after confirmation from payroll)                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 4: Employee Payout Statement (Dual Rate Display)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│             INCENTIVE PAYOUT STATEMENT - January 2026                    │
│                     Employee: Sales Engineering Rep (IN0001)             │
│                     Currency: INR                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  VARIABLE PAY (using Compensation Rate: 90.00 INR/USD)                   │
│  ─────────────────────────────────────────────────────                   │
│  ├── New Software Booking ARR                                            │
│  │   ├── Target: $200,000 | Actual: $280,000 | Achievement: 140%         │
│  │   ├── Multiplier: 1.4x                                                │
│  │   ├── Gross Variable Pay:                                             │
│  │   │   ├── USD: $7,000                                                 │
│  │   │   └── INR: ₹6,30,000 (@ 90.00 fixed rate)                         │
│  │   └── Breakdown:                                                      │
│  │       ├── Paid on Booking:     ₹4,72,500 ($5,250)                     │
│  │       ├── Held for Collection: ₹0 (0%)                                │
│  │       └── Held for Year-End:   ₹1,57,500 ($1,750)                     │
│  │                                                                       │
│  COMMISSIONS (using Market Rate: 85.50 INR/USD for Jan 2026)             │
│  ─────────────────────────────────────────────────────────               │
│  ├── Perpetual License                                                   │
│  │   ├── Deal Value: $50,000 | Rate: 3%                                  │
│  │   ├── Gross Commission:                                               │
│  │   │   ├── USD: $1,500                                                 │
│  │   │   └── INR: ₹1,28,250 (@ 85.50 market rate)                        │
│  │   └── Held for Collection: ₹1,28,250 (100% - linked to impl)          │
│  │                                                                       │
│  CLAWBACKS                                                               │
│  ├── None this month                                                     │
│  │                                                                       │
│  ═══════════════════════════════════════════════════════════════════     │
│  SUMMARY                                                                 │
│  ─────────────────────────────────────────────────────────               │
│  │                                                                       │
│  │  PAID THIS MONTH                                                      │
│  │  ├── Variable Pay:  ₹4,72,500 ($5,250)    @ 90.00 (Comp Rate)         │
│  │  └── Commissions:   ₹0                    (held for collection)       │
│  │  ────────────────────────────────────────                             │
│  │  Total Paid:        ₹4,72,500 ($5,250)                                │
│  │                                                                       │
│  │  HELD FOR LATER                                                       │
│  │  ├── For Collection:  ₹1,28,250 ($1,500)  @ 85.50 (Market Rate)       │
│  │  └── For Year-End:    ₹1,57,500 ($1,750)  @ 90.00 (Comp Rate)         │
│  │                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 5: Month-Lock Mechanism

**Business Rule**: Once a payout run is FINALIZED:
1. No new deals can be added to that month
2. No existing deals for that month can be modified
3. No collection status changes for deals in that month
4. Any required changes must go through formal adjustment process

**Database Trigger Implementation**:

```text
check_month_lock Trigger
├── BEFORE INSERT/UPDATE/DELETE on deals
├── BEFORE UPDATE on deal_collections
└── Logic:
    ├── Check if payout_runs.is_locked = TRUE for deal's month_year
    ├── If locked: RAISE EXCEPTION 'Month is locked for payouts'
    └── Allow only through payout_adjustments with mandatory reason
```

---

### Phase 6: Reporting Structure

**Reports to Build (with Dual Currency Tracking)**

| Report | Primary View | Exchange Rate Display |
|--------|-------------|----------------------|
| Employee Payout Statement | Local Currency | Shows both rates used |
| Management Summary | USD | Aggregated totals |
| Country/Currency Breakdown | Local Currency | Groups by currency |
| Variable Pay Detail | Both | Compensation Rate |
| Commission Detail | Both | Market Rate |
| Year-End Holdback Tracker | Both | Compensation Rate (VP) |
| Audit Trail Export | Both | Rate type per line item |

**Audit Points to Track**

| Event | What to Log |
|-------|-------------|
| Payout Run Created | run_id, month, created_by |
| Compensation Rate Used | employee_id, rate, source (OTE LC/USD) |
| Market Rate Used | currency, month, rate |
| Rate Mismatch Detected | If compensation rate differs significantly from market |
| Individual Payout Calculated | USD + LC amounts, rate used, rate type |
| Run Finalized | Month locked, finalizer |
| Post-Lock Adjustment | Original/new values, reason, approver |

---

## Implementation Phases

### Phase 1: Database Schema (Week 1)
- Add `compensation_exchange_rate` column to `employees` table
- Create database trigger to auto-calculate rate on employee insert/update
- Backfill existing employees with calculated rates
- Create `payout_runs` table
- Add local currency columns to `monthly_payouts`
- Add local currency columns to `deal_variable_pay_attribution`
- Create `payout_adjustments` table
- Create month-lock trigger

### Phase 2: Exchange Rate Management (Week 1)
- Create Exchange Rate Management UI in Admin section
- Bulk upload for monthly market rates
- Validation: ensure all employee currencies have market rates before commission calculation

### Phase 3: Payout Calculation Engine (Week 2)
- Build payout run creation flow
- Implement dual-rate conversion logic:
  - Variable Pay → Compensation Rate
  - Commissions → Market Rate
- Integration with existing compensation engine

### Phase 4: Review & Approval Workflow (Week 2-3)
- Payout run status management
- Review interface with drill-down by rate type
- Finalization with month-lock

### Phase 5: Reporting (Week 3)
- Employee payout statement (dual rate display)
- Management summary dashboard
- Country/currency breakdown views
- Export functionality (CSV/Excel)

### Phase 6: Audit & Compliance (Week 3-4)
- Comprehensive audit logging with rate tracking
- Adjustment workflow for locked months

---

## Technical Details

### Auto-Calculate Compensation Rate Trigger

```text
CREATE OR REPLACE FUNCTION calculate_compensation_exchange_rate()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate rate when OTE values are provided
  IF NEW.ote_usd IS NOT NULL AND NEW.ote_usd > 0 
     AND NEW.ote_local_currency IS NOT NULL THEN
    NEW.compensation_exchange_rate := 
      ROUND((NEW.ote_local_currency / NEW.ote_usd)::numeric, 4);
  ELSE
    -- Default to 1 for USD employees or when data missing
    NEW.compensation_exchange_rate := 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_compensation_exchange_rate
  BEFORE INSERT OR UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION calculate_compensation_exchange_rate();
```

### Backfill Existing Employees

```text
UPDATE employees
SET compensation_exchange_rate = 
  CASE 
    WHEN ote_usd > 0 AND ote_local_currency IS NOT NULL 
    THEN ROUND((ote_local_currency / ote_usd)::numeric, 4)
    ELSE 1
  END
WHERE compensation_exchange_rate IS NULL;
```

---

## Example: Complete Calculation with Dual Rates

### January 2026 Payout for IN0001 (Sales Engineering Rep)

```text
EMPLOYEE PROFILE:
├── Currency: INR
├── OTE (INR): ₹25,00,000
├── OTE (USD): $27,777.78
└── Compensation Exchange Rate: 90.0000 (fixed)

VARIABLE PAY CALCULATION:
├── Metric: New Software Booking ARR
├── Target: $200,000 | Actual: $280,000
├── Achievement: 140%
├── Multiplier: 1.4x (from plan grid)
├── Target Bonus (USD): $5,556
│
├── Gross VP (USD) = 140% × 1.4 × $5,556 = $10,889
│
├── Three-Way Split (75/0/25):
│   ├── Booking:    $8,167 (75%)
│   ├── Collection: $0 (0%)
│   └── Year-End:   $2,722 (25%)
│
└── Convert to INR using COMPENSATION RATE (90.00):
    ├── Booking:    $8,167 × 90 = ₹7,35,030
    ├── Collection: $0 × 90 = ₹0
    └── Year-End:   $2,722 × 90 = ₹2,44,980

COMMISSION CALCULATION (if applicable):
├── Deal: Perpetual License $50,000
├── Commission Rate: 3%
├── Gross Commission (USD): $1,500
│
├── January 2026 Market Rate: 85.50 INR/USD
│
└── Convert to INR using MARKET RATE (85.50):
    └── Commission: $1,500 × 85.50 = ₹1,28,250

FINAL PAYOUT SUMMARY:
┌─────────────────────────────────────────────────────────────┐
│ Type        │ USD     │ Rate   │ Rate Type   │ INR         │
├─────────────────────────────────────────────────────────────┤
│ VP Booking  │ $8,167  │ 90.00  │ Compensation│ ₹7,35,030   │
│ Commission  │ $0*     │ 85.50  │ Market      │ ₹0*         │
├─────────────────────────────────────────────────────────────┤
│ PAID NOW    │ $8,167  │        │             │ ₹7,35,030   │
├─────────────────────────────────────────────────────────────┤
│ HELD:                                                       │
│ - Collection│ $1,500  │ 85.50  │ Market      │ ₹1,28,250   │
│ - Year-End  │ $2,722  │ 90.00  │ Compensation│ ₹2,44,980   │
└─────────────────────────────────────────────────────────────┘
* Commission held for collection (linked to implementation)
```

---

## Key Benefits of Dual Rate Model

| Benefit | Description |
|---------|-------------|
| **Compensation Consistency** | Employee's VP payout in LC matches their stated compensation structure |
| **Market Fairness for Deals** | Commission payouts reflect actual market rates when deals close |
| **Audit Clarity** | Clear trail of which rate was used and why |
| **Budget Predictability** | VP costs are predictable in LC terms |
| **Flexibility** | Commission exposure to market rates is intentional and documented |

