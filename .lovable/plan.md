

## Quick Fix: Unified Metric Types Dropdown

### Overview

Update the `useMetricTypes` hook to automatically combine metric types from both `plan_metrics` and `plan_commissions` tables, giving the Performance Targets form a complete list of all metrics defined in compensation plans.

---

### Current vs Updated Behavior

| Current | After Quick Fix |
|---------|-----------------|
| Only shows: Closing ARR, New Software Booking ARR | Shows ALL: Closing ARR, CR/ER, Implementation, Managed Services, New Software Booking ARR, Perpetual License |
| Queries only `plan_metrics` | Queries both `plan_metrics` and `plan_commissions` |

---

### File to Modify

**`src/hooks/usePerformanceTargets.ts`**

Update the `useMetricTypes` function (lines 233-249) to:

1. Query `plan_metrics` for unique `metric_name` values
2. Query `plan_commissions` for unique `commission_type` values
3. Combine both lists
4. Remove duplicates
5. Sort alphabetically

---

### Updated Logic

```text
useMetricTypes hook:
1. Fetch plan_metrics.metric_name (unique values)
2. Fetch plan_commissions.commission_type (unique values)
3. Merge both arrays
4. Deduplicate using Set
5. Sort alphabetically
6. Return combined list
```

---

### Result

The Performance Targets form dropdown will automatically show all 6 metric types:

- Closing ARR
- CR/ER
- Implementation
- Managed Services
- New Software Booking ARR
- Perpetual License

Plus the "Custom..." option for any additional metrics not in the database.

---

### Benefits

- No database changes required
- Automatically picks up new metrics when added to comp plans
- Keeps the "Custom..." fallback option
- Single code change in one hook

