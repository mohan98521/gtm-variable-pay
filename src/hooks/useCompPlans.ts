import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompPlan {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useCompPlans() {
  return useQuery({
    queryKey: ["comp_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comp_plans")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as CompPlan[];
    },
  });
}

export function useCompPlanWithMetrics(planId: string | undefined) {
  return useQuery({
    queryKey: ["comp_plan_with_metrics", planId],
    queryFn: async () => {
      if (!planId) return null;

      const { data: plan, error: planError } = await supabase
        .from("comp_plans")
        .select("*")
        .eq("id", planId)
        .maybeSingle();

      if (planError) throw planError;
      if (!plan) return null;

      const { data: metrics, error: metricsError } = await supabase
        .from("plan_metrics")
        .select("*")
        .eq("plan_id", planId);

      if (metricsError) throw metricsError;

      return {
        ...plan,
        metrics: metrics || [],
      };
    },
    enabled: !!planId,
  });
}
