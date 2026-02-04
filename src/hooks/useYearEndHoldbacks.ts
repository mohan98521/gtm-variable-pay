/**
 * Year-End Holdback Tracking Hook
 * 
 * Tracks accumulated year-end reserves for VP and commissions.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HoldbackSummary {
  totalHoldbackUsd: number;
  totalVpHoldbackUsd: number;
  totalCommHoldbackUsd: number;
  releaseDate: string;
}

export interface EmployeeHoldback {
  employeeId: string;
  employeeName: string;
  localCurrency: string;
  compensationRate: number;
  vpHoldbackUsd: number;
  vpHoldbackLocal: number;
  commHoldbackUsd: number;
  commHoldbackLocal: number;
  totalHoldbackUsd: number;
  totalHoldbackLocal: number;
}

export interface MonthlyHoldbackAccrual {
  month: string;
  vpHoldbackUsd: number;
  commHoldbackUsd: number;
  runningTotalUsd: number;
}

/**
 * Fetch year-end holdback summary
 */
export function useYearEndHoldbackSummary(year: number) {
  return useQuery({
    queryKey: ["year_end_holdback_summary", year],
    queryFn: async (): Promise<HoldbackSummary> => {
      const { data: payouts, error } = await supabase
        .from("monthly_payouts")
        .select("payout_type, year_end_amount_usd")
        .gte("month_year", `${year}-01-01`)
        .lte("month_year", `${year}-12-31`);
      
      if (error) throw error;
      
      let totalVpHoldback = 0;
      let totalCommHoldback = 0;
      
      payouts?.forEach(payout => {
        const amount = payout.year_end_amount_usd || 0;
        const isVp = payout.payout_type?.toLowerCase().includes('variable');
        if (isVp) {
          totalVpHoldback += amount;
        } else {
          totalCommHoldback += amount;
        }
      });
      
      return {
        totalHoldbackUsd: totalVpHoldback + totalCommHoldback,
        totalVpHoldbackUsd: totalVpHoldback,
        totalCommHoldbackUsd: totalCommHoldback,
        releaseDate: `December ${year} Payroll`,
      };
    },
  });
}

/**
 * Fetch per-employee holdback breakdown
 */
export function useEmployeeHoldbacks(year: number) {
  return useQuery({
    queryKey: ["employee_holdbacks", year],
    queryFn: async (): Promise<EmployeeHoldback[]> => {
      // Get payouts with year-end amounts
      const { data: payouts, error: payoutsError } = await supabase
        .from("monthly_payouts")
        .select("employee_id, payout_type, year_end_amount_usd, year_end_amount_local, local_currency, exchange_rate_used")
        .gte("month_year", `${year}-01-01`)
        .lte("month_year", `${year}-12-31`);
      
      if (payoutsError) throw payoutsError;
      
      // Get employee names
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("employee_id, full_name, local_currency, compensation_exchange_rate");
      
      if (empError) throw empError;
      
      const employeeMap = new Map<string, { name: string; currency: string; rate: number }>();
      employees?.forEach(e => {
        employeeMap.set(e.employee_id, {
          name: e.full_name,
          currency: e.local_currency,
          rate: e.compensation_exchange_rate || 1,
        });
      });
      
      // Aggregate by employee
      const holdbacks = new Map<string, {
        vpUsd: number;
        vpLocal: number;
        commUsd: number;
        commLocal: number;
        currency: string;
        rate: number;
      }>();
      
      payouts?.forEach(payout => {
        if (!holdbacks.has(payout.employee_id)) {
          const emp = employeeMap.get(payout.employee_id);
          holdbacks.set(payout.employee_id, {
            vpUsd: 0,
            vpLocal: 0,
            commUsd: 0,
            commLocal: 0,
            currency: emp?.currency || payout.local_currency || 'USD',
            rate: emp?.rate || payout.exchange_rate_used || 1,
          });
        }
        
        const data = holdbacks.get(payout.employee_id)!;
        const isVp = payout.payout_type?.toLowerCase().includes('variable');
        
        if (isVp) {
          data.vpUsd += payout.year_end_amount_usd || 0;
          data.vpLocal += payout.year_end_amount_local || 0;
        } else {
          data.commUsd += payout.year_end_amount_usd || 0;
          data.commLocal += payout.year_end_amount_local || 0;
        }
      });
      
      return Array.from(holdbacks.entries())
        .map(([employeeId, data]) => ({
          employeeId,
          employeeName: employeeMap.get(employeeId)?.name || employeeId,
          localCurrency: data.currency,
          compensationRate: data.rate,
          vpHoldbackUsd: data.vpUsd,
          vpHoldbackLocal: data.vpLocal,
          commHoldbackUsd: data.commUsd,
          commHoldbackLocal: data.commLocal,
          totalHoldbackUsd: data.vpUsd + data.commUsd,
          totalHoldbackLocal: data.vpLocal + data.commLocal,
        }))
        .filter(h => h.totalHoldbackUsd > 0)
        .sort((a, b) => b.totalHoldbackUsd - a.totalHoldbackUsd);
    },
  });
}

/**
 * Fetch monthly holdback accrual with running total
 */
export function useMonthlyHoldbackAccrual(year: number) {
  return useQuery({
    queryKey: ["monthly_holdback_accrual", year],
    queryFn: async (): Promise<MonthlyHoldbackAccrual[]> => {
      const { data: payouts, error } = await supabase
        .from("monthly_payouts")
        .select("month_year, payout_type, year_end_amount_usd")
        .gte("month_year", `${year}-01-01`)
        .lte("month_year", `${year}-12-31`);
      
      if (error) throw error;
      
      // Initialize months
      const monthlyData = new Map<string, { vp: number; comm: number }>();
      for (let m = 1; m <= 12; m++) {
        const key = `${year}-${m.toString().padStart(2, '0')}`;
        monthlyData.set(key, { vp: 0, comm: 0 });
      }
      
      payouts?.forEach(payout => {
        const monthKey = payout.month_year.substring(0, 7);
        const data = monthlyData.get(monthKey);
        if (data) {
          const isVp = payout.payout_type?.toLowerCase().includes('variable');
          if (isVp) {
            data.vp += payout.year_end_amount_usd || 0;
          } else {
            data.comm += payout.year_end_amount_usd || 0;
          }
        }
      });
      
      let runningTotal = 0;
      return Array.from(monthlyData.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, data]) => {
          runningTotal += data.vp + data.comm;
          return {
            month,
            vpHoldbackUsd: data.vp,
            commHoldbackUsd: data.comm,
            runningTotalUsd: runningTotal,
          };
        });
    },
  });
}
