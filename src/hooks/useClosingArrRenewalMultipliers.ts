import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ClosingArrRenewalMultiplier {
  id: string;
  plan_id: string;
  min_years: number;
  max_years: number | null;
  multiplier_value: number;
  created_at: string;
}

export function useClosingArrRenewalMultipliers(planId: string | undefined) {
  return useQuery({
    queryKey: ["closing_arr_renewal_multipliers", planId],
    queryFn: async () => {
      if (!planId) return [];
      const { data, error } = await supabase
        .from("closing_arr_renewal_multipliers" as any)
        .select("*")
        .eq("plan_id", planId)
        .order("min_years");

      if (error) throw error;
      return (data || []) as unknown as ClosingArrRenewalMultiplier[];
    },
    enabled: !!planId,
  });
}

export function useCreateClosingArrRenewalMultiplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: {
      plan_id: string;
      min_years: number;
      max_years: number | null;
      multiplier_value: number;
    }) => {
      const { data, error } = await supabase
        .from("closing_arr_renewal_multipliers" as any)
        .insert(values)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["closing_arr_renewal_multipliers", variables.plan_id] });
      toast.success("Renewal multiplier added");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add multiplier: ${error.message}`);
    },
  });
}

export function useUpdateClosingArrRenewalMultiplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: {
      id: string;
      plan_id: string;
      min_years: number;
      max_years: number | null;
      multiplier_value: number;
    }) => {
      const { data, error } = await supabase
        .from("closing_arr_renewal_multipliers" as any)
        .update({
          min_years: values.min_years,
          max_years: values.max_years,
          multiplier_value: values.multiplier_value,
        })
        .eq("id", values.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["closing_arr_renewal_multipliers", variables.plan_id] });
      toast.success("Renewal multiplier updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update multiplier: ${error.message}`);
    },
  });
}

export function useDeleteClosingArrRenewalMultiplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: { id: string; plan_id: string }) => {
      const { error } = await supabase
        .from("closing_arr_renewal_multipliers" as any)
        .delete()
        .eq("id", values.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["closing_arr_renewal_multipliers", variables.plan_id] });
      toast.success("Renewal multiplier removed");
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove multiplier: ${error.message}`);
    },
  });
}

/**
 * Look up the renewal multiplier for a given number of renewal years
 */
export function findRenewalMultiplier(
  multipliers: ClosingArrRenewalMultiplier[],
  renewalYears: number
): number {
  // Sort descending by min_years so the most specific (highest) tier matches first
  const sorted = [...multipliers].sort((a, b) => b.min_years - a.min_years);
  for (const m of sorted) {
    if (renewalYears >= m.min_years && (m.max_years === null || renewalYears <= m.max_years)) {
      return m.multiplier_value;
    }
  }
  return 1.0; // Default: no adjustment
}
