import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserTarget {
  id: string;
  user_id: string;
  plan_id: string;
  effective_start_date: string;
  effective_end_date: string;
  target_value_annual: number;
  currency: string;
  target_bonus_percent: number | null;
  tfp_local_currency: number | null;
  ote_local_currency: number | null;
  tfp_usd: number | null;
  target_bonus_usd: number | null;
  ote_usd: number | null;
  created_at: string;
}

export function useUserTargets(userId?: string) {
  return useQuery({
    queryKey: ["user_targets", userId],
    queryFn: async () => {
      let query = supabase.from("user_targets").select("*");
      
      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query.order("effective_start_date", { ascending: false });

      if (error) throw error;
      return data as UserTarget[];
    },
  });
}

export function useUserTargetsByPlan(planId: string | undefined) {
  return useQuery({
    queryKey: ["user_targets_by_plan", planId],
    queryFn: async () => {
      if (!planId) return [];
      
      const { data, error } = await supabase
        .from("user_targets")
        .select("*")
        .eq("plan_id", planId);

      if (error) throw error;
      return data as UserTarget[];
    },
    enabled: !!planId,
  });
}
