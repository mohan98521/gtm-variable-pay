
## Fix: Plan Lookup Using Exact Match

### Current State Analysis

The **actuals fetching is already correct** - it uses Employee ID to check all 8 participant role columns:
```typescript
// Line 228-230 in useCurrentUserCompensation.ts
(deals || []).forEach((deal: any) => {
  const isParticipant = PARTICIPANT_ROLES.some(role => deal[role] === employeeId);
```

The **problem** is the plan lookup on line 131:
```typescript
.ilike("name", `%${planName}%`)  // Returns multiple matches!
```

When `planName = "Farmer"`, this matches:
- "Farmer" (correct)
- "Farmer Retain" (wrong)
- "Sales Head Farmer" (wrong)

With `maybeSingle()`, this returns null or the wrong plan, breaking all downstream data (metrics, multipliers, commissions).

---

### Solution: Single Line Fix

Change line 131 from fuzzy `ilike` to exact `eq`:

**File**: `src/hooks/useCurrentUserCompensation.ts`

```typescript
// Line 127-132 - BEFORE:
const { data: plan } = await supabase
  .from("comp_plans")
  .select("id, name")
  .eq("effective_year", selectedYear)
  .ilike("name", `%${planName}%`)  // BUG: Matches multiple plans
  .maybeSingle();

// AFTER:
const { data: plan } = await supabase
  .from("comp_plans")
  .select("id, name")
  .eq("effective_year", selectedYear)
  .eq("name", planName)  // FIX: Exact match only
  .maybeSingle();
```

---

### Why This Works

The `SALES_FUNCTION_TO_PLAN` mapping (lines 8-21) already handles the translation:

| Employee's sales_function | Maps To (planName) | Comp Plan Name (exact match) |
|---------------------------|-------------------|------------------------------|
| "Farming" | "Farmer" | "Farmer" |
| "Hunting" | "Hunter" | "Hunter" |
| "Farmer - Retain" | "Farmer Retain" | "Farmer Retain" |
| "Sales Head - Farmer" | "Sales Head Farmer" | "Sales Head Farmer" |

The mapping ensures `planName` matches the exact plan name in the database.

---

### Additional Fix: Closing ARR Attribution

While the deals table uses all 8 participant roles, the `closing_arr_actuals` query (line 248) only checks `sales_rep_employee_id`. Let me verify the table structure:

The `closing_arr_actuals` table has `sales_rep_employee_id` and `sales_head_employee_id` columns. We should check both.

**File**: `src/hooks/useCurrentUserCompensation.ts`

```typescript
// Lines 245-250 - BEFORE:
const { data: closingArr } = await supabase
  .from("closing_arr_actuals")
  .select("month_year, closing_arr")
  .eq("sales_rep_employee_id", employeeId)
  .gte("month_year", fiscalYearStart)
  .lte("month_year", fiscalYearEnd);

// AFTER:
const { data: closingArr } = await supabase
  .from("closing_arr_actuals")
  .select("month_year, closing_arr, sales_rep_employee_id, sales_head_employee_id")
  .or(`sales_rep_employee_id.eq.${employeeId},sales_head_employee_id.eq.${employeeId}`)
  .gte("month_year", fiscalYearStart)
  .lte("month_year", fiscalYearEnd);
```

And update the same in `useUserActuals.ts` (lines 108-114).

---

### Commission Table Visibility Fix

**File**: `src/components/dashboard/CommissionTable.tsx`

Change to always show the section (even when empty):

```typescript
// BEFORE (line 29-31):
if (commissions.length === 0) {
  return null;
}

// AFTER:
if (commissions.length === 0) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-foreground">
          Commission Structure Summary
        </CardTitle>
        <CardDescription>
          No commission transactions recorded for this period
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useCurrentUserCompensation.ts` | Line 131: Change `ilike` to `eq`; Lines 245-250: Add OR filter for closing ARR |
| `src/hooks/useUserActuals.ts` | Lines 108-114: Add OR filter for closing ARR |
| `src/components/dashboard/CommissionTable.tsx` | Lines 29-31: Always display section |

---

### Expected Results After Fix

| Metric | Before | After |
|--------|--------|-------|
| Plan Lookup | Fails (null) | "Farmer" (ed01c7a6-...) |
| New SW Booking ARR Actual | $0 | **$793,159** |
| Achievement % | 0% | **132.2%** |
| Multiplier | 1.0x (fallback) | **1.6x** (from grid) |
| Commission Section | Not shown | **Always visible** |
| Managed Services | -- | **$106,875 @ 1.5%** |
| Perpetual License | -- | **$100,000 @ 4%** |
| What-If Multiplier at 116% | 1.0x | **1.4x** |
