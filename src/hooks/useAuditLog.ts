/**
 * Audit Log Hooks
 * 
 * React Query hooks for fetching and filtering audit log data.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
  id: string;
  payout_run_id: string | null;
  payout_id: string | null;
  action: string;
  entity_type: string;
  audit_category: string | null;
  employee_id: string | null;
  amount_usd: number | null;
  amount_local: number | null;
  local_currency: string | null;
  exchange_rate_used: number | null;
  compensation_rate: number | null;
  market_rate: number | null;
  rate_type: string | null;
  rate_variance_pct: number | null;
  is_rate_mismatch: boolean | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  reason: string | null;
  month_year: string | null;
  changed_by: string | null;
  changed_at: string;
  metadata: Record<string, unknown> | null;
}

export interface AuditLogFilters {
  startDate?: string;
  endDate?: string;
  category?: string[];
  employeeId?: string;
  runId?: string;
  action?: string[];
}

/**
 * Fetch audit log entries with filters
 */
export function useAuditLog(filters: AuditLogFilters) {
  return useQuery({
    queryKey: ["audit_log", filters],
    queryFn: async () => {
      let query = supabase
        .from("payout_audit_log")
        .select("*")
        .order("changed_at", { ascending: false });
      
      if (filters.startDate) {
        query = query.gte("changed_at", filters.startDate);
      }
      
      if (filters.endDate) {
        query = query.lte("changed_at", filters.endDate);
      }
      
      if (filters.category && filters.category.length > 0) {
        query = query.in("audit_category", filters.category);
      }
      
      if (filters.employeeId) {
        query = query.eq("employee_id", filters.employeeId);
      }
      
      if (filters.runId) {
        query = query.eq("payout_run_id", filters.runId);
      }
      
      if (filters.action && filters.action.length > 0) {
        query = query.in("action", filters.action);
      }
      
      const { data, error } = await query.limit(500);
      if (error) throw error;
      
      return data as AuditLogEntry[];
    },
  });
}

/**
 * Fetch audit log entries for a specific payout run
 */
export function useAuditLogByRun(runId: string | undefined) {
  return useQuery({
    queryKey: ["audit_log_by_run", runId],
    queryFn: async () => {
      if (!runId) return [];
      
      const { data, error } = await supabase
        .from("payout_audit_log")
        .select("*")
        .eq("payout_run_id", runId)
        .order("changed_at", { ascending: false });
      
      if (error) throw error;
      return data as AuditLogEntry[];
    },
    enabled: !!runId,
  });
}

/**
 * Fetch all rate mismatch warnings for a year
 */
export function useRateMismatches(year: number) {
  return useQuery({
    queryKey: ["rate_mismatches", year],
    queryFn: async () => {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      
      const { data, error } = await supabase
        .from("payout_audit_log")
        .select("*")
        .eq("is_rate_mismatch", true)
        .gte("month_year", startDate)
        .lte("month_year", endDate)
        .order("changed_at", { ascending: false });
      
      if (error) throw error;
      return data as AuditLogEntry[];
    },
  });
}

/**
 * Get unique audit categories for filtering
 */
export const AUDIT_CATEGORIES = [
  { value: "run_lifecycle", label: "Run Lifecycle" },
  { value: "calculation", label: "Calculation" },
  { value: "rate_usage", label: "Rate Usage" },
  { value: "adjustment", label: "Adjustment" },
];

/**
 * Get unique audit actions for filtering
 */
export const AUDIT_ACTIONS = [
  { value: "created", label: "Created" },
  { value: "status_changed", label: "Status Changed" },
  { value: "finalized", label: "Finalized" },
  { value: "paid", label: "Paid" },
  { value: "run_calculated", label: "Run Calculated" },
  { value: "payout_calculated", label: "Payout Calculated" },
  { value: "rate_used_compensation", label: "Comp Rate Used" },
  { value: "rate_used_market", label: "Market Rate Used" },
  { value: "rate_mismatch", label: "Rate Mismatch" },
  { value: "clawback_applied", label: "Clawback Applied" },
  { value: "adjustment_created", label: "Adjustment Created" },
  { value: "adjustment_approved", label: "Adjustment Approved" },
  { value: "adjustment_rejected", label: "Adjustment Rejected" },
  { value: "adjustment_applied", label: "Adjustment Applied" },
];
