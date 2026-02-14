/**
 * F&F Settlements Hooks
 * 
 * React Query hooks for managing Full & Final settlement lifecycle.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  calculateTranche1,
  calculateTranche2,
  saveTrancheLines,
  clearTrancheLines,
} from "@/lib/fnfEngine";

export interface FnFSettlement {
  id: string;
  employee_id: string;
  departure_date: string;
  fiscal_year: number;
  collection_grace_days: number;
  tranche1_status: string;
  tranche1_total_usd: number;
  tranche1_calculated_at: string | null;
  tranche1_finalized_at: string | null;
  tranche2_status: string;
  tranche2_eligible_date: string | null;
  tranche2_total_usd: number;
  tranche2_calculated_at: string | null;
  tranche2_finalized_at: string | null;
  clawback_carryforward_usd: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FnFSettlementLine {
  id: string;
  settlement_id: string;
  tranche: number;
  line_type: string;
  payout_type: string | null;
  amount_usd: number;
  amount_local: number;
  local_currency: string;
  exchange_rate_used: number;
  deal_id: string | null;
  source_payout_id: string | null;
  notes: string | null;
  created_at: string;
}

const QUERY_KEY = "fnf_settlements";
const LINES_KEY = "fnf_settlement_lines";

export function useFnfSettlements(fiscalYear?: number) {
  return useQuery({
    queryKey: [QUERY_KEY, fiscalYear],
    queryFn: async () => {
      let query = supabase
        .from('fnf_settlements' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (fiscalYear) {
        query = query.eq('fiscal_year', fiscalYear);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FnFSettlement[];
    },
  });
}

export function useFnfSettlement(id: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('fnf_settlements' as any)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as unknown as FnFSettlement;
    },
    enabled: !!id,
  });
}

export function useFnfSettlementLines(settlementId: string | null) {
  return useQuery({
    queryKey: [LINES_KEY, settlementId],
    queryFn: async () => {
      if (!settlementId) return [];
      const { data, error } = await supabase
        .from('fnf_settlement_lines' as any)
        .select('*')
        .eq('settlement_id', settlementId)
        .order('tranche', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as FnFSettlementLine[];
    },
    enabled: !!settlementId,
  });
}

export function useCreateFnfSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      employee_id: string;
      departure_date: string;
      fiscal_year: number;
      collection_grace_days: number;
      notes?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const departure = new Date(params.departure_date);
      const eligible = new Date(departure);
      eligible.setDate(eligible.getDate() + params.collection_grace_days);

      const { data, error } = await supabase
        .from('fnf_settlements' as any)
        .insert({
          employee_id: params.employee_id,
          departure_date: params.departure_date,
          fiscal_year: params.fiscal_year,
          collection_grace_days: params.collection_grace_days,
          tranche1_status: 'draft',
          tranche2_status: 'pending',
          tranche2_eligible_date: eligible.toISOString().split('T')[0],
          notes: params.notes || null,
          created_by: userData?.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as FnFSettlement;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: "F&F Settlement initiated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useCalculateTranche1() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settlement: FnFSettlement) => {
      // Clear existing lines
      await clearTrancheLines(settlement.id, 1);

      // Calculate
      const result = await calculateTranche1(
        settlement.id,
        settlement.employee_id,
        settlement.fiscal_year,
        settlement.departure_date
      );

      // Save lines
      await saveTrancheLines(result.lines);

      // Update settlement
      const { error } = await supabase
        .from('fnf_settlements' as any)
        .update({
          tranche1_total_usd: result.totalUsd,
          tranche1_calculated_at: new Date().toISOString(),
          clawback_carryforward_usd: result.clawbackCarryforwardUsd,
          tranche1_status: 'review',
        })
        .eq('id', settlement.id);

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [LINES_KEY] });
      toast({ title: "Tranche 1 calculated" });
    },
    onError: (err: Error) => {
      toast({ title: "Calculation error", description: err.message, variant: "destructive" });
    },
  });
}

export function useCalculateTranche2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settlement: FnFSettlement) => {
      await clearTrancheLines(settlement.id, 2);

      const result = await calculateTranche2(
        settlement.id,
        settlement.employee_id,
        settlement.fiscal_year,
        settlement.departure_date,
        settlement.collection_grace_days,
        settlement.clawback_carryforward_usd || 0
      );

      await saveTrancheLines(result.lines);

      const { error } = await supabase
        .from('fnf_settlements' as any)
        .update({
          tranche2_total_usd: result.totalUsd,
          tranche2_calculated_at: new Date().toISOString(),
          tranche2_status: 'review',
        })
        .eq('id', settlement.id);

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [LINES_KEY] });
      toast({ title: "Tranche 2 calculated" });
    },
    onError: (err: Error) => {
      toast({ title: "Calculation error", description: err.message, variant: "destructive" });
    },
  });
}

type TrancheKey = 'tranche1_status' | 'tranche2_status';

export function useUpdateTrancheStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      settlementId: string;
      tranche: 1 | 2;
      newStatus: string;
    }) => {
      const statusKey: TrancheKey = params.tranche === 1 ? 'tranche1_status' : 'tranche2_status';
      const finalizedKey = params.tranche === 1 ? 'tranche1_finalized_at' : 'tranche2_finalized_at';

      const updates: Record<string, any> = {
        [statusKey]: params.newStatus,
      };

      if (params.newStatus === 'finalized') {
        updates[finalizedKey] = new Date().toISOString();
      }

      const { error } = await supabase
        .from('fnf_settlements' as any)
        .update(updates)
        .eq('id', params.settlementId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}
