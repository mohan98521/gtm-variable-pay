import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useCreatePerformanceTarget,
  useMetricTypes,
  PerformanceTargetRow,
} from "@/hooks/usePerformanceTargets";
import { toast } from "@/hooks/use-toast";

interface PerformanceTargetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTarget?: PerformanceTargetRow | null;
}

export function PerformanceTargetFormDialog({
  open,
  onOpenChange,
  editingTarget,
}: PerformanceTargetFormDialogProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [metricType, setMetricType] = useState("");
  const [customMetricType, setCustomMetricType] = useState("");
  const [q1, setQ1] = useState<number>(0);
  const [q2, setQ2] = useState<number>(0);
  const [q3, setQ3] = useState<number>(0);
  const [q4, setQ4] = useState<number>(0);

  const createMutation = useCreatePerformanceTarget();
  const { data: metricTypes } = useMetricTypes();

  // Fetch employees
  const { data: employees } = useQuery({
    queryKey: ["employees_for_targets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("employee_id, full_name")
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      return data;
    },
  });

  const isEditing = !!editingTarget;

  // Calculate annual target
  const annual = useMemo(() => q1 + q2 + q3 + q4, [q1, q2, q3, q4]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Reset form when dialog opens/closes or editing target changes
  useEffect(() => {
    if (open) {
      if (editingTarget) {
        setEmployeeId(editingTarget.employee_id);
        setMetricType(editingTarget.metric_type);
        setQ1(editingTarget.q1);
        setQ2(editingTarget.q2);
        setQ3(editingTarget.q3);
        setQ4(editingTarget.q4);
      } else {
        setEmployeeId("");
        setMetricType("");
        setCustomMetricType("");
        setQ1(0);
        setQ2(0);
        setQ3(0);
        setQ4(0);
      }
    }
  }, [open, editingTarget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalMetricType = metricType === "custom" ? customMetricType : metricType;

    if (!employeeId || !finalMetricType) {
      toast({
        title: "Validation Error",
        description: "Please select an employee and metric type.",
        variant: "destructive",
      });
      return;
    }

    if (q1 === 0 && q2 === 0 && q3 === 0 && q4 === 0) {
      toast({
        title: "Validation Error",
        description: "At least one quarter must have a target value greater than 0.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createMutation.mutateAsync({
        employee_id: employeeId,
        metric_type: finalMetricType,
        q1,
        q2,
        q3,
        q4,
      });

      toast({
        title: isEditing ? "Target Updated" : "Target Created",
        description: `Performance target ${isEditing ? "updated" : "created"} successfully.`,
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save target",
        variant: "destructive",
      });
    }
  };

  const handleNumberChange = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    value: string
  ) => {
    const num = parseFloat(value) || 0;
    setter(Math.max(0, num));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Performance Target" : "Add Performance Target"}
          </DialogTitle>
          <DialogDescription>
            Enter quarterly targets. The annual target will be calculated automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee Select */}
          <div className="space-y-2">
            <Label htmlFor="employee">Employee</Label>
            <SearchableSelect
              value={employeeId}
              onValueChange={setEmployeeId}
              options={employees?.map((emp) => ({
                value: emp.employee_id,
                label: `${emp.full_name} (${emp.employee_id})`,
              })) || []}
              placeholder="Select an employee"
              searchPlaceholder="Search employees..."
              disabled={isEditing}
            />
          </div>

          {/* Metric Type Select */}
          <div className="space-y-2">
            <Label htmlFor="metric_type">Metric Type</Label>
            <Select
              value={metricType}
              onValueChange={setMetricType}
              disabled={isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select metric type" />
              </SelectTrigger>
              <SelectContent>
                {metricTypes?.map((metric) => (
                  <SelectItem key={metric} value={metric}>
                    {metric}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom...</SelectItem>
              </SelectContent>
            </Select>
            {metricType === "custom" && (
              <Input
                placeholder="Enter custom metric type"
                value={customMetricType}
                onChange={(e) => setCustomMetricType(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Quarterly Inputs Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="q1">Q1 Target (USD)</Label>
              <Input
                id="q1"
                type="number"
                min="0"
                step="1000"
                value={q1}
                onChange={(e) => handleNumberChange(setQ1, e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="q2">Q2 Target (USD)</Label>
              <Input
                id="q2"
                type="number"
                min="0"
                step="1000"
                value={q2}
                onChange={(e) => handleNumberChange(setQ2, e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="q3">Q3 Target (USD)</Label>
              <Input
                id="q3"
                type="number"
                min="0"
                step="1000"
                value={q3}
                onChange={(e) => handleNumberChange(setQ3, e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="q4">Q4 Target (USD)</Label>
              <Input
                id="q4"
                type="number"
                min="0"
                step="1000"
                value={q4}
                onChange={(e) => handleNumberChange(setQ4, e.target.value)}
              />
            </div>
          </div>

          {/* Annual Target Display */}
          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Annual Target (USD)
              </span>
              <span className="text-xl font-semibold text-foreground">
                {formatCurrency(annual)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Auto-calculated: Q1 + Q2 + Q3 + Q4
            </p>
          </div>

          {/* NRR Info Note */}
          {(metricType === "CR/ER" || metricType === "Implementation") && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-sm text-primary font-medium">NRR Component</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This metric contributes to the NRR target computation. NRR Target = CR/ER Target + Implementation Target.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? "Update Target" : "Create Target"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
