

# Plan: Make Currency Symbol Optional

## Overview

Remove the Symbol field from being mandatory when adding a new currency. When no symbol is provided, the system will default to using the currency code itself as the display symbol.

## Changes Required

### 1. Database Migration
- Alter the `currencies` table to allow NULL values on the `symbol` column
- Set a default value of empty string or allow null

### 2. `src/hooks/useCurrencies.ts` (2 changes)
- **`getCurrencySymbol` helper**: Already has fallback logic (`symbolMap.get(code) || code`), but update to also handle empty/null symbols by falling back to the currency code
- **`createMutation`**: Update the type signature to make `symbol` optional, and only include it in the insert if provided (or default to the currency code)

### 3. `src/components/admin/CurrencyManagement.tsx` (3 changes)
- **`handleSubmitAdd` validation (line 97)**: Remove `formData.symbol.trim()` from the required fields check -- only `code` and `name` remain mandatory
- **`createCurrency` call (line 106)**: Pass `symbol` as the entered value or fall back to the currency code if left blank
- **Add Dialog UI (Symbol field)**: Remove the asterisk (*) from the Symbol label and add helper text indicating it defaults to the currency code if left empty

## Behavior After Change

- When adding a currency, only **Code** and **Name** are required
- If the admin leaves **Symbol** blank, the system automatically uses the currency code (e.g., "JPY") as the display symbol everywhere
- If the admin provides a symbol (e.g., "Rs."), that symbol is used instead
- Existing currencies with symbols already set are unaffected

