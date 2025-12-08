import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface PerformanceTarget {
  id: string;
  employee_id: string;
  metric_type: string;
  target_value_usd: number;
  effective_year: number;
  created_at: string;
}

export interface PerformanceTargetInsert {
  employee_id: string;
  metric_type: string;
  target_value_usd: number;
  effective_year: number;
}

// CY25 Quarterly split percentages
export const QUARTERLY_SPLIT_PERCENTAGES = {
  Q1: 0.20, // 20%
  Q2: 0.25, // 25%
  Q3: 0.25, // 25%
  Q4: 0.30, // 30%
};

export function usePerformanceTargets(year?: number) {
  return useQuery({
    queryKey: ["performance_targets", year],
    queryFn: async () => {
      let query = supabase
        .from("performance_targets")
        .select("*")
        .order("employee_id", { ascending: true });

      if (year) {
        query = query.eq("effective_year", year);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PerformanceTarget[];
    },
  });
}

export function useInsertPerformanceTargets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targets: PerformanceTargetInsert[]) => {
      const { data, error } = await supabase
        .from("performance_targets")
        .upsert(targets, { onConflict: "employee_id,metric_type,effective_year" })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance_targets"] });
      toast({
        title: "Success",
        description: "Performance targets uploaded successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Helper function to calculate quarterly target from annual
export function calculateQuarterlyTarget(annualTarget: number, quarter: 1 | 2 | 3 | 4): number {
  const percentages = [0.20, 0.25, 0.25, 0.30];
  return annualTarget * percentages[quarter - 1];
}
