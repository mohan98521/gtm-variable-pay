/**
 * Payout Runs Hooks
 * 
 * React Query hooks for managing payout runs lifecycle:
 * - CRUD operations for payout_runs
 * - Calculation triggers
 * - Status transitions
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { 
  validatePayoutRunPrerequisites, 
  runPayoutCalculation,
  PayoutRunValidation,
  PayoutRunResult 
} from "@/lib/payoutEngine";

export interface PayoutRun {
  id: string;
  month_year: string;
  run_status: 'draft' | 'review' | 'approved' | 'finalized';
  is_locked: boolean;
  total_payout_usd: number | null;
  total_variable_pay_usd: number | null;
  total_commissions_usd: number | null;
  calculated_at: string | null;
  calculated_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  finalized_at: string | null;
  finalized_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all payout runs
 */
export function usePayoutRuns(year?: number) {
  return useQuery({
    queryKey: ["payout_runs", year],
    queryFn: async () => {
      let query = supabase
        .from("payout_runs")
        .select("*")
        .order("month_year", { ascending: false });
      
      if (year) {
        query = query
          .gte("month_year", `${year}-01`)
          .lte("month_year", `${year}-12`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as PayoutRun[];
    },
  });
}

/**
 * Fetch a single payout run by ID
 */
export function usePayoutRun(runId: string | undefined) {
  return useQuery({
    queryKey: ["payout_run", runId],
    queryFn: async () => {
      if (!runId) return null;
      
      const { data, error } = await supabase
        .from("payout_runs")
        .select("*")
        .eq("id", runId)
        .single();
      
      if (error) throw error;
      return data as PayoutRun;
    },
    enabled: !!runId,
  });
}

/**
 * Validate payout run prerequisites
 */
export function useValidatePayoutRun() {
  return useMutation({
    mutationFn: async (monthYear: string): Promise<PayoutRunValidation> => {
      return await validatePayoutRunPrerequisites(monthYear);
    },
  });
}

/**
 * Create a new payout run (draft status)
 */
export function useCreatePayoutRun() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      monthYear, 
      notes 
    }: { 
      monthYear: string; 
      notes?: string;
    }) => {
      // Check if run already exists for this month
      const { data: existing } = await supabase
        .from("payout_runs")
        .select("id")
        .eq("month_year", monthYear)
        .maybeSingle();
      
      if (existing) {
        throw new Error(`Payout run already exists for ${monthYear}`);
      }
      
      const { data, error } = await supabase
        .from("payout_runs")
        .insert({
          month_year: monthYear,
          run_status: "draft",
          notes,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as PayoutRun;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payout_runs"] });
      toast({ title: "Payout run created", description: "Draft payout run has been created." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

/**
 * Run payout calculation for a draft run
 */
export function useRunPayoutCalculation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      runId, 
      monthYear 
    }: { 
      runId: string; 
      monthYear: string;
    }): Promise<PayoutRunResult> => {
      // First validate
      const validation = await validatePayoutRunPrerequisites(monthYear);
      if (!validation.isValid) {
        const errorMessages = validation.errors.map(e => e.message).join('; ');
        throw new Error(`Validation failed: ${errorMessages}`);
      }
      
      // Run calculation
      return await runPayoutCalculation(runId, monthYear);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["payout_runs"] });
      queryClient.invalidateQueries({ queryKey: ["payout_run"] });
      queryClient.invalidateQueries({ queryKey: ["monthly_payouts"] });
      toast({ 
        title: "Calculation complete", 
        description: `Processed ${result.totalEmployees} employees. Total: $${result.totalPayoutUsd.toLocaleString()}` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Calculation failed", description: error.message, variant: "destructive" });
    },
  });
}

/**
 * Update payout run status
 */
export function useUpdatePayoutRunStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      runId, 
      status,
      userId 
    }: { 
      runId: string; 
      status: 'draft' | 'review' | 'approved' | 'finalized';
      userId?: string;
    }) => {
      const now = new Date().toISOString();
      const updates: Record<string, any> = {
        run_status: status,
        updated_at: now,
      };
      
      // Set appropriate timestamp based on status
      if (status === 'review') {
        updates.reviewed_at = now;
        updates.reviewed_by = userId;
      } else if (status === 'approved') {
        updates.approved_at = now;
        updates.approved_by = userId;
      } else if (status === 'finalized') {
        updates.finalized_at = now;
        updates.finalized_by = userId;
        updates.is_locked = true;
      }
      
      const { data, error } = await supabase
        .from("payout_runs")
        .update(updates)
        .eq("id", runId)
        .select()
        .single();
      
      if (error) throw error;
      return data as PayoutRun;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["payout_runs"] });
      queryClient.invalidateQueries({ queryKey: ["payout_run", data.id] });
      toast({ 
        title: "Status updated", 
        description: `Payout run moved to ${data.run_status}` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

/**
 * Delete a draft payout run
 */
export function useDeletePayoutRun() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (runId: string) => {
      // First check if it's a draft
      const { data: run } = await supabase
        .from("payout_runs")
        .select("run_status")
        .eq("id", runId)
        .single();
      
      if (run?.run_status !== 'draft') {
        throw new Error("Only draft payout runs can be deleted");
      }
      
      // Delete associated records first
      await supabase.from("monthly_payouts").delete().eq("payout_run_id", runId);
      await supabase.from("deal_variable_pay_attribution").delete().eq("payout_run_id", runId);
      
      // Delete the run
      const { error } = await supabase
        .from("payout_runs")
        .delete()
        .eq("id", runId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payout_runs"] });
      toast({ title: "Deleted", description: "Payout run has been deleted." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
