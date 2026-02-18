/**
 * Management Summary Hook
 * 
 * Aggregates payout data for executive reporting in USD.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { classifyPayoutType } from "@/lib/payoutTypes";

export interface AnnualTotals {
  vpUsd: number;
  commUsd: number;
  additionalPayUsd: number;
  releaseUsd: number;
  clawbackUsd: number;
  netUsd: number;
}

export interface QuarterlyData {
  quarter: number;
  vpUsd: number;
  commUsd: number;
  additionalPayUsd: number;
  releaseUsd: number;
  clawbackUsd: number;
  netUsd: number;
}

export interface FunctionData {
  salesFunction: string;
  headcount: number;
  vpUsd: number;
  commUsd: number;
  additionalPayUsd: number;
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
      const { data: payouts, error: payoutsError } = await supabase
        .from("monthly_payouts")
        .select("employee_id, month_year, payout_type, calculated_amount_usd, clawback_amount_usd")
        .gte("month_year", `${year}-01-01`)
        .lte("month_year", `${year}-12-31`);
      
      if (payoutsError) throw payoutsError;
      
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("id, sales_function")
        .not("sales_function", "is", null);
      
      if (empError) throw empError;
      
      const employeeFunctionMap = new Map<string, string>();
      employees?.forEach(e => {
        employeeFunctionMap.set(e.id, e.sales_function || "Unknown");
      });
      
      let totalVp = 0;
      let totalComm = 0;
      let totalAdditionalPay = 0;
      let totalRelease = 0;
      let totalClawback = 0;
      
      const quarterData: Map<number, { vp: number; comm: number; additionalPay: number; release: number; clawback: number }> = new Map([
        [1, { vp: 0, comm: 0, additionalPay: 0, release: 0, clawback: 0 }],
        [2, { vp: 0, comm: 0, additionalPay: 0, release: 0, clawback: 0 }],
        [3, { vp: 0, comm: 0, additionalPay: 0, release: 0, clawback: 0 }],
        [4, { vp: 0, comm: 0, additionalPay: 0, release: 0, clawback: 0 }],
      ]);
      
      const functionData: Map<string, { vp: number; comm: number; additionalPay: number; employees: Set<string> }> = new Map();
      
      payouts?.forEach(payout => {
        const amount = payout.calculated_amount_usd || 0;
        const clawback = payout.clawback_amount_usd || 0;
        const category = classifyPayoutType(payout.payout_type);
        
        // Annual totals
        switch (category) {
          case 'vp': totalVp += amount; break;
          case 'commission': totalComm += amount; break;
          case 'additional_pay': totalAdditionalPay += amount; break;
          case 'release': totalRelease += amount; break;
          case 'deduction': totalClawback += clawback; break;
        }
        // Also count clawback_amount_usd for non-deduction types (if any)
        if (category !== 'deduction' && clawback > 0) {
          totalClawback += clawback;
        }
        
        // Quarter breakdown
        const quarter = getQuarter(payout.month_year);
        const qData = quarterData.get(quarter)!;
        switch (category) {
          case 'vp': qData.vp += amount; break;
          case 'commission': qData.comm += amount; break;
          case 'additional_pay': qData.additionalPay += amount; break;
          case 'release': qData.release += amount; break;
          case 'deduction': qData.clawback += clawback; break;
        }
        if (category !== 'deduction' && clawback > 0) {
          qData.clawback += clawback;
        }
        
        // Function breakdown
        const salesFunction = employeeFunctionMap.get(payout.employee_id) || "Unknown";
        if (!functionData.has(salesFunction)) {
          functionData.set(salesFunction, { vp: 0, comm: 0, additionalPay: 0, employees: new Set() });
        }
        const fData = functionData.get(salesFunction)!;
        switch (category) {
          case 'vp': fData.vp += amount; break;
          case 'commission': fData.comm += amount; break;
          case 'additional_pay': fData.additionalPay += amount; break;
          case 'release':
            // Releases go back to commission bucket for function view
            fData.comm += amount; break;
        }
        fData.employees.add(payout.employee_id);
      });
      
      return {
        annualTotals: {
          vpUsd: totalVp,
          commUsd: totalComm,
          additionalPayUsd: totalAdditionalPay,
          releaseUsd: totalRelease,
          clawbackUsd: totalClawback,
          netUsd: totalVp + totalComm + totalAdditionalPay + totalRelease - totalClawback,
        },
        byQuarter: Array.from(quarterData.entries()).map(([quarter, data]) => ({
          quarter,
          vpUsd: data.vp,
          commUsd: data.comm,
          additionalPayUsd: data.additionalPay,
          releaseUsd: data.release,
          clawbackUsd: data.clawback,
          netUsd: data.vp + data.comm + data.additionalPay + data.release - data.clawback,
        })),
        byFunction: Array.from(functionData.entries()).map(([salesFunction, data]) => ({
          salesFunction,
          headcount: data.employees.size,
          vpUsd: data.vp,
          commUsd: data.comm,
          additionalPayUsd: data.additionalPay,
          avgPerHead: data.employees.size > 0 
            ? (data.vp + data.comm + data.additionalPay) / data.employees.size 
            : 0,
        })).sort((a, b) => (b.vpUsd + b.commUsd + b.additionalPayUsd) - (a.vpUsd + a.commUsd + a.additionalPayUsd)),
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
      
      const monthlyData: Map<string, { vp: number; comm: number; additionalPay: number; release: number; clawback: number }> = new Map();
      
      for (let m = 1; m <= 12; m++) {
        const key = `${year}-${m.toString().padStart(2, '0')}`;
        monthlyData.set(key, { vp: 0, comm: 0, additionalPay: 0, release: 0, clawback: 0 });
      }
      
      payouts?.forEach(payout => {
        const monthKey = payout.month_year.substring(0, 7);
        const data = monthlyData.get(monthKey);
        if (data) {
          const category = classifyPayoutType(payout.payout_type);
          switch (category) {
            case 'vp': data.vp += payout.calculated_amount_usd || 0; break;
            case 'commission': data.comm += payout.calculated_amount_usd || 0; break;
            case 'additional_pay': data.additionalPay += payout.calculated_amount_usd || 0; break;
            case 'release': data.release += payout.calculated_amount_usd || 0; break;
            case 'deduction': data.clawback += payout.clawback_amount_usd || 0; break;
          }
        }
      });
      
      return Array.from(monthlyData.entries())
        .map(([month, data]) => ({
          month,
          vpUsd: data.vp,
          commUsd: data.comm,
          additionalPayUsd: data.additionalPay,
          releaseUsd: data.release,
          clawbackUsd: data.clawback,
          netUsd: data.vp + data.comm + data.additionalPay + data.release - data.clawback,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
    },
  });
}
