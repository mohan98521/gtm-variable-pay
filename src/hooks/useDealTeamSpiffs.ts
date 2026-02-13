import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface DealTeamSpiffAllocation {
  id: string;
  deal_id: string;
  employee_id: string;
  allocated_amount_usd: number;
  allocated_amount_local: number;
  local_currency: string;
  exchange_rate_used: number;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  payout_month: string;
  payout_run_id: string | null;
  created_at: string;
}

export interface DealTeamSpiffConfig {
  id: string;
  spiff_pool_amount_usd: number;
  min_deal_arr_usd: number;
  is_active: boolean;
  exclude_roles: string[];
  created_at: string;
}

// ---- Config ----

export function useDealTeamSpiffConfig() {
  return useQuery({
    queryKey: ["deal_team_spiff_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_team_spiff_config" as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as DealTeamSpiffConfig | null;
    },
  });
}

export function useUpdateDealTeamSpiffConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<DealTeamSpiffConfig> & { id: string }) => {
      const { id, ...rest } = values;
      const { error } = await supabase
        .from("deal_team_spiff_config" as any)
        .update(rest as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal_team_spiff_config"] });
      toast({ title: "Config updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
}

// ---- Allocations ----

export function useDealTeamSpiffAllocations(dealId?: string) {
  return useQuery({
    queryKey: ["deal_team_spiff_allocations", dealId],
    queryFn: async () => {
      let query = supabase.from("deal_team_spiff_allocations" as any).select("*");
      if (dealId) query = query.eq("deal_id", dealId);
      const { data, error } = await (query as any).order("created_at");
      if (error) throw error;
      return (data || []) as unknown as DealTeamSpiffAllocation[];
    },
  });
}

export function useUpsertDealTeamSpiffAllocations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (allocations: {
      deal_id: string;
      items: {
        employee_id: string;
        allocated_amount_usd: number;
        allocated_amount_local: number;
        local_currency: string;
        exchange_rate_used: number;
        notes?: string;
      }[];
      payout_month: string;
      status?: string;
    }) => {
      // Delete existing allocations for this deal first
      await supabase
        .from("deal_team_spiff_allocations" as any)
        .delete()
        .eq("deal_id", allocations.deal_id)
        .in("status", ["pending"] as any);

      if (allocations.items.length === 0) return;

      const records = allocations.items
        .filter(i => i.allocated_amount_usd > 0)
        .map(item => ({
          deal_id: allocations.deal_id,
          employee_id: item.employee_id,
          allocated_amount_usd: item.allocated_amount_usd,
          allocated_amount_local: item.allocated_amount_local,
          local_currency: item.local_currency,
          exchange_rate_used: item.exchange_rate_used,
          notes: item.notes || null,
          payout_month: allocations.payout_month,
          status: allocations.status || "pending",
        }));

      if (records.length > 0) {
        const { error } = await supabase
          .from("deal_team_spiff_allocations" as any)
          .insert(records as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["deal_team_spiff_allocations"] });
      toast({ title: "Allocations saved", description: "Deal team SPIFF allocations have been saved." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
}

export function useApproveDealTeamSpiffAllocations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dealId: string) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("deal_team_spiff_allocations" as any)
        .update({
          status: "approved",
          approved_by: user.user?.id,
          approved_at: new Date().toISOString(),
        } as any)
        .eq("deal_id", dealId)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal_team_spiff_allocations"] });
      toast({ title: "Approved", description: "Deal team SPIFF allocations approved." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
}

export function useRejectDealTeamSpiffAllocations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dealId: string) => {
      const { error } = await supabase
        .from("deal_team_spiff_allocations" as any)
        .delete()
        .eq("deal_id", dealId)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal_team_spiff_allocations"] });
      toast({ title: "Rejected", description: "Deal team SPIFF allocations rejected and removed." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
}
