import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompPlan {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  effective_year: number;
  payout_frequency: string | null;
  clawback_period_days: number | null;
  is_clawback_exempt: boolean;
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

      // Get unique years from existing plans
      const years = [...new Set(data?.map((d) => d.effective_year) || [])];

      // Include range: past 2 years to next 5 years
      const currentYear = new Date().getFullYear();
      for (let y = currentYear - 2; y <= currentYear + 5; y++) {
        if (!years.includes(y)) years.push(y);
      }

      return years.sort((a, b) => b - a); // Descending order
    },
  });
}

export function usePlansForYear(year: number) {
  return useQuery({
    queryKey: ["comp_plans_for_copy", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comp_plans")
        .select("*")
        .eq("effective_year", year)
        .order("name");

      if (error) throw error;
      return data as CompPlan[];
    },
    enabled: !!year,
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
