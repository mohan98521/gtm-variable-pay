/**
 * Payout Statement Hook
 * 
 * Fetches detailed payout breakdown for an employee and month.
 * Uses persisted monthly_payouts data when available, falls back to live calculation.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parse } from "date-fns";

// Currency symbols are now fetched dynamically.
// This map is kept as a static fallback for server-side/non-React contexts.
// The useCurrencies hook should be preferred in components.
export const CURRENCY_SYMBOLS: Record<string, string> = {};

export interface VariablePayItem {
  metricName: string;
  target: number;
  actual: number;
  achievementPct: number;
  multiplier: number;
  grossUsd: number;
  grossLocal: number;
  paidOnBookingUsd: number;
  paidOnBookingLocal: number;
  heldForCollectionUsd: number;
  heldForCollectionLocal: number;
  heldForYearEndUsd: number;
  heldForYearEndLocal: number;
}

export interface CommissionItem {
  commissionType: string;
  dealValue: number;
  rate: number;
  grossUsd: number;
  grossLocal: number;
  isLinkedToImpl: boolean;
  paidOnBookingUsd: number;
  paidOnBookingLocal: number;
  heldForCollectionUsd: number;
  heldForCollectionLocal: number;
  heldForYearEndUsd: number;
  heldForYearEndLocal: number;
}

export interface ClawbackItem {
  dealId: string | null;
  description: string;
  amountUsd: number;
  amountLocal: number;
}

export interface PayoutSummary {
  totalPaidUsd: number;
  totalPaidLocal: number;
  vpPaidUsd: number;
  vpPaidLocal: number;
  commPaidUsd: number;
  commPaidLocal: number;
  heldCollectionUsd: number;
  heldCollectionLocal: number;
  heldYearEndUsd: number;
  heldYearEndLocal: number;
}

export interface PayoutStatementData {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  monthYear: string;
  monthLabel: string;
  localCurrency: string;
  compensationRate: number;
  marketRate: number;
  variablePayItems: VariablePayItem[];
  commissionItems: CommissionItem[];
  clawbackItems: ClawbackItem[];
  summary: PayoutSummary;
  runStatus: string | null;
  isEstimated: boolean;
}

// Helper to format currency with Indian-style grouping for INR
// Accepts an optional symbolOverride for dynamic symbol from useCurrencies hook
export function formatLocalCurrency(amount: number, currency: string, symbolOverride?: string): string {
  const symbol = symbolOverride || CURRENCY_SYMBOLS[currency] || currency + ' ';
  
  if (currency === 'INR') {
    // Indian numbering: last 3 digits, then pairs of 2
    const absValue = Math.abs(amount);
    const intPart = Math.floor(absValue);
    const sign = amount < 0 ? '-' : '';
    
    if (intPart < 1000) {
      return `${sign}${symbol}${intPart.toLocaleString()}`;
    }
    
    const lastThree = intPart % 1000;
    const rest = Math.floor(intPart / 1000);
    const restFormatted = rest.toLocaleString('en-IN');
    return `${sign}${symbol}${restFormatted},${lastThree.toString().padStart(3, '0')}`;
  }
  
  return `${symbol}${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function formatDualCurrency(
  usd: number,
  local: number,
  currency: string
): string {
  if (currency === 'USD') {
    return `$${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  const localStr = formatLocalCurrency(local, currency);
  const usdStr = `$${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `${localStr} (${usdStr})`;
}

/**
 * Fetch payout statement for current user
 */
export function usePayoutStatement(monthYear: string) {
  return useQuery({
    queryKey: ["payout_statement", "current_user", monthYear],
    queryFn: async (): Promise<PayoutStatementData | null> => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get profile with employee_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("employee_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.employee_id) return null;

      // Get employee record by employee_id code
      const { data: employee } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, local_currency, compensation_exchange_rate")
        .eq("employee_id", profile.employee_id)
        .maybeSingle();

      if (!employee) return null;

      return fetchPayoutStatementData(employee.id, monthYear, employee);
    },
    enabled: !!monthYear,
  });
}

/**
 * Fetch payout statement for a specific employee (admin view)
 */
export function usePayoutStatementForEmployee(employeeId: string | undefined, monthYear: string) {
  return useQuery({
    queryKey: ["payout_statement", employeeId, monthYear],
    queryFn: async (): Promise<PayoutStatementData | null> => {
      if (!employeeId) return null;

      // Get employee record
      const { data: employee } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, local_currency, compensation_exchange_rate")
        .eq("id", employeeId)
        .maybeSingle();

      if (!employee) return null;

      return fetchPayoutStatementData(employee.id, monthYear, employee);
    },
    enabled: !!employeeId && !!monthYear,
  });
}

interface EmployeeInfo {
  id: string;
  employee_id: string;
  full_name: string;
  local_currency: string;
  compensation_exchange_rate: number | null;
}

async function fetchPayoutStatementData(
  employeeUuid: string,
  monthYear: string,
  employee: EmployeeInfo
): Promise<PayoutStatementData> {
  const localCurrency = employee.local_currency || 'USD';
  const compensationRate = employee.compensation_exchange_rate || 1;

  // Get market rate for the month
  let marketRate = 1;
  if (localCurrency !== 'USD') {
    const { data: rateData } = await supabase
      .from("exchange_rates")
      .select("rate_to_usd")
      .eq("currency_code", localCurrency)
      .eq("month_year", monthYear.length === 7 ? monthYear + "-01" : monthYear)
      .maybeSingle();
    
    if (rateData) {
      marketRate = rateData.rate_to_usd;
    } else {
      // Fallback to latest rate
      const { data: latestRate } = await supabase
        .from("exchange_rates")
        .select("rate_to_usd")
        .eq("currency_code", localCurrency)
        .order("month_year", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (latestRate) {
        marketRate = latestRate.rate_to_usd;
      }
    }
  }

  // Check if payout run exists for this month
  const { data: payoutRun } = await supabase
    .from("payout_runs")
    .select("id, run_status")
    .eq("month_year", monthYear.length === 7 ? monthYear + "-01" : monthYear)
    .in("run_status", ["approved", "finalized", "paid"])
    .maybeSingle();

  const runStatus = payoutRun?.run_status || null;
  const isEstimated = !payoutRun;

  // Format month label
  let monthLabel = monthYear;
  try {
    const date = parse(monthYear, 'yyyy-MM', new Date());
    monthLabel = format(date, 'MMMM yyyy');
  } catch {
    // Keep original if parsing fails
  }

  // Initialize data
  let variablePayItems: VariablePayItem[] = [];
  let commissionItems: CommissionItem[] = [];
  let clawbackItems: ClawbackItem[] = [];

  if (payoutRun) {
    // Fetch from persisted monthly_payouts
    const { data: payouts } = await supabase
      .from("monthly_payouts")
      .select("*")
      .eq("payout_run_id", payoutRun.id)
      .eq("employee_id", employeeUuid);

    (payouts || []).forEach(payout => {
      if (payout.payout_type === 'Variable Pay') {
        // This is aggregated VP - in real implementation, would need to get metric-level breakdown
        variablePayItems.push({
          metricName: 'Variable Pay',
          target: 0,
          actual: 0,
          achievementPct: 0,
          multiplier: 1,
          grossUsd: payout.calculated_amount_usd || 0,
          grossLocal: payout.calculated_amount_local || 0,
          paidOnBookingUsd: payout.booking_amount_usd || 0,
          paidOnBookingLocal: payout.booking_amount_local || 0,
          heldForCollectionUsd: payout.collection_amount_usd || 0,
          heldForCollectionLocal: payout.collection_amount_local || 0,
          heldForYearEndUsd: payout.year_end_amount_usd || 0,
          heldForYearEndLocal: payout.year_end_amount_local || 0,
        });
      } else if (payout.payout_type === 'Clawback') {
        clawbackItems.push({
          dealId: payout.deal_id,
          description: payout.notes || 'Clawback - Collection not received within 180 days',
          amountUsd: Math.abs(payout.calculated_amount_usd || 0),
          amountLocal: Math.abs(payout.calculated_amount_local || 0),
        });
      } else {
        // Commission types
        commissionItems.push({
          commissionType: payout.payout_type,
          dealValue: 0, // Would need deal data
          rate: 0,
          grossUsd: payout.calculated_amount_usd || 0,
          grossLocal: payout.calculated_amount_local || 0,
          isLinkedToImpl: (payout.booking_amount_usd || 0) === 0 && (payout.collection_amount_usd || 0) > 0,
          paidOnBookingUsd: payout.booking_amount_usd || 0,
          paidOnBookingLocal: payout.booking_amount_local || 0,
          heldForCollectionUsd: payout.collection_amount_usd || 0,
          heldForCollectionLocal: payout.collection_amount_local || 0,
          heldForYearEndUsd: payout.year_end_amount_usd || 0,
          heldForYearEndLocal: payout.year_end_amount_local || 0,
        });
      }
    });
  } else {
    // No payout run - show estimated based on current data
    // This would use useCurrentUserCompensation logic
    // For now, return empty with estimated flag
  }

  // Calculate summary
  const vpPaidUsd = variablePayItems.reduce((sum, v) => sum + v.paidOnBookingUsd, 0);
  const vpPaidLocal = variablePayItems.reduce((sum, v) => sum + v.paidOnBookingLocal, 0);
  const commPaidUsd = commissionItems.reduce((sum, c) => sum + c.paidOnBookingUsd, 0);
  const commPaidLocal = commissionItems.reduce((sum, c) => sum + c.paidOnBookingLocal, 0);
  
  const heldCollectionUsd = 
    variablePayItems.reduce((sum, v) => sum + v.heldForCollectionUsd, 0) +
    commissionItems.reduce((sum, c) => sum + c.heldForCollectionUsd, 0);
  const heldCollectionLocal = 
    variablePayItems.reduce((sum, v) => sum + v.heldForCollectionLocal, 0) +
    commissionItems.reduce((sum, c) => sum + c.heldForCollectionLocal, 0);
  
  const heldYearEndUsd = 
    variablePayItems.reduce((sum, v) => sum + v.heldForYearEndUsd, 0) +
    commissionItems.reduce((sum, c) => sum + c.heldForYearEndUsd, 0);
  const heldYearEndLocal = 
    variablePayItems.reduce((sum, v) => sum + v.heldForYearEndLocal, 0) +
    commissionItems.reduce((sum, c) => sum + c.heldForYearEndLocal, 0);

  const clawbackTotalUsd = clawbackItems.reduce((sum, c) => sum + c.amountUsd, 0);
  const clawbackTotalLocal = clawbackItems.reduce((sum, c) => sum + c.amountLocal, 0);

  const summary: PayoutSummary = {
    totalPaidUsd: vpPaidUsd + commPaidUsd - clawbackTotalUsd,
    totalPaidLocal: vpPaidLocal + commPaidLocal - clawbackTotalLocal,
    vpPaidUsd,
    vpPaidLocal,
    commPaidUsd,
    commPaidLocal,
    heldCollectionUsd,
    heldCollectionLocal,
    heldYearEndUsd,
    heldYearEndLocal,
  };

  return {
    employeeId: employee.id,
    employeeName: employee.full_name,
    employeeCode: employee.employee_id,
    monthYear,
    monthLabel,
    localCurrency,
    compensationRate,
    marketRate,
    variablePayItems,
    commissionItems,
    clawbackItems,
    summary,
    runStatus,
    isEstimated,
  };
}

/**
 * Get available months for payout statements
 */
export function useAvailablePayoutMonths(year: number) {
  return useQuery({
    queryKey: ["available_payout_months", year],
    queryFn: async () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      const months: { value: string; label: string; hasRun: boolean }[] = [];
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];

      // Get payout runs for the year
      const { data: runs } = await supabase
        .from("payout_runs")
        .select("month_year, run_status")
        .gte("month_year", `${year}-01`)
        .lte("month_year", `${year}-12`);

      const runMap = new Map<string, string>();
      (runs || []).forEach(r => {
        runMap.set(r.month_year, r.run_status);
      });

      for (let m = 1; m <= 12; m++) {
        const monthValue = `${year}-${String(m).padStart(2, '0')}`;
        
        // Only include months up to current month for current year
        if (year < currentYear || (year === currentYear && m <= currentMonth)) {
          months.push({
            value: monthValue,
            label: `${monthNames[m - 1]} ${year}`,
            hasRun: runMap.has(monthValue),
          });
        }
      }

      return months.reverse(); // Most recent first
    },
  });
}
