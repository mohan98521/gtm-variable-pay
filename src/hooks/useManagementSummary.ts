/**
 * Management Summary Hook
 * 
 * Aggregates payout data for executive reporting in USD.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AnnualTotals {
  vpUsd: number;
  commUsd: number;
  clawbackUsd: number;
  netUsd: number;
}

export interface QuarterlyData {
  quarter: number;
  vpUsd: number;
  commUsd: number;
  clawbackUsd: number;
  netUsd: number;
}

export interface FunctionData {
  salesFunction: string;
  headcount: number;
  vpUsd: number;
  commUsd: number;
  avgPerHead: number;
}

export interface ManagementSummaryData {
  annualTotals: AnnualTotals;
  byQuarter: QuarterlyData[];
  byFunction: FunctionData[];
}

function getQuarter(monthYear: string): number {
  const month = parseInt(monthYear.split('-')[1]);
  return Math.ceil(month / 3);
}

/**
 * Fetch management summary data for a fiscal year
 */
export function useManagementSummary(year: number) {
  return useQuery({
    queryKey: ["management_summary", year],
    queryFn: async (): Promise<ManagementSummaryData> => {
      // Fetch all payouts for the year
      const { data: payouts, error: payoutsError } = await supabase
        .from("monthly_payouts")
        .select("employee_id, month_year, payout_type, calculated_amount_usd, clawback_amount_usd")
        .gte("month_year", `${year}-01-01`)
        .lte("month_year", `${year}-12-31`);
      
      if (payoutsError) throw payoutsError;
      
      // Fetch employees for function grouping
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("employee_id, sales_function")
        .eq("is_active", true);
      
      if (empError) throw empError;
      
      const employeeFunctionMap = new Map<string, string>();
      employees?.forEach(e => {
        employeeFunctionMap.set(e.employee_id, e.sales_function || "Unknown");
      });
      
      // Calculate annual totals
      let totalVp = 0;
      let totalComm = 0;
      let totalClawback = 0;
      
      // Quarter aggregations
      const quarterData: Map<number, { vp: number; comm: number; clawback: number }> = new Map([
        [1, { vp: 0, comm: 0, clawback: 0 }],
        [2, { vp: 0, comm: 0, clawback: 0 }],
        [3, { vp: 0, comm: 0, clawback: 0 }],
        [4, { vp: 0, comm: 0, clawback: 0 }],
      ]);
      
      // Function aggregations
      const functionData: Map<string, { vp: number; comm: number; employees: Set<string> }> = new Map();
      
      payouts?.forEach(payout => {
        const amount = payout.calculated_amount_usd || 0;
        const clawback = payout.clawback_amount_usd || 0;
        const isVp = payout.payout_type?.toLowerCase().includes('variable');
        const isComm = payout.payout_type?.toLowerCase().includes('commission');
        
        // Annual totals
        if (isVp) totalVp += amount;
        if (isComm) totalComm += amount;
        totalClawback += clawback;
        
        // Quarter breakdown
        const quarter = getQuarter(payout.month_year);
        const qData = quarterData.get(quarter)!;
        if (isVp) qData.vp += amount;
        if (isComm) qData.comm += amount;
        qData.clawback += clawback;
        
        // Function breakdown
        const salesFunction = employeeFunctionMap.get(payout.employee_id) || "Unknown";
        if (!functionData.has(salesFunction)) {
          functionData.set(salesFunction, { vp: 0, comm: 0, employees: new Set() });
        }
        const fData = functionData.get(salesFunction)!;
        if (isVp) fData.vp += amount;
        if (isComm) fData.comm += amount;
        fData.employees.add(payout.employee_id);
      });
      
      return {
        annualTotals: {
          vpUsd: totalVp,
          commUsd: totalComm,
          clawbackUsd: totalClawback,
          netUsd: totalVp + totalComm - totalClawback,
        },
        byQuarter: Array.from(quarterData.entries()).map(([quarter, data]) => ({
          quarter,
          vpUsd: data.vp,
          commUsd: data.comm,
          clawbackUsd: data.clawback,
          netUsd: data.vp + data.comm - data.clawback,
        })),
        byFunction: Array.from(functionData.entries()).map(([salesFunction, data]) => ({
          salesFunction,
          headcount: data.employees.size,
          vpUsd: data.vp,
          commUsd: data.comm,
          avgPerHead: data.employees.size > 0 
            ? (data.vp + data.comm) / data.employees.size 
            : 0,
        })).sort((a, b) => b.vpUsd + b.commUsd - (a.vpUsd + a.commUsd)),
      };
    },
  });
}

/**
 * Fetch monthly breakdown for trend analysis
 */
export function useManagementSummaryByMonth(year: number) {
  return useQuery({
    queryKey: ["management_summary_monthly", year],
    queryFn: async () => {
      const { data: payouts, error } = await supabase
        .from("monthly_payouts")
        .select("month_year, payout_type, calculated_amount_usd, clawback_amount_usd")
        .gte("month_year", `${year}-01-01`)
        .lte("month_year", `${year}-12-31`);
      
      if (error) throw error;
      
      const monthlyData: Map<string, { vp: number; comm: number; clawback: number }> = new Map();
      
      // Initialize all months
      for (let m = 1; m <= 12; m++) {
        const key = `${year}-${m.toString().padStart(2, '0')}`;
        monthlyData.set(key, { vp: 0, comm: 0, clawback: 0 });
      }
      
      payouts?.forEach(payout => {
        const monthKey = payout.month_year.substring(0, 7);
        const data = monthlyData.get(monthKey);
        if (data) {
          const isVp = payout.payout_type?.toLowerCase().includes('variable');
          const isComm = payout.payout_type?.toLowerCase().includes('commission');
          if (isVp) data.vp += payout.calculated_amount_usd || 0;
          if (isComm) data.comm += payout.calculated_amount_usd || 0;
          data.clawback += payout.clawback_amount_usd || 0;
        }
      });
      
      return Array.from(monthlyData.entries())
        .map(([month, data]) => ({
          month,
          vpUsd: data.vp,
          commUsd: data.comm,
          clawbackUsd: data.clawback,
          netUsd: data.vp + data.comm - data.clawback,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
    },
  });
}
