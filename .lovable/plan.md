

# Plan: Add Currency Management UI with Dynamic Population

## Problem

Currently, currencies are hardcoded in **5 different places** across the codebase. Adding a new currency requires a code change in each location. This plan creates a centralized `currencies` database table with a management UI, so that adding a new currency automatically populates every dropdown and symbol display across the system.

---

## Approach

### 1. Create a `currencies` table in the database

This becomes the single source of truth for all supported currencies.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `code` | text (unique) | ISO currency code (e.g., "INR") |
| `name` | text | Full name (e.g., "Indian Rupee") |
| `symbol` | text | Display symbol (e.g., "Rs." or the native symbol) |
| `is_active` | boolean | Whether the currency is currently in use |
| `created_at` | timestamptz | Auto-generated |

Pre-seed the table with the 13 currencies already defined in the system (INR, AED, KES, NGN, SAR, MYR, SGD, IDR, LBP, GBP, EUR, AUD, CAD) plus USD.

RLS policies: Admins can manage (INSERT/UPDATE/DELETE), all authenticated users can view (SELECT).

### 2. Create a `useCurrencies` hook

A shared React Query hook that fetches from the `currencies` table and provides:
- `currencies` - Full list of active currencies
- `currencyOptions` - Formatted for SearchableSelect (value/label pairs)
- `getCurrencySymbol(code)` - Centralized symbol lookup with fallback
- `getCurrencyName(code)` - Name lookup

This replaces all hardcoded lists and symbol maps.

### 3. Add Currency Management UI

Add a "Manage Currencies" section within the existing **Exchange Rates** tab on the Admin page. This includes:

```text
+----------------------------------------------------------+
| SUPPORTED CURRENCIES                    [+ Add Currency]  |
|----------------------------------------------------------|
| Code | Name              | Symbol | Status  | Actions    |
| USD  | US Dollar         | $      | Active  | (locked)   |
| INR  | Indian Rupee      | Rs.    | Active  | Edit | Del |
| AED  | UAE Dirham        | AED    | Active  | Edit | Del |
| ...  | ...               | ...    | ...     | ...        |
+----------------------------------------------------------+
```

Features:
- **Add Currency dialog**: Code (3-letter ISO), Name, Symbol fields
- **Edit**: Update name and symbol
- **Delete**: Only if no employees or exchange rates reference this currency
- **USD is locked**: Cannot be edited or deleted (base currency)
- Validation: Duplicate code prevention, required fields

### 4. Replace all hardcoded currency references

| File | Current | Change |
|------|---------|--------|
| `ExchangeRateManagement.tsx` | `CURRENCY_OPTIONS` (13 items) | Use `useCurrencies()` hook |
| `EmployeeFormDialog.tsx` | `CURRENCIES` array (6 items) | Use `useCurrencies()` hook |
| `usePayoutStatement.ts` | `CURRENCY_SYMBOLS` map (11 items) | Use `useCurrencies()` hook |
| `CurrencyBreakdown.tsx` | `getCurrencySymbol()` (7 items) | Use shared `getCurrencySymbol()` from hook |
| `YearEndHoldbackTracker.tsx` | `getCurrencySymbol()` (7 items) | Use shared `getCurrencySymbol()` from hook |

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| Database migration | Create | `currencies` table + seed data + RLS policies |
| `src/hooks/useCurrencies.ts` | **Create** | Shared hook for currency data |
| `src/components/admin/CurrencyManagement.tsx` | **Create** | Add/Edit/Delete currencies UI |
| `src/components/admin/ExchangeRateManagement.tsx` | Modify | Add CurrencyManagement section, replace hardcoded `CURRENCY_OPTIONS` |
| `src/components/admin/EmployeeFormDialog.tsx` | Modify | Replace hardcoded `CURRENCIES` array |
| `src/hooks/usePayoutStatement.ts` | Modify | Replace hardcoded `CURRENCY_SYMBOLS` |
| `src/components/reports/CurrencyBreakdown.tsx` | Modify | Replace local `getCurrencySymbol()` |
| `src/components/reports/YearEndHoldbackTracker.tsx` | Modify | Replace local `getCurrencySymbol()` |

---

## Implementation Sequence

### Step 1: Database Migration
- Create `currencies` table with code, name, symbol, is_active
- Add unique constraint on `code`
- Add RLS policies (admin manage, authenticated view)
- Seed with all 14 currencies currently referenced in the codebase (including USD)

### Step 2: Create `useCurrencies` Hook
- Fetch from `currencies` table, cache with React Query
- Export helper functions: `getCurrencySymbol()`, `getCurrencyName()`, `currencyOptions`
- Fallback behavior: if a currency code is not in the table, use the code itself as symbol

### Step 3: Build Currency Management UI
- Create `CurrencyManagement.tsx` component with table display
- Add/Edit dialog with Code, Name, Symbol fields
- Delete with safety check (no employees or exchange rates using it)
- Integrate into the Exchange Rates tab in Admin page

### Step 4: Replace Hardcoded References
- Update all 5 files to use the `useCurrencies()` hook
- Remove the old hardcoded arrays and symbol maps
- Ensure all dropdowns automatically reflect newly added currencies

---

## How It Works End-to-End

When an admin adds a new currency (e.g., "JPY - Japanese Yen"):

1. Admin goes to **Admin > Exchange Rates** tab
2. Clicks **"Add Currency"** in the Supported Currencies section
3. Enters: Code = JPY, Name = Japanese Yen, Symbol = JPY (or the native Yen symbol)
4. Saves -- the `currencies` table is updated
5. React Query invalidates the `currencies` cache
6. Immediately, every dropdown in the system that uses `useCurrencies()` now shows JPY:
   - Employee Form (Local Currency dropdown)
   - Exchange Rate Management (Currency filter and Add Rate form)
   - Reports (Currency Breakdown, Holdback Tracker, Payout Statement)
7. Admin can then add monthly exchange rates for JPY
8. When creating/editing an employee, JPY appears as a selectable currency

No code changes required -- it is fully data-driven.

---

## Seed Data

The migration will pre-populate the table with these currencies:

| Code | Name | Symbol |
|------|------|--------|
| USD | US Dollar | $ |
| INR | Indian Rupee | Rs. |
| AED | UAE Dirham | AED |
| KES | Kenyan Shilling | KSh |
| NGN | Nigerian Naira | NGN |
| SAR | Saudi Riyal | SAR |
| MYR | Malaysian Ringgit | RM |
| SGD | Singapore Dollar | S$ |
| IDR | Indonesian Rupiah | Rp |
| LBP | Lebanese Pound | LBP |
| GBP | British Pound | GBP |
| EUR | Euro | EUR |
| AUD | Australian Dollar | A$ |
| CAD | Canadian Dollar | C$ |

