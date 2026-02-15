import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PayoutDealDetailRow {
  id: string;
  payout_run_id: string;
  employee_id: string;
  deal_id: string;
  project_id: string | null;
  customer_name: string | null;
  commission_type: string;
  deal_value_usd: number;
  gp_margin_pct: number | null;
  min_gp_margin_pct: number | null;
  commission_rate_pct: number;
  is_eligible: boolean;
  exclusion_reason: string | null;
  gross_commission_usd: number;
  booking_usd: number;
  collection_usd: number;
  year_end_usd: number;
  created_at: string;
  // Joined
  employee_name?: string;
  employee_code?: string;
}

export function usePayoutDealDetails(payoutRunId: string | null) {
  return useQuery({
    queryKey: ['payout-deal-details', payoutRunId],
    queryFn: async () => {
      if (!payoutRunId) return [];

      const { data, error } = await supabase
        .from('payout_deal_details' as any)
        .select('*')
        .eq('payout_run_id', payoutRunId)
        .order('employee_id')
        .order('commission_type');

      if (error) throw error;

      const employeeIds = [...new Set((data as any[]).map((d: any) => d.employee_id))];
      if (employeeIds.length === 0) return [];

      const { data: employees } = await supabase
        .from('employees')
        .select('id, full_name, employee_id')
        .in('id', employeeIds);

      const empMap = new Map((employees || []).map(e => [e.id, e]));

      return (data as any[]).map(row => {
        const emp = empMap.get(row.employee_id);
        return {
          ...row,
          employee_name: emp?.full_name || 'Unknown',
          employee_code: emp?.employee_id || '',
        } as PayoutDealDetailRow;
      });
    },
    enabled: !!payoutRunId,
  });
}
