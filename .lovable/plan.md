

## Fix: "require is not defined" Error in Payout Engine

### Problem
The payout calculation fails because `src/lib/payoutEngine.ts` uses a CommonJS `require()` call at line 761 to dynamically import `calculateAggregateVariablePay`. This does not work in a browser/Vite (ESM) environment.

### Solution
Two small changes in `src/lib/payoutEngine.ts`:

1. **Add `calculateAggregateVariablePay` to the existing static import** on lines 23-28 (it is already exported from `dealVariablePayAttribution.ts` but missing from the import list).

2. **Remove the `require()` call** on line 761 and use the statically imported function directly.

### Technical Details

**File: `src/lib/payoutEngine.ts`**

Change the import (lines 23-28) from:
```typescript
import { 
  calculateDealVariablePayAttributions, 
  DealForAttribution,
  DealVariablePayAttribution,
  AggregateVariablePayContext 
} from "./dealVariablePayAttribution";
```
to:
```typescript
import { 
  calculateDealVariablePayAttributions,
  calculateAggregateVariablePay,
  DealForAttribution,
  DealVariablePayAttribution,
  AggregateVariablePayContext 
} from "./dealVariablePayAttribution";
```

Then replace line 761:
```typescript
const { calculateAggregateVariablePay } = require('./dealVariablePayAttribution');
```
with just removing that line (the function is now available from the top-level import).

No other files need changes.

