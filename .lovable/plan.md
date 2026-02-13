

## Fix: "Available 200%" Bug in Edit Metric Dialog

### The Problem

When editing a metric, the available weightage shows **200%** instead of **100%**. This happens because the metric's own weightage is subtracted twice:

1. The parent (`PlanBuilder.tsx`) passes `existingWeightage = totalWeightage - editingMetric.weightage_percent` (already excluding the current metric)
2. The dialog (`MetricFormDialog.tsx`) then adds `metric.weightage_percent` back again in the formula: `100 - existingWeightage + metric.weightage_percent`

This double-adjustment inflates the available value.

### The Fix

**File: `src/components/admin/MetricFormDialog.tsx`** (line 85-87)

Remove the redundant addition of the metric's weightage inside the dialog. Since the parent already excludes it, the dialog should simply use:

```
maxWeightage = 100 - existingWeightage
```

This applies for both editing and creating — the parent already handles the distinction.

### Result

- Single metric at 100% weightage: Available shows **100%** (was 200%)
- Two metrics at 60% + 40%, editing the 60% one: Available shows **60%** (correctly: 100 - 40)

