import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlanMetric, MultiplierGrid } from "./usePlanMetrics";

export interface UserPlanConfiguration {
  // User target info
  targetId: string;
  userId: string;
  targetValueAnnual: number;
  currency: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  targetBonusPercent: number | null;
  tfpLocalCurrency: number | null;
  oteLocalCurrency: number | null;
  tfpUsd: number | null;
  targetBonusUsd: number | null;
  oteUsd: number | null;
  
  // Plan info
  planId: string;
  planName: string;
  planDescription: string | null;
  planIsActive: boolean;
  
  // Metrics with multiplier grids
  metrics: PlanMetric[];
}

/**
 * Get complete plan configuration for the current user
 * This combines user_targets, comp_plans, plan_metrics, and multiplier_grids
 */
export function useUserPlanConfiguration() {
  return useQuery({
    queryKey: ["user_plan_configuration"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const today = new Date().toISOString().split('T')[0];

      // Get current user target with plan info
      const { data: userTarget, error: targetError } = await supabase
        .from("user_targets")
        .select(`
          *,
          comp_plans:plan_id (
            id,
            name,
            description,
            is_active
          )
        `)
        .eq("user_id", user.id)
        .lte("effective_start_date", today)
        .gte("effective_end_date", today)
        .order("effective_start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (targetError) throw targetError;
      if (!userTarget || !userTarget.comp_plans) return null;

      // Fetch plan metrics
      const { data: metrics, error: metricsError } = await supabase
        .from("plan_metrics")
        .select("*")
        .eq("plan_id", userTarget.plan_id)
        .order("metric_name");

      if (metricsError) throw metricsError;

      // Fetch multiplier grids for all metrics
      const metricIds = (metrics || []).map(m => m.id);
      let grids: MultiplierGrid[] = [];
      
      if (metricIds.length > 0) {
        const { data: gridsData, error: gridsError } = await supabase
          .from("multiplier_grids")
          .select("*")
          .in("plan_metric_id", metricIds)
          .order("min_pct");

        if (gridsError) throw gridsError;
        grids = gridsData || [];
      }

      // Combine metrics with their grids
      const metricsWithGrids: PlanMetric[] = (metrics || []).map(metric => ({
        ...metric,
        multiplier_grids: grids.filter(g => g.plan_metric_id === metric.id),
      }));

      const config: UserPlanConfiguration = {
        targetId: userTarget.id,
        userId: userTarget.user_id,
        targetValueAnnual: userTarget.target_value_annual,
        currency: userTarget.currency,
        effectiveStartDate: userTarget.effective_start_date,
        effectiveEndDate: userTarget.effective_end_date,
        targetBonusPercent: userTarget.target_bonus_percent,
        tfpLocalCurrency: userTarget.tfp_local_currency,
        oteLocalCurrency: userTarget.ote_local_currency,
        tfpUsd: userTarget.tfp_usd,
        targetBonusUsd: userTarget.target_bonus_usd,
        oteUsd: userTarget.ote_usd,
        planId: userTarget.plan_id,
        planName: userTarget.comp_plans.name,
        planDescription: userTarget.comp_plans.description,
        planIsActive: userTarget.comp_plans.is_active,
        metrics: metricsWithGrids,
      };

      return config;
    },
  });
}

/**
 * Get plan configuration for a specific user (admin use)
 */
export function useUserPlanConfigurationById(userId: string | undefined) {
  return useQuery({
    queryKey: ["user_plan_configuration", userId],
    queryFn: async () => {
      if (!userId) return null;

      const today = new Date().toISOString().split('T')[0];

      const { data: userTarget, error: targetError } = await supabase
        .from("user_targets")
        .select(`
          *,
          comp_plans:plan_id (
            id,
            name,
            description,
            is_active
          )
        `)
        .eq("user_id", userId)
        .lte("effective_start_date", today)
        .gte("effective_end_date", today)
        .order("effective_start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (targetError) throw targetError;
      if (!userTarget || !userTarget.comp_plans) return null;

      const { data: metrics, error: metricsError } = await supabase
        .from("plan_metrics")
        .select("*")
        .eq("plan_id", userTarget.plan_id)
        .order("metric_name");

      if (metricsError) throw metricsError;

      const metricIds = (metrics || []).map(m => m.id);
      let grids: MultiplierGrid[] = [];
      
      if (metricIds.length > 0) {
        const { data: gridsData, error: gridsError } = await supabase
          .from("multiplier_grids")
          .select("*")
          .in("plan_metric_id", metricIds)
          .order("min_pct");

        if (gridsError) throw gridsError;
        grids = gridsData || [];
      }

      const metricsWithGrids: PlanMetric[] = (metrics || []).map(metric => ({
        ...metric,
        multiplier_grids: grids.filter(g => g.plan_metric_id === metric.id),
      }));

      const config: UserPlanConfiguration = {
        targetId: userTarget.id,
        userId: userTarget.user_id,
        targetValueAnnual: userTarget.target_value_annual,
        currency: userTarget.currency,
        effectiveStartDate: userTarget.effective_start_date,
        effectiveEndDate: userTarget.effective_end_date,
        targetBonusPercent: userTarget.target_bonus_percent,
        tfpLocalCurrency: userTarget.tfp_local_currency,
        oteLocalCurrency: userTarget.ote_local_currency,
        tfpUsd: userTarget.tfp_usd,
        targetBonusUsd: userTarget.target_bonus_usd,
        oteUsd: userTarget.ote_usd,
        planId: userTarget.plan_id,
        planName: userTarget.comp_plans.name,
        planDescription: userTarget.comp_plans.description,
        planIsActive: userTarget.comp_plans.is_active,
        metrics: metricsWithGrids,
      };

      return config;
    },
    enabled: !!userId,
  });
}
