import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClosingArrPayoutDetailRow {
  id: string;
  payout_run_id: string;
  employee_id: string;
  closing_arr_actual_id: string;
  pid: string;
  customer_name: string | null;
  customer_code: string | null;
  bu: string | null;
  product: string | null;
  month_year: string | null;
  end_date: string | null;
  is_multi_year: boolean;
  renewal_years: number;
  closing_arr_usd: number;
  multiplier: number;
  adjusted_arr_usd: number;
  is_eligible: boolean;
  exclusion_reason: string | null;
  order_category_2: string | null;
  created_at: string;
  // Joined
  employee_name?: string;
  employee_code?: string;
}

export function useClosingArrPayoutDetails(payoutRunId: string | null) {
  return useQuery({
    queryKey: ['closing-arr-payout-details', payoutRunId],
    queryFn: async () => {
      if (!payoutRunId) return [];

      const { data, error } = await supabase
        .from('closing_arr_payout_details' as any)
        .select('*')
        .eq('payout_run_id', payoutRunId)
        .order('employee_id')
        .order('pid');

      if (error) throw error;

      const employeeIds = [...new Set((data as any[]).map((d: any) => d.employee_id))];
      if (employeeIds.length === 0) return [];

      const { data: employees } = await supabase
        .from('employees')
        .select('id, full_name, employee_id')
        .in('employee_id', employeeIds);

      const empMap = new Map((employees || []).map(e => [e.employee_id, e]));

      return (data as any[]).map(row => {
        const emp = empMap.get(row.employee_id);
        return {
          ...row,
          employee_name: emp?.full_name || 'Unknown',
          employee_code: emp?.employee_id || row.employee_id,
        } as ClosingArrPayoutDetailRow;
      });
    },
    enabled: !!payoutRunId,
  });
}
