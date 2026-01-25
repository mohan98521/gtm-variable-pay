import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompPlan {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  effective_year: number;
  created_at: string;
  updated_at: string;
}

export function useCompPlans(year?: number) {
  return useQuery({
    queryKey: ["comp_plans", year],
    queryFn: async () => {
      let query = supabase
        .from("comp_plans")
        .select("*")
        .order("name");

      if (year) {
        query = query.eq("effective_year", year);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CompPlan[];
    },
  });
}

export function useAvailableYears() {
  return useQuery({
    queryKey: ["comp_plan_years"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comp_plans")
        .select("effective_year")
        .order("effective_year", { ascending: false });

      if (error) throw error;

      // Get unique years
      const years = [...new Set(data?.map((d) => d.effective_year) || [])];

      // Ensure current year and next year are always available
      const currentYear = new Date().getFullYear();
      if (!years.includes(currentYear)) years.push(currentYear);
      if (!years.includes(currentYear + 1)) years.push(currentYear + 1);

      return years.sort((a, b) => b - a); // Descending order
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
