

## Add CR/ER and Implementation Metrics with NRR Target Computation

### Problem
The "Metric Type" dropdown in the Performance Target form does not include **CR/ER** and **Implementation** -- both required for NRR (Non-Recurring Revenue) computation. The NRR target is defined as CR/ER Target + Implementation Target, and this relationship needs to be visible in the UI.

### Changes

**1. File: `src/hooks/usePerformanceTargets.ts` -- Guarantee CR/ER and Implementation in metric types**

Update the `useMetricTypes` hook to ensure "CR/ER" and "Implementation" are always present in the list, even if no plan_commissions entries exist yet. Add them as guaranteed entries merged with the dynamic list.

```typescript
// In useMetricTypes(), after merging dynamic sources:
const GUARANTEED_METRICS = ["CR/ER", "Implementation"];
const allMetrics = [...new Set([...GUARANTEED_METRICS, ...metricNames, ...commissionTypes])].sort();
```

**2. File: `src/components/admin/PerformanceTargetsManagement.tsx` -- Show NRR Target summary**

Add a computed NRR summary row or info banner that, for each employee who has both CR/ER and Implementation targets, displays:
- NRR Target = CR/ER Annual + Implementation Annual (per employee)
- Shown as a highlighted summary in the stats cards or as grouped rows in the table

Specifically:
- Add a 4th stats card: "NRR Targets Configured" showing count of employees with both CR/ER and Implementation targets, and total NRR target value
- In the table, when grouped by employee, visually indicate NRR = CR/ER + Implementation with a subtle computed row or tooltip

**3. File: `src/components/admin/PerformanceTargetFormDialog.tsx` -- NRR display in form**

When metric type is "CR/ER" or "Implementation", show an info note explaining these contribute to the NRR target computation (NRR = CR/ER + Implementation).

**4. File: `src/components/admin/PerformanceTargetsBulkUpload.tsx` -- Update template and docs**

- Update the CSV template to include CR/ER and Implementation example rows
- Update the dialog description to mention NRR target support

Template update:
```
employee_id,metric_type,q1_target_usd,q2_target_usd,q3_target_usd,q4_target_usd
EMP001,New Software Booking ARR,200000,250000,250000,300000
EMP001,CR/ER,50000,60000,60000,80000
EMP001,Implementation,25000,30000,30000,40000
EMP002,Closing ARR,100000,125000,125000,150000
```

### Technical Details

- No database changes required -- CR/ER and Implementation are free-text `metric_type` values in existing `quarterly_targets` and `performance_targets` tables
- The NRR computation logic in `src/lib/nrrCalculation.ts` already expects separate CR/ER and Implementation targets as inputs; this change ensures those targets can actually be entered via the UI
- The bulk upload parser already accepts any `metric_type` string, so no parsing changes needed -- only the template and guaranteed metric list updates

