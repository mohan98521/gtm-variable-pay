

## Comprehensive Compensation Engine Test Plan

This document provides a structured test plan covering every compensation plan and calculation path in the system. Each test case includes exact input values and expected output values so you can verify correctness by running payout calculations and comparing results.

---

### How to Execute These Tests

1. **Set up test employees** in Admin > Employees (one per plan type, or reuse by changing assignments)
2. **Assign each employee to a plan** via Admin > Compensation Plans > Assign Employees
3. **Set performance targets** in Admin > Performance Targets (quarterly values)
4. **Enter deals/actuals** in Data Inputs for each month
5. **Run a Payout Calculation** in Admin > Payout Runs for the target month
6. **Compare** the computed VP, commissions, NRR, and SPIFF values against the expected figures below

---

### SECTION 1: Variable Pay -- Marginal Stepped Accelerator Plans

These plans use tiered multipliers where each "slice" of achievement gets its own multiplier.

#### Test Case 1.1: Hunter Plan -- Below 100% Achievement

| Input | Value |
|-------|-------|
| Plan | Hunter |
| Target Bonus USD | $20,000 |
| Metric | New Software Booking ARR (100% weight) |
| Annual Target | $1,000,000 |
| YTD Actual | $800,000 (80% achievement) |

**Expected Calculation:**
- Bonus Allocation = $20,000 x 100% = $20,000
- Tier: 0-100% at 1.0x -- slice used = 80%
- VP = $20,000 x (80/100) x 1.0 = **$16,000**
- Split: 60% booking = $9,600 | 40% collection = $6,400

#### Test Case 1.2: Hunter Plan -- 110% Achievement (Accelerator Kicks In)

| Input | Value |
|-------|-------|
| YTD Actual | $1,100,000 (110%) |

**Expected Calculation:**
- Tier 1: 0-100% at 1.0x = $20,000 x (100/100) x 1.0 = $20,000
- Tier 2: 100-120% at 1.4x = $20,000 x (10/100) x 1.4 = $2,800
- Total VP = **$22,800**
- Weighted Multiplier = $22,800 / ($20,000 x 1.1) = ~1.036x
- Split: 60% booking = $13,680 | 40% collection = $9,120

#### Test Case 1.3: Hunter Plan -- 130% Achievement (Top Tier)

| Input | Value |
|-------|-------|
| YTD Actual | $1,300,000 (130%) |

**Expected Calculation:**
- Tier 1: 0-100% at 1.0x = $20,000 x 1.0 = $20,000
- Tier 2: 100-120% at 1.4x = $20,000 x (20/100) x 1.4 = $5,600
- Tier 3: 120-130% at 1.6x = $20,000 x (10/100) x 1.6 = $3,200
- Total VP = **$28,800**
- Split: 60% booking = $17,280 | 40% collection = $11,520

#### Test Case 1.4: Farmer Plan -- Dual Metric Split

| Input | Value |
|-------|-------|
| Plan | Farmer |
| Target Bonus USD | $20,000 |
| New Software Booking ARR | 60% weight, Target $1M, Actual $1.1M (110%) |
| Closing ARR | 40% weight, Target $5M, Actual $5.5M (110%) |

**Expected -- New Software Booking ARR (60% = $12,000 allocation):**
- Tier 1: 0-100% at 1.0x = $12,000
- Tier 2: 100-110% at 1.4x = $12,000 x 0.10 x 1.4 = $1,680
- Subtotal = **$13,680**
- Split: 75% booking = $10,260 | 25% collection = $3,420

**Expected -- Closing ARR (40% = $8,000 allocation):**
- Tier: 0-95% at 0.0x (gate) | 95-100% at 1.0x | 100%+ at 1.2x
- Tier 1: 0-95% at 0.0x = $0
- Tier 2: 95-100% at 1.0x = $8,000 x (5/100) x 1.0 = $400
- Tier 3: 100-110% at 1.2x = $8,000 x (10/100) x 1.2 = $960
- Subtotal = **$1,360**
- Split: 100% booking = $1,360

**Total VP = $13,680 + $1,360 = $15,040**

#### Test Case 1.5: Farmer Plan -- Closing ARR Below Gate (< 95%)

| Input | Value |
|-------|-------|
| Closing ARR Actual | $4,500,000 (90% achievement) |

**Expected Closing ARR VP:**
- Tier: 0-95% at 0.0x -- entire slice is in the zero-payout zone
- VP on Closing ARR = **$0**
- Only New Software Booking ARR pays out

#### Test Case 1.6: Farmer Retain -- 100% Closing ARR Only

| Input | Value |
|-------|-------|
| Plan | Farmer Retain |
| Target Bonus USD | $15,000 |
| Closing ARR | 100% weight, Target $8M, Actual $7.8M (97.5%) |

**Expected:**
- Tier 1: 0-95% at 0.0x = $0
- Tier 2: 95-97.5% at 1.0x = $15,000 x (2.5/100) x 1.0 = $375
- Total VP = **$375**
- Split: 100% booking = $375

---

### SECTION 2: Variable Pay -- Linear Plans (No Accelerator)

#### Test Case 2.1: Sales Engineering -- Linear 1.0x

| Input | Value |
|-------|-------|
| Plan | Sales Engineering |
| Target Bonus USD | $10,000 |
| Metric | New Software Booking ARR (100%, Linear, grid: 0-999% at 1.0x) |
| Target $500K | Actual $600K (120%) |

**Expected:**
- VP = $10,000 x (120/100) x 1.0 = **$12,000**
- Split: 75% booking = $9,000 | 0% collection | 25% year-end = $3,000
- Clawback-exempt = YES, so booking + collection merged: booking = $9,000

#### Test Case 2.2: Solution Manager -- Linear 1.0x

| Input | Value |
|-------|-------|
| Plan | Solution Manager (clawback-exempt) |
| Target Bonus USD | $8,000 |
| Target $400K | Actual $320K (80%) |

**Expected:**
- VP = $8,000 x (80/100) x 1.0 = **$6,400**
- Split: 75% booking = $4,800 | 25% year-end = $2,000
- (Clawback-exempt: collection merged into booking)

---

### SECTION 3: Sales Head Plans -- Higher Accelerators

#### Test Case 3.1: Sales Head Farmer -- 125% Achievement

| Input | Value |
|-------|-------|
| Plan | Sales Head Farmer |
| Target Bonus USD | $30,000 |
| New Software Booking ARR | 60% = $18,000, Target $2M, Actual $2.5M (125%) |
| Closing ARR | 40% = $12,000, Target $10M, Actual $10.5M (105%) |

**Expected -- New Software Booking ARR:**
- Tier 1: 0-100% at 1.0x = $18,000
- Tier 2: 100-120% at 1.6x = $18,000 x (20/100) x 1.6 = $5,760
- Tier 3: 120-125% at 2.0x = $18,000 x (5/100) x 2.0 = $1,800
- Subtotal = **$25,560**

**Expected -- Closing ARR:**
- Tier 1: 0-95% at 1.0x = $12,000 x (95/100) x 1.0 = $11,400
- Tier 2: 95-100% at 1.0x = $12,000 x (5/100) x 1.0 = $600
- Tier 3: 100-105% at 1.2x = $12,000 x (5/100) x 1.2 = $720
- Subtotal = **$12,720**

**Total VP = $25,560 + $12,720 = $38,280**

#### Test Case 3.2: Sales Head Hunter -- Linear with Higher Accelerator Grid

| Input | Value |
|-------|-------|
| Plan | Sales Head Hunter |
| Target Bonus USD | $25,000 |
| New Software Booking ARR | 100%, Linear logic, Target $3M, Actual $3.6M (120%) |

**Expected:**
- Grid lookup: 100-120% tier, multiplier = 1.6x
- VP = $25,000 x (120/100) x 1.6 = **$48,000**
- Split: 60% booking = $28,800 | 40% collection = $19,200

---

### SECTION 4: Commission Calculations

#### Test Case 4.1: Farmer -- Perpetual License Commission (Qualifies)

| Input | Value |
|-------|-------|
| Deal TCV | $75,000 (above $50K threshold) |
| Rate | 4% |

**Expected:**
- Gross = $75,000 x 4% = **$3,000**
- Split: 0% booking / 100% collection / 0% year-end
- Payable on booking = $0, Held for collection = $3,000

#### Test Case 4.2: Farmer -- Perpetual License (Below Threshold)

| Input | Value |
|-------|-------|
| Deal TCV | $40,000 (below $50K threshold) |

**Expected:** Does not qualify. Commission = **$0**

#### Test Case 4.3: Team Lead -- Managed Services Commission

| Input | Value |
|-------|-------|
| Deal Managed Services USD | $200,000 |
| Rate | 1.5%, no minimum threshold |

**Expected:**
- Gross = $200,000 x 1.5% = **$3,000**
- Split: 0/100/0 -- all held for collection

#### Test Case 4.4: Sales Head Hunter -- Implementation Commission

| Input | Value |
|-------|-------|
| Deal Implementation USD | $500,000 |
| Rate | 0.25% |

**Expected:**
- Gross = $500,000 x 0.25% = **$1,250**

---

### SECTION 5: NRR Additional Pay

#### Test Case 5.1: Farmer -- NRR with GP Margin Filter

| Input | Value |
|-------|-------|
| Plan | Farmer (NRR OTE% = 20%, CR/ER GP min = 60%, Impl GP min = 30%) |
| Variable OTE USD | $20,000 |
| CR/ER Target | $200K, Impl Target | $100K, Combined NRR Target = $300K |
| Deal A | CR/ER = $80K, GP = 65% (eligible) |
| Deal B | CR/ER = $50K, GP = 55% (ineligible -- below 60%) |
| Deal C | Impl = $40K, GP = 35% (eligible) |

**Expected:**
- Eligible CR/ER = $80K, Eligible Impl = $40K
- NRR Actuals = $120K, Achievement = 120K/300K = 40%
- Payout = $20,000 x 20% x 40% = **$1,600**

#### Test Case 5.2: Overlay Plan -- NRR OTE = 0%

| Input | Value |
|-------|-------|
| Plan | Overlay (NRR OTE% = 0) |

**Expected:** NRR payout = **$0** (skipped entirely)

---

### SECTION 6: SPIFF Calculations

#### Test Case 6.1: Farmer -- Large Deal SPIFF (Deal Qualifies)

| Input | Value |
|-------|-------|
| Plan | Farmer, SPIFF: Large Deal SPIFF |
| Variable OTE | $20,000 |
| Linked Metric | New Software Booking ARR (60% weight) |
| Software Variable OTE = $20,000 x 60% = $12,000 |
| Software Target | $1,000,000 |
| Deal ARR | $500,000 (above $400K threshold) |

**Expected:**
- SPIFF = $12,000 x ($500K / $1M) x 25% = **$1,500**

#### Test Case 6.2: Farmer -- Deal Below SPIFF Threshold

| Input | Value |
|-------|-------|
| Deal ARR | $350,000 (below $400K threshold) |

**Expected:** SPIFF = **$0**

#### Test Case 6.3: Hunter -- Large Deal SPIFF (No Min Threshold)

| Input | Value |
|-------|-------|
| Plan | Hunter SPIFF (no min_deal_value_usd) |
| Variable OTE | $20,000, Linked = New Software Booking ARR (100%) |
| Software Variable OTE = $20,000 |
| Software Target = $1,000,000, Deal ARR = $200,000 |

**Expected:**
- SPIFF = $20,000 x ($200K / $1M) x 25% = **$1,000**

---

### SECTION 7: Incremental Monthly VP

#### Test Case 7.1: Month-Over-Month Incremental Calculation

| Month | YTD Actual | YTD Achievement | YTD VP | Prior Paid | Monthly VP |
|-------|-----------|----------------|--------|------------|------------|
| Jan | $100K | 10% | $2,000 | $0 | **$2,000** |
| Feb | $200K | 20% | $4,000 | $2,000 | **$2,000** |
| Mar | $500K | 50% | $10,000 | $4,000 | **$6,000** |
| ... | | | | | |
| Nov | $1,100K | 110% | $22,800* | $20,000 | **$2,800** |

*Uses Hunter plan with accelerator at 110%: Tier1 100% at 1.0x = $20K + Tier2 10% at 1.4x = $2.8K

---

### SECTION 8: Blended Pro-Rata Target (Mid-Year Comp Change)

#### Test Case 8.1: Mid-Year Hike from $20K to $24K

| Input | Value |
|-------|-------|
| Assignment A | Jan 1 - May 31 (151 days), Target Bonus = $20,000 |
| Assignment B | Jun 1 - Dec 31 (214 days), Target Bonus = $24,000 |

**Expected:**
- Blended = ($20,000 x 151/365) + ($24,000 x 214/365)
- Blended = $8,274 + $14,071 = **$22,345**
- Jan-May calculations use $20,000
- Jun-Dec calculations use $22,345

---

### SECTION 9: Currency Conversion

#### Test Case 9.1: VP with Compensation Rate

| Input | Value |
|-------|-------|
| VP in USD | $10,000 |
| Compensation Rate (INR/USD) | 83 |

**Expected Local:** $10,000 x 83 = **INR 830,000**

#### Test Case 9.2: Commission with Market Rate

| Input | Value |
|-------|-------|
| Commission USD | $3,000 |
| Market Rate (INR/USD) for month | 84.5 |

**Expected Local:** $3,000 x 84.5 = **INR 253,500**

---

### SECTION 10: Edge Cases

#### Test Case 10.1: Zero Target -- No Division Error

| Input | Performance Target = $0 |

**Expected:** Achievement = 0%, VP = $0 (no crash)

#### Test Case 10.2: Employee with No Plan Assignment

**Expected:** Employee skipped in payout run, appears in warnings

#### Test Case 10.3: Clawback-Exempt Plan (Overlay, Sales Engineering, Solution Architect, Solution Manager)

**Expected:** Collection holdback = $0 (merged into booking). No clawback tracking.

#### Test Case 10.4: December Year-End Release

**Expected:** All accumulated `year_end_amount_usd` from Jan-Nov released as a single "Year-End Release" line item

#### Test Case 10.5: Linked-to-Implementation Override

| Deal flagged `linked_to_impl = true` |

**Expected:** Commission split forced to 0/100/0 regardless of plan config

---

### Execution Checklist

| # | Test Case | Plan | Status |
|---|-----------|------|--------|
| 1.1 | Hunter 80% | Hunter | |
| 1.2 | Hunter 110% | Hunter | |
| 1.3 | Hunter 130% | Hunter | |
| 1.4 | Farmer dual metric 110% | Farmer | |
| 1.5 | Farmer Closing ARR gate | Farmer | |
| 1.6 | Farmer Retain 97.5% | Farmer Retain | |
| 2.1 | SE Linear 120% | Sales Engineering | |
| 2.2 | Solution Mgr 80% | Solution Manager | |
| 3.1 | SH Farmer 125% | Sales Head Farmer | |
| 3.2 | SH Hunter 120% | Sales Head Hunter | |
| 4.1-4.4 | Commissions | Various | |
| 5.1-5.2 | NRR | Farmer / Overlay | |
| 6.1-6.3 | SPIFFs | Farmer / Hunter | |
| 7.1 | Incremental VP | Hunter | |
| 8.1 | Blended target | Any | |
| 9.1-9.2 | Currency | Any non-USD | |
| 10.1-10.5 | Edge cases | Various | |

