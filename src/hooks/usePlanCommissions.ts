import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface PlanCommission {
  id: string;
  plan_id: string;
  commission_type: string;
  commission_rate_pct: number;
  min_threshold_usd: number | null;
  is_active: boolean;
  payout_on_booking_pct: number;
  payout_on_collection_pct: number;
  payout_on_year_end_pct: number;
  created_at: string;
}

export const PREDEFINED_COMMISSION_TYPES = [
  "Managed Services",
  "Perpetual License",
  "CR/ER",
  "Implementation",
] as const;

export type PredefinedCommissionType = (typeof PREDEFINED_COMMISSION_TYPES)[number];

// Allow custom commission types beyond the predefined list
export const ALLOW_CUSTOM_TYPES = true;

export function usePlanCommissions(planId: string | undefined) {
  return useQuery({
    queryKey: ["plan_commissions", planId],
    queryFn: async () => {
      if (!planId) return [];
      const { data, error } = await supabase
        .from("plan_commissions")
        .select("*")
        .eq("plan_id", planId)
        .order("commission_type");

      if (error) throw error;
      return data as PlanCommission[];
    },
    enabled: !!planId,
  });
}

export function useCreatePlanCommission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: {
      plan_id: string;
      commission_type: string;
      commission_rate_pct: number;
      min_threshold_usd?: number | null;
      is_active?: boolean;
      payout_on_booking_pct?: number;
      payout_on_collection_pct?: number;
      payout_on_year_end_pct?: number;
    }) => {
      const { data, error } = await supabase
        .from("plan_commissions")
        .insert({
          plan_id: values.plan_id,
          commission_type: values.commission_type,
          commission_rate_pct: values.commission_rate_pct,
          min_threshold_usd: values.min_threshold_usd ?? null,
          is_active: values.is_active ?? true,
          payout_on_booking_pct: values.payout_on_booking_pct ?? 70,
          payout_on_collection_pct: values.payout_on_collection_pct ?? 25,
          payout_on_year_end_pct: values.payout_on_year_end_pct ?? 5,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plan_commissions", variables.plan_id] });
      toast({ title: "Commission added", description: "The commission type has been added to the plan." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdatePlanCommission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: {
      id: string;
      plan_id: string;
      commission_rate_pct: number;
      min_threshold_usd?: number | null;
      is_active?: boolean;
      payout_on_booking_pct?: number;
      payout_on_collection_pct?: number;
      payout_on_year_end_pct?: number;
    }) => {
      const { data, error } = await supabase
        .from("plan_commissions")
        .update({
          commission_rate_pct: values.commission_rate_pct,
          min_threshold_usd: values.min_threshold_usd ?? null,
          is_active: values.is_active,
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plan_commissions", variables.plan_id] });
      toast({ title: "Commission updated", description: "The commission settings have been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeletePlanCommission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: { id: string; plan_id: string }) => {
      const { error } = await supabase
        .from("plan_commissions")
        .delete()
        .eq("id", values.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plan_commissions", variables.plan_id] });
      toast({ title: "Commission removed", description: "The commission type has been removed from the plan." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
