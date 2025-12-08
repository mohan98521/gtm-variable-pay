import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ClosingArrTarget {
  id: string;
  employee_id: string;
  effective_year: number;
  opening_arr_usd: number;
  software_bookings_target_usd: number;
  msps_bookings_target_usd: number;
  software_churn_allowance_usd: number;
  ms_churn_allowance_usd: number;
  net_price_increase_target_usd: number;
  closing_arr_target_usd: number;
  created_at: string;
}

export interface ClosingArrTargetInsert {
  employee_id: string;
  effective_year: number;
  opening_arr_usd: number;
  software_bookings_target_usd: number;
  msps_bookings_target_usd: number;
  software_churn_allowance_usd: number;
  ms_churn_allowance_usd: number;
  net_price_increase_target_usd: number;
  closing_arr_target_usd: number;
}

export function useClosingArrTargets(year?: number) {
  return useQuery({
    queryKey: ["closing_arr_targets", year],
    queryFn: async () => {
      let query = supabase
        .from("closing_arr_targets")
        .select("*")
        .order("employee_id", { ascending: true });

      if (year) {
        query = query.eq("effective_year", year);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ClosingArrTarget[];
    },
  });
}

export function useInsertClosingArrTargets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targets: ClosingArrTargetInsert[]) => {
      const { data, error } = await supabase
        .from("closing_arr_targets")
        .upsert(targets, { onConflict: "employee_id,effective_year" })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closing_arr_targets"] });
      toast({
        title: "Success",
        description: "Closing ARR targets uploaded successfully",
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
