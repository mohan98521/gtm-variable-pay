/**
 * Monthly Payouts Hooks
 * 
 * React Query hooks for accessing payout data:
 * - Payouts by run or month
 * - Employee-specific payouts
 * - Aggregated summaries
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MonthlyPayout {
  id: string;
  payout_run_id: string | null;
  employee_id: string;
  month_year: string;
  payout_type: string;
  plan_id: string | null;
  calculated_amount_usd: number;
  calculated_amount_local: number | null;
  local_currency: string | null;
  exchange_rate_used: number | null;
  exchange_rate_type: string | null;
  booking_amount_usd: number | null;
  booking_amount_local: number | null;
  collection_amount_usd: number | null;
  collection_amount_local: number | null;
  year_end_amount_usd: number | null;
  year_end_amount_local: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface MonthlyPayoutWithEmployee extends MonthlyPayout {
  employees?: {
    id: string;
    employee_id: string;
    full_name: string;
    local_currency: string;
  };
}

/**
 * Fetch payouts for a specific payout run
 */
export function useMonthlyPayouts(payoutRunId: string | undefined) {
  return useQuery({
    queryKey: ["monthly_payouts", payoutRunId],
    queryFn: async () => {
      if (!payoutRunId) return [];
      
      // Get payouts
      const { data: payouts, error: payoutsError } = await supabase
        .from("monthly_payouts")
        .select("*")
        .eq("payout_run_id", payoutRunId)
        .order("employee_id");
      
      if (payoutsError) throw payoutsError;
      if (!payouts || payouts.length === 0) return [];
      
      // Get unique employee IDs
      const employeeIds = [...new Set(payouts.map(p => p.employee_id))];
      
      // Get employee details
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, local_currency")
        .in("id", employeeIds);
      
      if (empError) throw empError;
      
      // Map employees by ID
      const employeeMap = new Map(employees?.map(e => [e.id, e]) || []);
      
      // Combine payouts with employees
      const result = payouts.map(payout => ({
        ...payout,
        employees: employeeMap.get(payout.employee_id),
      }));
      
      return result as MonthlyPayoutWithEmployee[];
    },
    enabled: !!payoutRunId,
  });
}

/**
 * Fetch payouts for a specific employee
 */
export function useEmployeePayouts(employeeId: string | undefined, year?: number) {
  return useQuery({
    queryKey: ["employee_payouts", employeeId, year],
    queryFn: async () => {
      if (!employeeId) return [];
      
      let query = supabase
        .from("monthly_payouts")
        .select("*")
        .eq("employee_id", employeeId)
        .order("month_year", { ascending: false });
      
      if (year) {
        query = query
          .gte("month_year", `${year}-01`)
          .lte("month_year", `${year}-12`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as MonthlyPayout[];
    },
    enabled: !!employeeId,
  });
}

export interface PayoutSummaryByCurrency {
  currency: string;
  totalUsd: number;
  totalLocal: number;
  variablePayUsd: number;
  variablePayLocal: number;
  commissionsUsd: number;
  commissionsLocal: number;
  employeeCount: number;
}

/**
 * Fetch aggregated payout summary by currency for a run
 */
export function usePayoutSummary(payoutRunId: string | undefined) {
  return useQuery({
    queryKey: ["payout_summary", payoutRunId],
    queryFn: async () => {
      if (!payoutRunId) return [];
      
      const { data, error } = await supabase
        .from("monthly_payouts")
        .select(`
          local_currency,
          payout_type,
          calculated_amount_usd,
          calculated_amount_local,
          employee_id
        `)
        .eq("payout_run_id", payoutRunId);
      
      if (error) throw error;
      
      // Aggregate by currency
      const byCurrency: Record<string, PayoutSummaryByCurrency> = {};
      const employeesByCurrency: Record<string, Set<string>> = {};
      
      for (const payout of data || []) {
        const currency = payout.local_currency || 'USD';
        
        if (!byCurrency[currency]) {
          byCurrency[currency] = {
            currency,
            totalUsd: 0,
            totalLocal: 0,
            variablePayUsd: 0,
            variablePayLocal: 0,
            commissionsUsd: 0,
            commissionsLocal: 0,
            employeeCount: 0,
          };
          employeesByCurrency[currency] = new Set();
        }
        
        const summary = byCurrency[currency];
        summary.totalUsd += payout.calculated_amount_usd || 0;
        summary.totalLocal += payout.calculated_amount_local || 0;
        
        if (payout.payout_type === 'Variable Pay') {
          summary.variablePayUsd += payout.calculated_amount_usd || 0;
          summary.variablePayLocal += payout.calculated_amount_local || 0;
        } else if (payout.payout_type !== 'Collection Release' && payout.payout_type !== 'Year-End Release' && payout.payout_type !== 'Clawback') {
          summary.commissionsUsd += payout.calculated_amount_usd || 0;
          summary.commissionsLocal += payout.calculated_amount_local || 0;
        }
        
        employeesByCurrency[currency].add(payout.employee_id);
      }
      
      // Set employee counts
      for (const currency of Object.keys(byCurrency)) {
        byCurrency[currency].employeeCount = employeesByCurrency[currency].size;
      }
      
      return Object.values(byCurrency);
    },
    enabled: !!payoutRunId,
  });
}

export interface EmployeePayoutSummary {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  localCurrency: string;
  variablePayUsd: number;
  variablePayLocal: number;
  vpCompRate: number;
  commissionsUsd: number;
  commissionsLocal: number;
  commMarketRate: number;
  totalUsd: number;
  totalLocal: number;
  bookingUsd: number;
  bookingLocal: number;
  // Three-way split fields
  vpBookingUsd: number;
  vpCollectionUsd: number;
  vpYearEndUsd: number;
  commBookingUsd: number;
  commCollectionUsd: number;
  commYearEndUsd: number;
  // Releases
  collectionReleasesUsd: number;
  yearEndReleasesUsd: number;
  // Computed totals
  totalEligibleUsd: number;
  totalBookingUsd: number;
  totalCollectionUsd: number;
  totalYearEndUsd: number;
  payableThisMonthUsd: number;
}

/**
 * Fetch employee-level payout breakdown for a run
 */
export function useEmployeePayoutBreakdown(payoutRunId: string | undefined) {
  return useQuery({
    queryKey: ["employee_payout_breakdown", payoutRunId],
    queryFn: async () => {
      if (!payoutRunId) return [];
      
      // Get payouts
      const { data: payouts, error: payoutsError } = await supabase
        .from("monthly_payouts")
        .select("*")
        .eq("payout_run_id", payoutRunId);
      
      if (payoutsError) throw payoutsError;
      if (!payouts || payouts.length === 0) return [];
      
      // Get unique employee IDs
      const employeeIds = [...new Set(payouts.map(p => p.employee_id))];
      
      // Get employee details
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, local_currency")
        .in("id", employeeIds);
      
      if (empError) throw empError;
      
      // Map employees by ID
      const employeeMap = new Map(employees?.map(e => [e.id, e]) || []);
      
      // Group by employee
      const byEmployee: Record<string, EmployeePayoutSummary> = {};
      
      for (const payout of payouts) {
        const emp = employeeMap.get(payout.employee_id);
        if (!emp) continue;
        
        if (!byEmployee[emp.id]) {
          byEmployee[emp.id] = {
            employeeId: emp.id,
            employeeCode: emp.employee_id,
            employeeName: emp.full_name,
            localCurrency: payout.local_currency || 'USD',
            variablePayUsd: 0,
            variablePayLocal: 0,
            vpCompRate: 1,
            commissionsUsd: 0,
            commissionsLocal: 0,
            commMarketRate: 1,
            totalUsd: 0,
            totalLocal: 0,
            bookingUsd: 0,
            bookingLocal: 0,
            vpBookingUsd: 0,
            vpCollectionUsd: 0,
            vpYearEndUsd: 0,
            commBookingUsd: 0,
            commCollectionUsd: 0,
            commYearEndUsd: 0,
            collectionReleasesUsd: 0,
            yearEndReleasesUsd: 0,
            totalEligibleUsd: 0,
            totalBookingUsd: 0,
            totalCollectionUsd: 0,
            totalYearEndUsd: 0,
            payableThisMonthUsd: 0,
          };
        }
        
        const summary = byEmployee[emp.id];
        
        if (payout.payout_type === 'Variable Pay') {
          summary.variablePayUsd += payout.calculated_amount_usd || 0;
          summary.variablePayLocal += payout.calculated_amount_local || 0;
          summary.vpCompRate = payout.exchange_rate_used || 1;
          summary.vpBookingUsd += payout.booking_amount_usd || 0;
          summary.vpCollectionUsd += payout.collection_amount_usd || 0;
          summary.vpYearEndUsd += payout.year_end_amount_usd || 0;
        } else if (payout.payout_type === 'Collection Release') {
          summary.collectionReleasesUsd += payout.calculated_amount_usd || 0;
        } else if (payout.payout_type === 'Year-End Release') {
          summary.yearEndReleasesUsd += payout.calculated_amount_usd || 0;
        } else if (payout.payout_type === 'Clawback') {
          // Clawbacks are negative, tracked separately
        } else {
          // Commission types (Managed Services, Perpetual License, etc.)
          summary.commissionsUsd += payout.calculated_amount_usd || 0;
          summary.commissionsLocal += payout.calculated_amount_local || 0;
          summary.commMarketRate = payout.exchange_rate_used || 1;
          summary.commBookingUsd += payout.booking_amount_usd || 0;
          summary.commCollectionUsd += payout.collection_amount_usd || 0;
          summary.commYearEndUsd += payout.year_end_amount_usd || 0;
        }
        
        summary.totalUsd += payout.calculated_amount_usd || 0;
        summary.totalLocal += payout.calculated_amount_local || 0;
        summary.bookingUsd += payout.booking_amount_usd || 0;
        summary.bookingLocal += payout.booking_amount_local || 0;
      }
      
      // Compute derived totals
      for (const summary of Object.values(byEmployee)) {
        summary.totalEligibleUsd = summary.variablePayUsd + summary.commissionsUsd;
        summary.totalBookingUsd = summary.vpBookingUsd + summary.commBookingUsd;
        summary.totalCollectionUsd = summary.vpCollectionUsd + summary.commCollectionUsd;
        summary.totalYearEndUsd = summary.vpYearEndUsd + summary.commYearEndUsd;
        summary.payableThisMonthUsd = summary.totalBookingUsd + summary.collectionReleasesUsd + summary.yearEndReleasesUsd;
      }
      
      return Object.values(byEmployee).sort((a, b) => 
        a.employeeName.localeCompare(b.employeeName)
      );
    },
    enabled: !!payoutRunId,
  });
}
