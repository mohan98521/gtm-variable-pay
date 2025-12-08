import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface QuarterlyTarget {
  id: string;
  employee_id: string;
  effective_year: number;
  quarter: number;
  metric_type: string;
  target_value_usd: number;
  created_at: string;
}

export interface QuarterlyTargetInsert {
  employee_id: string;
  effective_year: number;
  quarter: number;
  metric_type: string;
  target_value_usd: number;
}

export function useQuarterlyTargets(year?: number) {
  return useQuery({
    queryKey: ["quarterly_targets", year],
    queryFn: async () => {
      let query = supabase
        .from("quarterly_targets")
        .select("*")
        .order("quarter", { ascending: true });

      if (year) {
        query = query.eq("effective_year", year);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as QuarterlyTarget[];
    },
  });
}

export function useInsertQuarterlyTargets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targets: QuarterlyTargetInsert[]) => {
      const { data, error } = await supabase
        .from("quarterly_targets")
        .upsert(targets, { onConflict: "employee_id,effective_year,quarter,metric_type" })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quarterly_targets"] });
      toast({
        title: "Success",
        description: "Quarterly targets uploaded successfully",
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
