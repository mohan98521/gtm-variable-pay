/**
 * Payout Adjustments Hooks
 * 
 * React Query hooks for managing payout adjustments:
 * - CRUD operations for payout_adjustments
 * - Approval workflow
 * - Application to future months
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface PayoutAdjustment {
  id: string;
  payout_run_id: string;
  employee_id: string;
  adjustment_type: 'correction' | 'clawback_reversal' | 'manual_override';
  original_amount_usd: number;
  adjustment_amount_usd: number;
  original_amount_local: number;
  adjustment_amount_local: number;
  local_currency: string;
  exchange_rate_used: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  applied_to_month: string | null;
  requested_by: string | null;
  approved_by: string | null;
  supporting_documents: any | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAdjustmentInput {
  payoutRunId: string;
  employeeId: string;
  adjustmentType: 'correction' | 'clawback_reversal' | 'manual_override';
  originalAmountUsd: number;
  adjustmentAmountUsd: number;
  localCurrency: string;
  exchangeRateUsed: number;
  reason: string;
  appliedToMonth?: string;
}

/**
 * Fetch adjustments for a payout run
 */
export function usePayoutAdjustments(payoutRunId: string | undefined) {
  return useQuery({
    queryKey: ["payout_adjustments", payoutRunId],
    queryFn: async () => {
      if (!payoutRunId) return [];
      
      const { data, error } = await supabase
        .from("payout_adjustments")
        .select("*")
        .eq("payout_run_id", payoutRunId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as PayoutAdjustment[];
    },
    enabled: !!payoutRunId,
  });
}

/**
 * Create a new payout adjustment
 */
export function useCreateAdjustment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateAdjustmentInput) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("payout_adjustments")
        .insert({
          payout_run_id: input.payoutRunId,
          employee_id: input.employeeId,
          adjustment_type: input.adjustmentType,
          original_amount_usd: input.originalAmountUsd,
          adjustment_amount_usd: input.adjustmentAmountUsd,
          original_amount_local: input.originalAmountUsd * input.exchangeRateUsed,
          adjustment_amount_local: input.adjustmentAmountUsd * input.exchangeRateUsed,
          local_currency: input.localCurrency,
          exchange_rate_used: input.exchangeRateUsed,
          reason: input.reason,
          status: 'pending',
          applied_to_month: input.appliedToMonth,
          requested_by: user?.user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as PayoutAdjustment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["payout_adjustments", variables.payoutRunId] });
      toast({ title: "Adjustment created", description: "Pending approval." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

/**
 * Approve or reject an adjustment
 */
export function useApproveAdjustment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      adjustmentId, 
      approved,
      payoutRunId 
    }: { 
      adjustmentId: string; 
      approved: boolean;
      payoutRunId: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("payout_adjustments")
        .update({
          status: approved ? 'approved' : 'rejected',
          approved_by: user?.user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", adjustmentId)
        .select()
        .single();
      
      if (error) throw error;
      return { data, payoutRunId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["payout_adjustments", result.payoutRunId] });
      toast({ 
        title: result.data.status === 'approved' ? "Adjustment approved" : "Adjustment rejected" 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

/**
 * Apply an approved adjustment to a future month
 */
export function useApplyAdjustment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      adjustmentId, 
      targetMonth,
      payoutRunId 
    }: { 
      adjustmentId: string; 
      targetMonth: string;
      payoutRunId: string;
    }) => {
      // Get the adjustment
      const { data: adjustment, error: fetchError } = await supabase
        .from("payout_adjustments")
        .select("*")
        .eq("id", adjustmentId)
        .single();
      
      if (fetchError) throw fetchError;
      if (adjustment.status !== 'approved') {
        throw new Error("Only approved adjustments can be applied");
      }
      
      // Create a payout record for the target month
      const { error: insertError } = await supabase
        .from("monthly_payouts")
        .insert({
          employee_id: adjustment.employee_id,
          month_year: targetMonth,
          payout_type: `Adjustment - ${adjustment.adjustment_type}`,
          calculated_amount_usd: adjustment.adjustment_amount_usd,
          calculated_amount_local: adjustment.adjustment_amount_local,
          local_currency: adjustment.local_currency,
          exchange_rate_used: adjustment.exchange_rate_used,
          exchange_rate_type: 'compensation',
          status: 'calculated',
          notes: adjustment.reason,
        });
      
      if (insertError) throw insertError;
      
      // Update adjustment status to applied
      const { data, error: updateError } = await supabase
        .from("payout_adjustments")
        .update({
          status: 'applied',
          applied_to_month: targetMonth,
          updated_at: new Date().toISOString(),
        })
        .eq("id", adjustmentId)
        .select()
        .single();
      
      if (updateError) throw updateError;
      return { data, payoutRunId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["payout_adjustments", result.payoutRunId] });
      queryClient.invalidateQueries({ queryKey: ["monthly_payouts"] });
      toast({ title: "Adjustment applied", description: "Added to target month payouts." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

/**
 * Delete a pending adjustment
 */
export function useDeleteAdjustment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      adjustmentId, 
      payoutRunId 
    }: { 
      adjustmentId: string; 
      payoutRunId: string;
    }) => {
      const { error } = await supabase
        .from("payout_adjustments")
        .delete()
        .eq("id", adjustmentId)
        .eq("status", "pending"); // Can only delete pending adjustments
      
      if (error) throw error;
      return { payoutRunId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["payout_adjustments", result.payoutRunId] });
      toast({ title: "Adjustment deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
