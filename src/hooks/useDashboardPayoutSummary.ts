/**
 * Dashboard Payout Summary Hook
 * 
 * Sources summary card values from the monthly_payouts table (payout run results)
 * instead of independent calculation, ensuring single source of truth.
 * Falls back to useCurrentUserCompensation when no payout data exists.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";

export interface AssignmentSegment {
  planName: string;
  startDate: string;
  endDate: string;
  targetBonusUsd: number | null;
  oteUsd: number | null;
}

export interface DashboardPayoutSummary {
  totalEligible: number;
  totalPaid: number;        // booking_amount_usd (Upon Booking)
  totalHoldingCollection: number;  // collection_amount_usd
  totalHoldingYearEnd: number;     // year_end_amount_usd
  totalHolding: number;     // collection + year_end
  totalCommission: number;  // non-VP payout types
  totalVariablePay: number; // VP payout type
  isFromPayoutRun: boolean;
  monthsCovered: number;
  assignmentSegments: AssignmentSegment[];
}

export function useDashboardPayoutSummary() {
  const { selectedYear } = useFiscalYear();

  return useQuery({
    queryKey: ["dashboard_payout_summary", selectedYear],
    queryFn: async () => {
      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // 2. Get employee_id from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("employee_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.employee_id) return null;

      // 3. Get employee UUID from employees table
      const { data: employee } = await supabase
        .from("employees")
        .select("id")
        .eq("employee_id", profile.employee_id)
        .maybeSingle();

      if (!employee) return null;

      // 4. Fetch user_targets for this employee in the fiscal year to get assignment segments
      const { data: targets } = await supabase
        .from("user_targets")
        .select("plan_id, effective_start_date, effective_end_date, target_bonus_usd, ote_usd")
        .eq("user_id", employee.id)
        .lte("effective_start_date", `${selectedYear}-12-31`)
        .gte("effective_end_date", `${selectedYear}-01-01`)
        .order("effective_start_date", { ascending: true });

      // Resolve plan names for segments
      let assignmentSegments: AssignmentSegment[] = [];
      if (targets && targets.length > 0) {
        const planIds = [...new Set(targets.map(t => t.plan_id).filter(Boolean))] as string[];
        const planNameMap = new Map<string, string>();
        if (planIds.length > 0) {
          const { data: plans } = await supabase
            .from("comp_plans")
            .select("id, name")
            .in("id", planIds);
          (plans || []).forEach(p => planNameMap.set(p.id, p.name));
        }
        assignmentSegments = targets.map(t => ({
          planName: planNameMap.get(t.plan_id) || 'Unknown Plan',
          startDate: t.effective_start_date,
          endDate: t.effective_end_date,
          targetBonusUsd: t.target_bonus_usd,
          oteUsd: t.ote_usd,
        }));
      }

      // 5. Fetch all monthly_payouts for this employee in the fiscal year
      const { data: payouts, error } = await supabase
        .from("monthly_payouts")
        .select("payout_type, calculated_amount_usd, booking_amount_usd, collection_amount_usd, year_end_amount_usd, month_year")
        .eq("employee_id", employee.id)
        .gte("month_year", `${selectedYear}-01`)
        .lte("month_year", `${selectedYear}-12`);

      if (error) throw error;

      if (!payouts || payouts.length === 0) {
        return {
          totalEligible: 0,
          totalPaid: 0,
          totalHoldingCollection: 0,
          totalHoldingYearEnd: 0,
          totalHolding: 0,
          totalCommission: 0,
          totalVariablePay: 0,
          isFromPayoutRun: false,
          monthsCovered: 0,
          assignmentSegments,
        } as DashboardPayoutSummary;
      }

      // 5. Aggregate
      let totalVariablePay = 0;
      let totalCommission = 0;
      let totalPaid = 0;
      let totalHoldingCollection = 0;
      let totalHoldingYearEnd = 0;
      const monthsSet = new Set<string>();

      for (const p of payouts) {
        // Skip release and clawback types from eligible totals
        if (p.payout_type === 'Collection Release' || p.payout_type === 'Year-End Release' || p.payout_type === 'Clawback') {
          continue;
        }

        if (p.payout_type === 'Variable Pay') {
          totalVariablePay += p.calculated_amount_usd || 0;
        } else {
          totalCommission += p.calculated_amount_usd || 0;
        }

        totalPaid += p.booking_amount_usd || 0;
        totalHoldingCollection += p.collection_amount_usd || 0;
        totalHoldingYearEnd += p.year_end_amount_usd || 0;
        monthsSet.add(p.month_year);
      }

      return {
        totalEligible: totalVariablePay + totalCommission,
        totalPaid,
        totalHoldingCollection,
        totalHoldingYearEnd,
        totalHolding: totalHoldingCollection + totalHoldingYearEnd,
        totalCommission,
        totalVariablePay,
        isFromPayoutRun: true,
        monthsCovered: monthsSet.size,
        assignmentSegments,
      } as DashboardPayoutSummary;
    },
  });
}
