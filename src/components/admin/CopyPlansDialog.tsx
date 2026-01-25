import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlansForYear, CompPlan } from "@/hooks/useCompPlans";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CopyPlansDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetYear: number;
  availableYears: number[];
  onSuccess: () => void;
}

export function CopyPlansDialog({
  open,
  onOpenChange,
  targetYear,
  availableYears,
  onSuccess,
}: CopyPlansDialogProps) {
  const queryClient = useQueryClient();
  const [sourceYear, setSourceYear] = useState<number>(targetYear - 1);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());

  const { data: sourcePlans, isLoading: plansLoading } = usePlansForYear(sourceYear);

  // Filter years that have plans and are before target year
  const sourceYearOptions = availableYears.filter((y) => y < targetYear);

  const copyPlansMutation = useMutation({
    mutationFn: async (planIds: string[]) => {
      const copiedPlans: CompPlan[] = [];

      for (const planId of planIds) {
        // 1. Get source plan
        const { data: sourcePlan, error: planError } = await supabase
          .from("comp_plans")
          .select("*")
          .eq("id", planId)
          .single();

        if (planError) throw planError;

        // 2. Create new plan with target year
        const { data: newPlan, error: newPlanError } = await supabase
          .from("comp_plans")
          .insert({
            name: sourcePlan.name,
            description: sourcePlan.description,
            is_active: false, // Start as inactive
            effective_year: targetYear,
          })
          .select()
          .single();

        if (newPlanError) throw newPlanError;

        // 3. Copy plan_metrics
        const { data: sourceMetrics, error: metricsError } = await supabase
          .from("plan_metrics")
          .select("*")
          .eq("plan_id", planId);

        if (metricsError) throw metricsError;

        for (const metric of sourceMetrics || []) {
          const { data: newMetric, error: newMetricError } = await supabase
            .from("plan_metrics")
            .insert({
              plan_id: newPlan.id,
              metric_name: metric.metric_name,
              weightage_percent: metric.weightage_percent,
              logic_type: metric.logic_type,
              gate_threshold_percent: metric.gate_threshold_percent,
            })
            .select()
            .single();

          if (newMetricError) throw newMetricError;

          // 4. Copy multiplier_grids for this metric
          const { data: sourceGrids, error: gridsError } = await supabase
            .from("multiplier_grids")
            .select("*")
            .eq("plan_metric_id", metric.id);

          if (gridsError) throw gridsError;

          if (sourceGrids?.length) {
            const { error: insertGridsError } = await supabase
              .from("multiplier_grids")
              .insert(
                sourceGrids.map((g) => ({
                  plan_metric_id: newMetric.id,
                  min_pct: g.min_pct,
                  max_pct: g.max_pct,
                  multiplier_value: g.multiplier_value,
                }))
              );

            if (insertGridsError) throw insertGridsError;
          }
        }

        // 5. Copy plan_commissions
        const { data: sourceCommissions, error: commissionsError } = await supabase
          .from("plan_commissions")
          .select("*")
          .eq("plan_id", planId);

        if (commissionsError) throw commissionsError;

        if (sourceCommissions?.length) {
          const { error: insertCommissionsError } = await supabase
            .from("plan_commissions")
            .insert(
              sourceCommissions.map((c) => ({
                plan_id: newPlan.id,
                commission_type: c.commission_type,
                commission_rate_pct: c.commission_rate_pct,
                min_threshold_usd: c.min_threshold_usd,
                is_active: c.is_active,
              }))
            );

          if (insertCommissionsError) throw insertCommissionsError;
        }

        copiedPlans.push(newPlan);
      }

      return copiedPlans;
    },
    onSuccess: (copiedPlans) => {
      queryClient.invalidateQueries({ queryKey: ["comp_plans"] });
      queryClient.invalidateQueries({ queryKey: ["comp_plan_years"] });
      setSelectedPlanIds(new Set());
      onOpenChange(false);
      onSuccess();
      toast({
        title: "Plans copied",
        description: `Successfully copied ${copiedPlans.length} plan(s) to ${targetYear}. Plans are set to inactive for review.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error copying plans",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTogglePlan = (planId: string) => {
    const newSelected = new Set(selectedPlanIds);
    if (newSelected.has(planId)) {
      newSelected.delete(planId);
    } else {
      newSelected.add(planId);
    }
    setSelectedPlanIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedPlanIds.size === (sourcePlans?.length || 0)) {
      setSelectedPlanIds(new Set());
    } else {
      setSelectedPlanIds(new Set(sourcePlans?.map((p) => p.id) || []));
    }
  };

  const handleCopy = () => {
    if (selectedPlanIds.size === 0) {
      toast({
        title: "No plans selected",
        description: "Please select at least one plan to copy.",
        variant: "destructive",
      });
      return;
    }
    copyPlansMutation.mutate(Array.from(selectedPlanIds));
  };

  const allSelected = sourcePlans?.length > 0 && selectedPlanIds.size === sourcePlans.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy Plans to {targetYear}</DialogTitle>
          <DialogDescription>
            Select plans from a previous year to copy. Copied plans will be set to inactive for review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source Year Selector */}
          <div className="space-y-2">
            <Label>Copy from year:</Label>
            <Select
              value={sourceYear.toString()}
              onValueChange={(val) => {
                setSourceYear(parseInt(val));
                setSelectedPlanIds(new Set());
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sourceYearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Plans List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select plans to copy:</Label>
              {sourcePlans && sourcePlans.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs"
                >
                  {allSelected ? "Deselect All" : "Select All"}
                </Button>
              )}
            </div>

            {plansLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sourcePlans && sourcePlans.length > 0 ? (
              <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
                {sourcePlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50"
                  >
                    <Checkbox
                      id={plan.id}
                      checked={selectedPlanIds.has(plan.id)}
                      onCheckedChange={() => handleTogglePlan(plan.id)}
                    />
                    <Label
                      htmlFor={plan.id}
                      className="flex-1 cursor-pointer font-normal"
                    >
                      <span className="font-medium">{plan.name}</span>
                      {plan.description && (
                        <span className="text-muted-foreground text-sm block">
                          {plan.description}
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No plans found for {sourceYear}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={copyPlansMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            disabled={selectedPlanIds.size === 0 || copyPlansMutation.isPending}
          >
            {copyPlansMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Copying...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy {selectedPlanIds.size} Plan{selectedPlanIds.size !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
