import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PayoutMetricDetailRow {
  id: string;
  payout_run_id: string;
  employee_id: string;
  component_type: string;
  metric_name: string;
  plan_id: string | null;
  plan_name: string | null;
  target_bonus_usd: number;
  allocated_ote_usd: number;
  target_usd: number;
  actual_usd: number;
  achievement_pct: number;
  multiplier: number;
  ytd_eligible_usd: number;
  prior_paid_usd: number;
  this_month_usd: number;
  booking_usd: number;
  collection_usd: number;
  year_end_usd: number;
  commission_rate_pct: number | null;
  notes: string | null;
  created_at: string;
  // Joined employee data
  employee_name?: string;
  employee_code?: string;
  local_currency?: string;
}

export interface EmployeeWorkings {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  localCurrency: string;
  planName: string | null;
  targetBonusUsd: number;
  vpDetails: PayoutMetricDetailRow[];
  commissionDetails: PayoutMetricDetailRow[];
  otherDetails: PayoutMetricDetailRow[];
  allDetails: PayoutMetricDetailRow[];
}

export function usePayoutMetricDetails(payoutRunId: string | null) {
  return useQuery({
    queryKey: ['payout-metric-details', payoutRunId],
    queryFn: async () => {
      if (!payoutRunId) return [];

      const { data, error } = await supabase
        .from('payout_metric_details' as any)
        .select('*')
        .eq('payout_run_id', payoutRunId)
        .order('employee_id')
        .order('component_type');

      if (error) throw error;
      
      // Fetch employee names
      const employeeIds = [...new Set((data as any[]).map((d: any) => d.employee_id))];
      if (employeeIds.length === 0) return [];
      
      const { data: employees } = await supabase
        .from('employees')
        .select('id, full_name, employee_id, local_currency')
        .in('id', employeeIds);
      
      const empMap = new Map((employees || []).map(e => [e.id, e]));
      
      // Group by employee
      const grouped = new Map<string, EmployeeWorkings>();
      
      for (const row of (data as any[])) {
        const emp = empMap.get(row.employee_id);
        if (!grouped.has(row.employee_id)) {
          grouped.set(row.employee_id, {
            employeeId: row.employee_id,
            employeeName: emp?.full_name || 'Unknown',
            employeeCode: emp?.employee_id || '',
            localCurrency: emp?.local_currency || 'USD',
            planName: row.plan_name,
            targetBonusUsd: row.target_bonus_usd || 0,
            vpDetails: [],
            commissionDetails: [],
            otherDetails: [],
            allDetails: [],
          });
        }
        
        const entry = grouped.get(row.employee_id)!;
        const enrichedRow = {
          ...row,
          employee_name: emp?.full_name,
          employee_code: emp?.employee_id,
          local_currency: emp?.local_currency,
        };
        
        entry.allDetails.push(enrichedRow);
        
        if (row.component_type === 'variable_pay') {
          entry.vpDetails.push(enrichedRow);
        } else if (row.component_type === 'commission') {
          entry.commissionDetails.push(enrichedRow);
        } else {
          entry.otherDetails.push(enrichedRow);
        }
      }
      
      return Array.from(grouped.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    },
    enabled: !!payoutRunId,
  });
}
