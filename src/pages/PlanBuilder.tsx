import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Target,
  Percent,
  Settings,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { MetricFormDialog, PlanMetric } from "@/components/admin/MetricFormDialog";
import { MultiplierGridEditor } from "@/components/admin/MultiplierGridEditor";
import { PlanCommissionEditor } from "@/components/admin/PlanCommissionEditor";
import { PayoutSettingsCard } from "@/components/admin/PayoutSettingsCard";
import { usePlanCommissions } from "@/hooks/usePlanCommissions";
import { AssignedEmployeesCard } from "@/components/admin/AssignedEmployeesCard";
import { NrrSettingsCard } from "@/components/admin/NrrSettingsCard";
import { SpiffEditor } from "@/components/admin/SpiffEditor";
import { ClosingArrRenewalMultiplierEditor } from "@/components/admin/ClosingArrRenewalMultiplierEditor";

interface MultiplierGrid {
  id: string;
  plan_metric_id: string;
  min_pct: number;
  max_pct: number;
  multiplier_value: number;
}

export default function PlanBuilder() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showMetricDialog, setShowMetricDialog] = useState(false);
  const [editingMetric, setEditingMetric] = useState<PlanMetric | null>(null);
  const [deletingMetric, setDeletingMetric] = useState<PlanMetric | null>(null);

  // Fetch plan details
  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ["comp_plan", planId],
    queryFn: async () => {
      if (!planId) return null;
      const { data, error } = await supabase
        .from("comp_plans")
        .select("*")
        .eq("id", planId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!planId,
  });

  // Fetch plan metrics with multiplier grids
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ["plan_metrics_with_grids", planId],
    queryFn: async () => {
      if (!planId) return { metrics: [], multipliers: [] };
      
      const { data: metrics, error: metricsError } = await supabase
        .from("plan_metrics")
        .select("*")
        .eq("plan_id", planId)
        .order("metric_name");
      
      if (metricsError) throw metricsError;

      // Fetch multipliers for all metrics
      const metricIds = metrics?.map(m => m.id) || [];
      let multipliers: MultiplierGrid[] = [];
      
      if (metricIds.length > 0) {
        const { data: grids, error: gridsError } = await supabase
          .from("multiplier_grids")
          .select("*")
          .in("plan_metric_id", metricIds)
          .order("min_pct");
        
        if (gridsError) throw gridsError;
        multipliers = grids || [];
      }

      return { metrics: metrics || [], multipliers };
    },
    enabled: !!planId,
  });

  const metrics = metricsData?.metrics || [];
  const multipliers = metricsData?.multipliers || [];

  // Fetch plan commissions
  const { data: commissions = [] } = usePlanCommissions(planId);

  // Calculate total weightage
  const totalWeightage = metrics.reduce((sum, m) => sum + m.weightage_percent, 0);

  // Create metric mutation
  const createMetricMutation = useMutation({
    mutationFn: async (values: {
      metric_name: string;
      weightage_percent: number;
      logic_type: "Linear" | "Gated_Threshold" | "Stepped_Accelerator";
      gate_threshold_percent?: number | null;
      payout_on_booking_pct?: number;
      payout_on_collection_pct?: number;
      payout_on_year_end_pct?: number;
    }) => {
      const { data, error } = await supabase
        .from("plan_metrics")
        .insert({
          plan_id: planId!,
          metric_name: values.metric_name,
          weightage_percent: values.weightage_percent,
          logic_type: values.logic_type,
          gate_threshold_percent: values.gate_threshold_percent || null,
          payout_on_booking_pct: values.payout_on_booking_pct ?? 70,
          payout_on_collection_pct: values.payout_on_collection_pct ?? 25,
          payout_on_year_end_pct: values.payout_on_year_end_pct ?? 5,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan_metrics_with_grids", planId] });
      setShowMetricDialog(false);
      toast({ title: "Metric added", description: "The metric has been added to the plan." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update metric mutation
  const updateMetricMutation = useMutation({
    mutationFn: async (values: {
      id: string;
      metric_name: string;
      weightage_percent: number;
      logic_type: "Linear" | "Gated_Threshold" | "Stepped_Accelerator";
      gate_threshold_percent?: number | null;
      payout_on_booking_pct?: number;
      payout_on_collection_pct?: number;
      payout_on_year_end_pct?: number;
    }) => {
      const { data, error } = await supabase
        .from("plan_metrics")
        .update({
          metric_name: values.metric_name,
          weightage_percent: values.weightage_percent,
          logic_type: values.logic_type,
          gate_threshold_percent: values.gate_threshold_percent || null,
          payout_on_booking_pct: values.payout_on_booking_pct ?? 70,
          payout_on_collection_pct: values.payout_on_collection_pct ?? 25,
          payout_on_year_end_pct: values.payout_on_year_end_pct ?? 5,
        })
        .eq("id", values.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan_metrics_with_grids", planId] });
      setEditingMetric(null);
      toast({ title: "Metric updated", description: "The metric has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete metric mutation
  const deleteMetricMutation = useMutation({
    mutationFn: async (metricId: string) => {
      // First delete related multiplier grids
      await supabase
        .from("multiplier_grids")
        .delete()
        .eq("plan_metric_id", metricId);
      
      // Then delete the metric
      const { error } = await supabase
        .from("plan_metrics")
        .delete()
        .eq("id", metricId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan_metrics_with_grids", planId] });
      setDeletingMetric(null);
      toast({ title: "Metric deleted", description: "The metric has been removed from the plan." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddMetric = () => {
    setEditingMetric(null);
    setShowMetricDialog(true);
  };

  const handleEditMetric = (metric: PlanMetric) => {
    setEditingMetric(metric);
    setShowMetricDialog(true);
  };

  const handleMetricSubmit = (values: {
    metric_name: string;
    weightage_percent: number;
    logic_type: "Linear" | "Gated_Threshold" | "Stepped_Accelerator";
    gate_threshold_percent?: number | null;
  }) => {
    if (editingMetric) {
      updateMetricMutation.mutate({ ...values, id: editingMetric.id });
    } else {
      createMetricMutation.mutate(values);
    }
  };

  const getMultipliersForMetric = (metricId: string) => {
    return multipliers.filter(m => m.plan_metric_id === metricId);
  };

  const formatLogicType = (logicType: string) => {
    return logicType.replace(/_/g, " ");
  };

  const isLoading = planLoading || metricsLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!plan) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Plan Not Found</h3>
              <p className="text-muted-foreground mb-4">The compensation plan you're looking for doesn't exist.</p>
              <Button variant="outline" onClick={() => navigate("/admin")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold text-foreground">{plan.name}</h1>
                {plan.is_active ? (
                  <Badge className="bg-success/10 text-success">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
                {plan.is_clawback_exempt && (
                  <Badge className="bg-success/10 text-success border-success/20">
                    Clawback Exempt
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">{plan.description || "No description"}</p>
            </div>
          </div>
        </div>

        {/* Plan Overview */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Target className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Metrics</p>
                  <p className="text-2xl font-semibold text-foreground">{metrics.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-md ${
                  totalWeightage === 100 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                }`}>
                  <Percent className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Weightage</p>
                  <p className="text-2xl font-semibold text-foreground">{totalWeightage}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent/10 text-accent">
                  <Settings className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Multiplier Grids</p>
                  <p className="text-2xl font-semibold text-foreground">{multipliers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Commission Types</p>
                  <p className="text-2xl font-semibold text-foreground">{commissions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {totalWeightage !== 100 && metrics.length > 0 && (
          <Card className="border-warning bg-warning/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <p className="text-sm text-warning">
                Total weightage is {totalWeightage}%. It should equal 100% for accurate calculations.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Metrics Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Plan Metrics</CardTitle>
                <CardDescription>Define metrics, weightages, and calculation logic</CardDescription>
              </div>
              <Button variant="accent" onClick={handleAddMetric}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Metric
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {metrics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <Target className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">No Metrics Yet</h3>
                <p className="text-muted-foreground max-w-md mb-4">
                  Add metrics to define how compensation is calculated for this plan.
                </p>
                <Button variant="accent" onClick={handleAddMetric}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add First Metric
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric Name</TableHead>
                    <TableHead className="text-center">Weightage</TableHead>
                    <TableHead className="text-center">Logic Type</TableHead>
                    <TableHead className="text-center">Gate Threshold</TableHead>
                    <TableHead className="text-center">Bookings</TableHead>
                    <TableHead className="text-center">Collections</TableHead>
                    <TableHead className="text-center">Year End</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((metric) => (
                    <TableRow key={metric.id}>
                      <TableCell className="font-medium">{metric.metric_name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{metric.weightage_percent}%</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{formatLogicType(metric.logic_type)}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {metric.gate_threshold_percent ? `${metric.gate_threshold_percent}%` : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{metric.payout_on_booking_pct ?? 70}%</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{metric.payout_on_collection_pct ?? 25}%</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{metric.payout_on_year_end_pct ?? 5}%</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditMetric(metric as PlanMetric)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeletingMetric(metric as PlanMetric)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Multiplier Grids Section */}
        {metrics.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Multiplier Grids</CardTitle>
              <CardDescription>
                Configure achievement-based multipliers for each metric
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="space-y-4">
                {metrics.map((metric) => (
                  <AccordionItem key={metric.id} value={metric.id} className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{metric.metric_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {formatLogicType(metric.logic_type)}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {getMultipliersForMetric(metric.id).length} tiers
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4">
                      <MultiplierGridEditor
                        planMetricId={metric.id}
                        metricName={metric.metric_name}
                        logicType={metric.logic_type}
                        existingMultipliers={getMultipliersForMetric(metric.id)}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* Closing ARR Renewal Multipliers */}
        <ClosingArrRenewalMultiplierEditor planId={planId!} />

        {/* Commission Structure Section */}
        <PlanCommissionEditor planId={planId!} />

        {/* SPIFFs Section */}
        <SpiffEditor
          planId={planId!}
          metricNames={metrics.map(m => m.metric_name)}
        />

        {/* NRR Additional Pay Section */}
        <NrrSettingsCard
          planId={planId!}
          nrrOtePercent={(plan as any).nrr_ote_percent ?? 0}
          crErMinGpMarginPct={(plan as any).cr_er_min_gp_margin_pct ?? 0}
          implMinGpMarginPct={(plan as any).impl_min_gp_margin_pct ?? 0}
          nrrPayoutOnBookingPct={(plan as any).nrr_payout_on_booking_pct ?? 0}
          nrrPayoutOnCollectionPct={(plan as any).nrr_payout_on_collection_pct ?? 100}
          nrrPayoutOnYearEndPct={(plan as any).nrr_payout_on_year_end_pct ?? 0}
        />

        {/* Payout Settings Section */}
        <PayoutSettingsCard
          planId={planId!}
          payoutFrequency={plan.payout_frequency || "monthly"}
          clawbackPeriodDays={plan.clawback_period_days || 180}
          isClawbackExempt={plan.is_clawback_exempt || false}
        />

        {/* Assigned Employees Section */}
        <AssignedEmployeesCard planId={planId!} planName={plan.name} />
      </div>

      {/* Add/Edit Metric Dialog */}
      <MetricFormDialog
        open={showMetricDialog}
        onOpenChange={(open) => {
          setShowMetricDialog(open);
          if (!open) setEditingMetric(null);
        }}
        metric={editingMetric}
        onSubmit={handleMetricSubmit}
        isSubmitting={createMetricMutation.isPending || updateMetricMutation.isPending}
        existingWeightage={
          editingMetric
            ? totalWeightage - editingMetric.weightage_percent
            : totalWeightage
        }
      />

      {/* Delete Metric Confirmation */}
      <AlertDialog open={!!deletingMetric} onOpenChange={(open) => !open && setDeletingMetric(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Metric</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingMetric?.metric_name}"? 
              This will also remove all associated multiplier grids. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMetricMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingMetric && deleteMetricMutation.mutate(deletingMetric.id)}
              disabled={deleteMetricMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMetricMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Metric
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
