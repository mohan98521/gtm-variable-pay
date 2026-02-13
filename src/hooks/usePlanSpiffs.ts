import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface PlanSpiff {
  id: string;
  plan_id: string;
  spiff_name: string;
  description: string | null;
  linked_metric_name: string;
  spiff_rate_pct: number;
  min_deal_value_usd: number | null;
  payout_on_booking_pct: number;
  payout_on_collection_pct: number;
  payout_on_year_end_pct: number;
  is_active: boolean;
  created_at: string;
}

export function usePlanSpiffs(planId: string | undefined) {
  return useQuery({
    queryKey: ["plan_spiffs", planId],
    queryFn: async () => {
      if (!planId) return [];
      const { data, error } = await supabase
        .from("plan_spiffs")
        .select("*")
        .eq("plan_id", planId)
        .order("spiff_name");

      if (error) throw error;
      return data as PlanSpiff[];
    },
    enabled: !!planId,
  });
}

export function useCreatePlanSpiff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: {
      plan_id: string;
      spiff_name: string;
      description?: string | null;
      linked_metric_name: string;
      spiff_rate_pct: number;
      min_deal_value_usd?: number | null;
      is_active?: boolean;
      payout_on_booking_pct?: number;
      payout_on_collection_pct?: number;
      payout_on_year_end_pct?: number;
    }) => {
      const { data, error } = await supabase
        .from("plan_spiffs")
        .insert({
          plan_id: values.plan_id,
          spiff_name: values.spiff_name,
          description: values.description ?? null,
          linked_metric_name: values.linked_metric_name,
          spiff_rate_pct: values.spiff_rate_pct,
          min_deal_value_usd: values.min_deal_value_usd ?? null,
          is_active: values.is_active ?? true,
          payout_on_booking_pct: values.payout_on_booking_pct ?? 0,
          payout_on_collection_pct: values.payout_on_collection_pct ?? 100,
          payout_on_year_end_pct: values.payout_on_year_end_pct ?? 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plan_spiffs", variables.plan_id] });
      toast({ title: "SPIFF added", description: "The SPIFF has been added to the plan." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdatePlanSpiff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: {
      id: string;
      plan_id: string;
      spiff_name: string;
      description?: string | null;
      linked_metric_name: string;
      spiff_rate_pct: number;
      min_deal_value_usd?: number | null;
      is_active?: boolean;
      payout_on_booking_pct?: number;
      payout_on_collection_pct?: number;
      payout_on_year_end_pct?: number;
    }) => {
      const { data, error } = await supabase
        .from("plan_spiffs")
        .update({
          spiff_name: values.spiff_name,
          description: values.description ?? null,
          linked_metric_name: values.linked_metric_name,
          spiff_rate_pct: values.spiff_rate_pct,
          min_deal_value_usd: values.min_deal_value_usd ?? null,
          is_active: values.is_active,
          payout_on_booking_pct: values.payout_on_booking_pct ?? 0,
          payout_on_collection_pct: values.payout_on_collection_pct ?? 100,
          payout_on_year_end_pct: values.payout_on_year_end_pct ?? 0,
        })
        .eq("id", values.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plan_spiffs", variables.plan_id] });
      toast({ title: "SPIFF updated", description: "The SPIFF settings have been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeletePlanSpiff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: { id: string; plan_id: string }) => {
      const { error } = await supabase
        .from("plan_spiffs")
        .delete()
        .eq("id", values.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plan_spiffs", variables.plan_id] });
      toast({ title: "SPIFF removed", description: "The SPIFF has been removed from the plan." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
