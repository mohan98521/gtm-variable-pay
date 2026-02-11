/**
 * Unified Audit Log Hook
 * 
 * Merges deal_audit_log, payout_audit_log, and system_audit_log
 * into a single chronological timeline.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UnifiedAuditEntry {
  id: string;
  source: "deal" | "payout" | "system";
  domain: string;
  action: string;
  table_name: string;
  record_id: string | null;
  employee_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_by: string | null;
  changed_at: string;
  reason: string | null;
  is_retroactive: boolean;
  // Payout-specific
  amount_usd: number | null;
  amount_local: number | null;
  local_currency: string | null;
  is_rate_mismatch: boolean;
  compensation_rate: number | null;
  market_rate: number | null;
  rate_variance_pct: number | null;
  month_year: string | null;
  audit_category: string | null;
}

export interface UnifiedAuditFilters {
  startDate?: string;
  endDate?: string;
  domains?: string[];
  actions?: string[];
  employeeId?: string;
  changedBy?: string;
  retroactiveOnly?: boolean;
  rateMismatchOnly?: boolean;
  searchTerm?: string;
}

const DOMAIN_MAP: Record<string, string> = {
  employees: "Master Data",
  comp_plans: "Configuration",
  plan_metrics: "Configuration",
  multiplier_grids: "Configuration",
  performance_targets: "Configuration",
  exchange_rates: "Configuration",
  closing_arr_actuals: "Data Input",
  user_targets: "Configuration",
  user_roles: "Configuration",
};

const TABLE_LABELS: Record<string, string> = {
  employees: "Employees",
  comp_plans: "Comp Plans",
  plan_metrics: "Plan Metrics",
  multiplier_grids: "Multiplier Grids",
  performance_targets: "Performance Targets",
  exchange_rates: "Exchange Rates",
  closing_arr_actuals: "Closing ARR",
  user_targets: "Plan Assignments",
  user_roles: "User Roles",
};

export function getTableLabel(tableName: string): string {
  return TABLE_LABELS[tableName] || tableName.replace(/_/g, " ");
}

export function getDomainColor(domain: string): string {
  switch (domain) {
    case "Deals": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "Payouts": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "Configuration": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    case "Master Data": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    case "Data Input": return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200";
    case "Adjustments": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "Collections": return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200";
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
}

export const AUDIT_DOMAINS = [
  { value: "Deals", label: "Deals" },
  { value: "Payouts", label: "Payouts" },
  { value: "Collections", label: "Collections" },
  { value: "Adjustments", label: "Adjustments" },
  { value: "Master Data", label: "Master Data" },
  { value: "Configuration", label: "Configuration" },
  { value: "Data Input", label: "Data Input" },
];

export const AUDIT_ACTION_TYPES = [
  { value: "INSERT", label: "Created" },
  { value: "UPDATE", label: "Updated" },
  { value: "DELETE", label: "Deleted" },
  { value: "created", label: "Created (Payout)" },
  { value: "updated", label: "Updated (Payout)" },
  { value: "deleted", label: "Deleted (Payout)" },
  { value: "finalized", label: "Finalized" },
  { value: "paid", label: "Paid" },
  { value: "status_changed", label: "Status Changed" },
  { value: "rate_mismatch", label: "Rate Mismatch" },
  { value: "CREATE", label: "Deal Created" },
  { value: "adjustment_created", label: "Adjustment Created" },
  { value: "adjustment_approved", label: "Adjustment Approved" },
  { value: "adjustment_rejected", label: "Adjustment Rejected" },
];

export function useUnifiedAuditLog(filters: UnifiedAuditFilters) {
  return useQuery({
    queryKey: ["unified_audit_log", filters],
    queryFn: async () => {
      const entries: UnifiedAuditEntry[] = [];

      // 1. Fetch deal_audit_log
      {
        let q = supabase
          .from("deal_audit_log")
          .select("*")
          .order("changed_at", { ascending: false })
          .limit(500);
        if (filters.startDate) q = q.gte("changed_at", filters.startDate);
        if (filters.endDate) q = q.lte("changed_at", filters.endDate + "T23:59:59");
        if (filters.changedBy) q = q.eq("changed_by", filters.changedBy);
        if (filters.retroactiveOnly) q = q.eq("is_retroactive", true);

        const { data } = await q;
        (data || []).forEach((d) => {
          entries.push({
            id: `deal-${d.id}`,
            source: "deal",
            domain: "Deals",
            action: d.action,
            table_name: "deals",
            record_id: d.deal_id,
            employee_id: null,
            old_values: d.old_values as Record<string, unknown> | null,
            new_values: d.new_values as Record<string, unknown> | null,
            changed_by: d.changed_by,
            changed_at: d.changed_at,
            reason: d.reason,
            is_retroactive: d.is_retroactive || false,
            amount_usd: null,
            amount_local: null,
            local_currency: null,
            is_rate_mismatch: false,
            compensation_rate: null,
            market_rate: null,
            rate_variance_pct: null,
            month_year: d.period_month,
            audit_category: null,
          });
        });
      }

      // 2. Fetch payout_audit_log
      {
        let q = supabase
          .from("payout_audit_log")
          .select("*")
          .order("changed_at", { ascending: false })
          .limit(500);
        if (filters.startDate) q = q.gte("changed_at", filters.startDate);
        if (filters.endDate) q = q.lte("changed_at", filters.endDate + "T23:59:59");
        if (filters.employeeId) q = q.eq("employee_id", filters.employeeId);
        if (filters.changedBy) q = q.eq("changed_by", filters.changedBy);
        if (filters.rateMismatchOnly) q = q.eq("is_rate_mismatch", true);

        const { data } = await q;
        (data || []).forEach((d) => {
          let domain = "Payouts";
          if (d.entity_type === "collection") domain = "Collections";
          if (d.entity_type === "adjustment") domain = "Adjustments";
          if (d.entity_type === "payout_run") domain = "Payouts";

          entries.push({
            id: `payout-${d.id}`,
            source: "payout",
            domain,
            action: d.action,
            table_name: d.entity_type,
            record_id: d.payout_id || d.payout_run_id || d.deal_collection_id,
            employee_id: d.employee_id,
            old_values: d.old_values as Record<string, unknown> | null,
            new_values: d.new_values as Record<string, unknown> | null,
            changed_by: d.changed_by,
            changed_at: d.changed_at,
            reason: d.reason,
            is_retroactive: false,
            amount_usd: d.amount_usd,
            amount_local: d.amount_local,
            local_currency: d.local_currency,
            is_rate_mismatch: d.is_rate_mismatch || false,
            compensation_rate: d.compensation_rate,
            market_rate: d.market_rate,
            rate_variance_pct: d.rate_variance_pct,
            month_year: d.month_year,
            audit_category: d.audit_category,
          });
        });
      }

      // 3. Fetch system_audit_log
      {
        let q = supabase
          .from("system_audit_log")
          .select("*")
          .order("changed_at", { ascending: false })
          .limit(500);
        if (filters.startDate) q = q.gte("changed_at", filters.startDate);
        if (filters.endDate) q = q.lte("changed_at", filters.endDate + "T23:59:59");
        if (filters.changedBy) q = q.eq("changed_by", filters.changedBy);
        if (filters.retroactiveOnly) q = q.eq("is_retroactive", true);

        const { data } = await q;
        (data || []).forEach((d: any) => {
          entries.push({
            id: `system-${d.id}`,
            source: "system",
            domain: DOMAIN_MAP[d.table_name] || "System",
            action: d.action,
            table_name: d.table_name,
            record_id: d.record_id,
            employee_id: null,
            old_values: d.old_values as Record<string, unknown> | null,
            new_values: d.new_values as Record<string, unknown> | null,
            changed_by: d.changed_by,
            changed_at: d.changed_at,
            reason: d.reason,
            is_retroactive: d.is_retroactive || false,
            amount_usd: null,
            amount_local: null,
            local_currency: null,
            is_rate_mismatch: false,
            compensation_rate: null,
            market_rate: null,
            rate_variance_pct: null,
            month_year: null,
            audit_category: null,
          });
        });
      }

      // Sort all entries by changed_at DESC
      entries.sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

      // Apply client-side filters
      let filtered = entries;

      if (filters.domains && filters.domains.length > 0) {
        filtered = filtered.filter((e) => filters.domains!.includes(e.domain));
      }
      if (filters.actions && filters.actions.length > 0) {
        filtered = filtered.filter((e) => filters.actions!.includes(e.action));
      }
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        filtered = filtered.filter((e) =>
          e.action.toLowerCase().includes(term) ||
          e.table_name.toLowerCase().includes(term) ||
          e.domain.toLowerCase().includes(term) ||
          e.reason?.toLowerCase().includes(term) ||
          JSON.stringify(e.new_values)?.toLowerCase().includes(term) ||
          JSON.stringify(e.old_values)?.toLowerCase().includes(term)
        );
      }

      return filtered;
    },
  });
}

/**
 * Get summary stats from unified audit data
 */
export function useAuditSummary(entries: UnifiedAuditEntry[] | undefined) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();

  if (!entries) {
    return {
      totalEntries: 0,
      todayCount: 0,
      weekCount: 0,
      domainBreakdown: {} as Record<string, number>,
      rateMismatches: 0,
      retroactiveChanges: 0,
    };
  }

  const todayCount = entries.filter((e) => e.changed_at >= todayStart).length;
  const weekCount = entries.filter((e) => e.changed_at >= weekStart).length;
  const domainBreakdown: Record<string, number> = {};
  let rateMismatches = 0;
  let retroactiveChanges = 0;

  entries.forEach((e) => {
    domainBreakdown[e.domain] = (domainBreakdown[e.domain] || 0) + 1;
    if (e.is_rate_mismatch) rateMismatches++;
    if (e.is_retroactive) retroactiveChanges++;
  });

  return {
    totalEntries: entries.length,
    todayCount,
    weekCount,
    domainBreakdown,
    rateMismatches,
    retroactiveChanges,
  };
}
