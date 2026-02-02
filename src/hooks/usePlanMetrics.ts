import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MultiplierGrid {
  id: string;
  plan_metric_id: string;
  min_pct: number;
  max_pct: number;
  multiplier_value: number;
}

export interface PlanMetric {
  id: string;
  plan_id: string;
  metric_name: string;
  weightage_percent: number;
  logic_type: "Stepped_Accelerator" | "Gated_Threshold" | "Linear";
  gate_threshold_percent: number | null;
  payout_on_booking_pct: number;
  payout_on_collection_pct: number;
  created_at: string;
  multiplier_grids?: MultiplierGrid[];
}

export function usePlanMetrics(planId: string | undefined) {
  return useQuery({
    queryKey: ["plan_metrics", planId],
    queryFn: async () => {
      if (!planId) return [];

      // Fetch plan metrics
      const { data: metrics, error: metricsError } = await supabase
        .from("plan_metrics")
        .select("*")
        .eq("plan_id", planId)
        .order("metric_name");

      if (metricsError) throw metricsError;
      if (!metrics || metrics.length === 0) return [];

      // Fetch multiplier grids for all metrics
      const metricIds = metrics.map(m => m.id);
      const { data: grids, error: gridsError } = await supabase
        .from("multiplier_grids")
        .select("*")
        .in("plan_metric_id", metricIds)
        .order("min_pct");

      if (gridsError) throw gridsError;

      // Combine metrics with their grids
      const metricsWithGrids: PlanMetric[] = metrics.map(metric => ({
        ...metric,
        multiplier_grids: (grids || []).filter(g => g.plan_metric_id === metric.id),
      }));

      return metricsWithGrids;
    },
    enabled: !!planId,
  });
}

/**
 * Get a single plan metric by ID with its multiplier grids
 */
export function usePlanMetric(metricId: string | undefined) {
  return useQuery({
    queryKey: ["plan_metric", metricId],
    queryFn: async () => {
      if (!metricId) return null;

      const { data: metric, error: metricError } = await supabase
        .from("plan_metrics")
        .select("*")
        .eq("id", metricId)
        .maybeSingle();

      if (metricError) throw metricError;
      if (!metric) return null;

      const { data: grids, error: gridsError } = await supabase
        .from("multiplier_grids")
        .select("*")
        .eq("plan_metric_id", metricId)
        .order("min_pct");

      if (gridsError) throw gridsError;

      return {
        ...metric,
        multiplier_grids: grids || [],
      } as PlanMetric;
    },
    enabled: !!metricId,
  });
}
