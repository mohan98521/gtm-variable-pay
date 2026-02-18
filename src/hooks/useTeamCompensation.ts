import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { getMultiplierFromGrid, calculateAchievementPercent } from "@/lib/compensationEngine";
import { PlanMetric } from "./usePlanMetrics";
import { MetricCompensation, CommissionCompensation } from "./useCurrentUserCompensation";
import { calculateNRRPayout, NRRCalculationResult } from "@/lib/nrrCalculation";
import { calculateAllSpiffs, SpiffAggregateResult } from "@/lib/spiffCalculation";

// Map employee sales_function to plan name (shared with useCurrentUserCompensation)
const SALES_FUNCTION_TO_PLAN: Record<string, string> = {
  "Farming": "Farmer",
  "Hunting": "Hunter",
  "Farmer": "Farmer",
  "Hunter": "Hunter",
  "Farmer - Retain": "Farmer Retain",
  "Sales Head - Farmer": "Sales Head Farmer",
  "Sales Head - Hunter": "Sales Head Hunter",
  "CSM": "CSM",
  "Sales Engineering": "Sales Engineering",
  "SE": "Sales Engineering",
  "Solution Architect": "Product Specialist or Solution Architect",
  "Solution Manager": "Product Specialist or Solution Architect",
  "Team Lead": "Team Lead",
  "Team Lead - Farmer": "Team Lead",
  "Team Lead - Hunter": "Team Lead",
  "Overlay": "Overlay",
  "Executive": "Executive",
};

const PARTICIPANT_ROLES = [
  'sales_rep_employee_id',
  'sales_head_employee_id',
  'sales_engineering_employee_id',
  'sales_engineering_head_employee_id',
  'product_specialist_employee_id',
  'product_specialist_head_employee_id',
  'solution_manager_employee_id',
  'solution_manager_head_employee_id',
  'solution_architect_employee_id',
] as const;

export interface TeamMemberCompensation {
  employeeId: string;
  employeeName: string;
  designation: string | null;
  salesFunction: string | null;
  planName: string;
  targetBonusUsd: number;
  metrics: MetricCompensation[];
  commissions: CommissionCompensation[];
  totalEligiblePayout: number;
  totalPaid: number;
  totalHoldback: number;
  totalYearEndHoldback: number;
  totalCommissionPayout: number;
  totalCommissionPaid: number;
  totalCommissionHoldback: number;
  totalCommissionYearEndHoldback: number;
  overallAchievementPct: number;
  status: "on-track" | "at-risk" | "behind";
  nrrResult: NRRCalculationResult | null;
  nrrOtePct: number;
  spiffResult: SpiffAggregateResult | null;
  clawbackAmount: number;
}

export interface TeamCompensationResult {
  members: TeamMemberCompensation[];
  teamMemberCount: number;
  teamTotalTvp: number;
  teamWeightedAchievement: number;
  teamTotalEligible: number;
  teamTotalPaid: number;
}

function getStatus(pct: number): "on-track" | "at-risk" | "behind" {
  if (pct >= 90) return "on-track";
  if (pct >= 70) return "at-risk";
  return "behind";
}

/**
 * Calculate compensation for all direct reports of the logged-in manager.
 * Mirrors the logic in useCurrentUserCompensation but for multiple employees.
 */
export function useTeamCompensation() {
  const { selectedYear } = useFiscalYear();

  return useQuery({
    queryKey: ["team_compensation", selectedYear],
    queryFn: async (): Promise<TeamCompensationResult | null> => {
      // 1. Get current user and their employee_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("employee_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.employee_id) return null;

      const managerEmployeeId = profile.employee_id;

      // 2. Get all active direct reports
      const { data: directReports } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, designation, sales_function, tvp_usd, local_currency")
        .eq("manager_employee_id", managerEmployeeId)
        .eq("is_active", true)
        .order("full_name");

      if (!directReports || directReports.length === 0) {
        return {
          members: [],
          teamMemberCount: 0,
          teamTotalTvp: 0,
          teamWeightedAchievement: 0,
          teamTotalEligible: 0,
          teamTotalPaid: 0,
        };
      }

      const employeeIds = directReports.map(e => e.employee_id);

      // 3. Batch fetch all needed data
      const fiscalYearStart = `${selectedYear}-01-01`;
      const fiscalYearEnd = `${selectedYear}-12-31`;

      // Fetch performance targets for all reports
      const { data: allTargets } = await supabase
        .from("performance_targets")
        .select("employee_id, metric_type, target_value_usd")
        .in("employee_id", employeeIds)
        .eq("effective_year", selectedYear);

      // Fetch all comp plans for the year (include NRR and GP margin fields)
      const { data: allPlans } = await supabase
        .from("comp_plans")
        .select("id, name, nrr_ote_percent, cr_er_min_gp_margin_pct, impl_min_gp_margin_pct, nrr_payout_on_booking_pct, nrr_payout_on_collection_pct, nrr_payout_on_year_end_pct")
        .eq("effective_year", selectedYear);

      // Build plan lookup
      const planByName = new Map<string, typeof allPlans extends (infer T)[] | null ? T : never>();
      (allPlans || []).forEach(p => planByName.set(p.name, p));

      // Collect all plan IDs we'll need
      const neededPlanIds = new Set<string>();
      directReports.forEach(emp => {
        const sf = emp.sales_function || "";
        const planName = SALES_FUNCTION_TO_PLAN[sf] || sf;
        const plan = planByName.get(planName);
        if (plan) neededPlanIds.add(plan.id);
      });

      // Fetch all plan metrics + grids for needed plans
      let allPlanMetrics: PlanMetric[] = [];
      if (neededPlanIds.size > 0) {
        const { data: metrics } = await supabase
          .from("plan_metrics")
          .select("*")
          .in("plan_id", Array.from(neededPlanIds))
          .order("metric_name");

        if (metrics && metrics.length > 0) {
          const metricIds = metrics.map(m => m.id);
          const { data: grids } = await supabase
            .from("multiplier_grids")
            .select("*")
            .in("plan_metric_id", metricIds)
            .order("min_pct");

          allPlanMetrics = metrics.map(m => ({
            ...m,
            multiplier_grids: (grids || []).filter(g => g.plan_metric_id === m.id),
          }));
        }
      }

      // Fetch all plan commissions for needed plans (include GP margin threshold)
      let allPlanCommissions: Array<{
        plan_id: string;
        commission_type: string;
        commission_rate_pct: number;
        min_threshold_usd: number | null;
        min_gp_margin_pct: number | null;
        payout_on_booking_pct: number | null;
        payout_on_collection_pct: number | null;
        payout_on_year_end_pct: number | null;
      }> = [];

      if (neededPlanIds.size > 0) {
        const { data: commissions } = await supabase
          .from("plan_commissions")
          .select("plan_id, commission_type, commission_rate_pct, min_threshold_usd, min_gp_margin_pct, payout_on_booking_pct, payout_on_collection_pct, payout_on_year_end_pct")
          .in("plan_id", Array.from(neededPlanIds))
          .eq("is_active", true);
        allPlanCommissions = commissions || [];
      }

      // Fetch plan spiffs for needed plans
      let allPlanSpiffs: Array<{
        id: string;
        plan_id: string;
        spiff_name: string;
        linked_metric_name: string;
        spiff_rate_pct: number;
        min_deal_value_usd: number | null;
        is_active: boolean;
      }> = [];

      if (neededPlanIds.size > 0) {
        const { data: spiffs } = await supabase
          .from("plan_spiffs")
          .select("id, plan_id, spiff_name, linked_metric_name, spiff_rate_pct, min_deal_value_usd, is_active")
          .in("plan_id", Array.from(neededPlanIds))
          .eq("is_active", true);
        allPlanSpiffs = spiffs || [];
      }

      // Fetch all deals for the fiscal year (include id, gp_margin, project_id, customer_name for NRR/SPIFF/GP gating)
      const { data: deals } = await supabase
        .from("deals")
        .select(`
          id,
          month_year,
          new_software_booking_arr_usd,
          managed_services_usd,
          perpetual_license_usd,
          cr_usd,
          er_usd,
          implementation_usd,
          gp_margin_percent,
          project_id,
          customer_name,
          sales_rep_employee_id,
          sales_head_employee_id,
          sales_engineering_employee_id,
          sales_engineering_head_employee_id,
          product_specialist_employee_id,
          product_specialist_head_employee_id,
          solution_manager_employee_id,
          solution_manager_head_employee_id,
          solution_architect_employee_id
        `)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd);

      // Fetch clawback ledger for all team members
      // clawback_ledger.employee_id references employees.id (UUID)
      const employeeUuids = directReports.map(e => e.id).filter(Boolean);
      const uuidToEmployeeId = new Map<string, string>();
      directReports.forEach(e => uuidToEmployeeId.set(e.id, e.employee_id));

      let allClawbacks: Array<{ employee_id: string; remaining_amount_usd: number | null }> = [];
      if (employeeUuids.length > 0) {
        const { data: clawbacks } = await supabase
          .from("clawback_ledger")
          .select("employee_id, remaining_amount_usd, status")
          .in("employee_id", employeeUuids)
          .in("status", ["pending", "partial"]);
        allClawbacks = (clawbacks || []).map(c => ({
          employee_id: uuidToEmployeeId.get(c.employee_id) || c.employee_id,
          remaining_amount_usd: c.remaining_amount_usd,
        }));
      }

      // Fetch closing ARR actuals
      // Build OR filter for all employee IDs
      const closingArrFilters = employeeIds.map(id => 
        `sales_rep_employee_id.eq.${id},sales_head_employee_id.eq.${id}`
      ).join(",");

      const { data: closingArr } = await supabase
        .from("closing_arr_actuals")
        .select("month_year, closing_arr, end_date, sales_rep_employee_id, sales_head_employee_id")
        .or(closingArrFilters)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd)
        .gt("end_date", `${selectedYear}-12-31`);

      // 4. Calculate compensation for each direct report
      const members: TeamMemberCompensation[] = await Promise.all(directReports.map(async (emp) => {
        const employeeId = emp.employee_id;
        const salesFunction = emp.sales_function || "";
        const planName = SALES_FUNCTION_TO_PLAN[salesFunction] || salesFunction;
        const plan = planByName.get(planName);
        const planId = plan?.id;
        const resolvedPlanName = plan?.name || planName || "No Plan";

        // Target map
        const targetMap = new Map<string, number>();
        (allTargets || []).filter(t => t.employee_id === employeeId)
          .forEach(t => targetMap.set(t.metric_type, t.target_value_usd));

        // Plan metrics for this employee's plan
        const planMetrics = planId
          ? allPlanMetrics.filter(m => m.plan_id === planId)
          : [];

        // Plan commissions
        const planCommissions = planId
          ? allPlanCommissions.filter(c => c.plan_id === planId)
          : [];

        // Check for team and org metrics
        const hasTeamMetrics = planMetrics.some(pm => pm.metric_name.startsWith("Team "));
        const hasOrgMetrics = planMetrics.some(pm => pm.metric_name.startsWith("Org "));
        const isTeamLead = salesFunction.startsWith("Team Lead");

        // Fetch sub-reports if this employee is a Team Lead with team metrics
        let subReportIds: string[] = [];
        if (hasTeamMetrics) {
          const { data: subReports } = await supabase
            .from("employees")
            .select("employee_id")
            .eq("manager_employee_id", employeeId)
            .eq("is_active", true);
          subReportIds = (subReports || []).map(e => e.employee_id);
        }

        // Aggregate deal actuals and collect employee-specific deals for NRR/SPIFF
        let newBookingYtd = 0;
        let managedServicesYtd = 0;
        let perpetualLicenseYtd = 0;
        let crErYtd = 0;
        let implementationYtd = 0;
        let teamNewBookingYtd = 0;
        let orgNewBookingYtd = 0;
        const employeeDeals: typeof deals = [];

        (deals || []).forEach((deal: any) => {
          const isParticipant = PARTICIPANT_ROLES.some(role => deal[role] === employeeId);
          if (isParticipant) {
            newBookingYtd += deal.new_software_booking_arr_usd || 0;
            managedServicesYtd += deal.managed_services_usd || 0;
            perpetualLicenseYtd += deal.perpetual_license_usd || 0;
            crErYtd += (deal.cr_usd || 0) + (deal.er_usd || 0);
            implementationYtd += deal.implementation_usd || 0;
            employeeDeals.push(deal);
          }
          // Team metrics: aggregate subordinate deals
          if (hasTeamMetrics && subReportIds.length > 0) {
            const isSubordinateDeal = subReportIds.includes(deal.sales_rep_employee_id);
            if (isSubordinateDeal) {
              teamNewBookingYtd += deal.new_software_booking_arr_usd || 0;
            }
          }
          // Org metrics: sum ALL deals without any filter
          if (hasOrgMetrics) {
            orgNewBookingYtd += deal.new_software_booking_arr_usd || 0;
          }
        });

        // Closing ARR - latest month snapshot
        // For Team Leads: include sub-reports' closing ARR for combined portfolio
        const closingByMonth = new Map<string, number>();
        (closingArr || []).forEach(arr => {
          const isMatch = arr.sales_rep_employee_id === employeeId ||
                          arr.sales_head_employee_id === employeeId;
          const isSubReportMatch = isTeamLead && hasTeamMetrics && subReportIds.length > 0 && (
            subReportIds.includes(arr.sales_rep_employee_id || "") ||
            subReportIds.includes(arr.sales_head_employee_id || "")
          );
          if (isMatch || isSubReportMatch) {
            const monthKey = arr.month_year?.substring(0, 7) || "";
            closingByMonth.set(monthKey, (closingByMonth.get(monthKey) || 0) + (arr.closing_arr || 0));
          }
        });
        const sortedClosingMonths = Array.from(closingByMonth.keys()).sort();
        const latestClosingMonth = sortedClosingMonths[sortedClosingMonths.length - 1];
        const closingYtd = latestClosingMonth ? closingByMonth.get(latestClosingMonth) || 0 : 0;

        // Actuals map (includes team and org metrics)
        const actualsMap = new Map<string, number>([
          ["New Software Booking ARR", newBookingYtd],
          ["Closing ARR", closingYtd],
          ["Team New Software Booking ARR", teamNewBookingYtd],
          ["Org New Software Booking ARR", orgNewBookingYtd],
        ]);

        const targetBonusUsd = emp.tvp_usd || 0;

        // Calculate metrics
        const metrics: MetricCompensation[] = [];
        if (planMetrics.length > 0) {
          planMetrics.forEach(pm => {
            const targetValue = targetMap.get(pm.metric_name) || 0;
            const actualValue = actualsMap.get(pm.metric_name) || 0;
            const achievementPct = calculateAchievementPercent(actualValue, targetValue);
            const allocation = (targetBonusUsd * pm.weightage_percent) / 100;
            const multiplier = getMultiplierFromGrid(achievementPct, pm);
            const isGated = pm.logic_type === "Gated_Threshold";
            const belowGate = isGated && pm.gate_threshold_percent && achievementPct <= pm.gate_threshold_percent;
            const eligiblePayout = belowGate ? 0 : (achievementPct / 100) * allocation * multiplier;

            const payoutOnBookingPct = pm.payout_on_booking_pct ?? 70;
            const payoutOnCollectionPct = pm.payout_on_collection_pct ?? 25;
            const payoutOnYearEndPct = pm.payout_on_year_end_pct ?? 5;

            metrics.push({
              metricName: pm.metric_name,
              targetValue,
              actualValue,
              achievementPct,
              weightagePercent: pm.weightage_percent,
              allocation,
              multiplier,
              eligiblePayout,
              amountPaid: eligiblePayout * (payoutOnBookingPct / 100),
              holdback: eligiblePayout * (payoutOnCollectionPct / 100),
              yearEndHoldback: eligiblePayout * (payoutOnYearEndPct / 100),
              logicType: pm.logic_type,
              gateThreshold: pm.gate_threshold_percent,
              multiplierGrids: pm.multiplier_grids || [],
              payoutOnBookingPct,
              payoutOnCollectionPct,
              payoutOnYearEndPct,
            });
          });
        }

        // Commission calculations
        // Commission calculations with GP margin gating
        const commissions: CommissionCompensation[] = planCommissions.map(pc => {
          // For commissions with GP margin requirement, filter deals by margin
          let eligibleDealValue = 0;
          const commissionTypeToField: Record<string, string> = {
            "Managed Services": "managed_services_usd",
            "CR/ER": "_cr_er",
            "Implementation": "implementation_usd",
            "Perpetual License": "perpetual_license_usd",
          };
          const field = commissionTypeToField[pc.commission_type];

          if (pc.min_gp_margin_pct && pc.min_gp_margin_pct > 0) {
            // Filter by GP margin
            (employeeDeals || []).forEach((deal: any) => {
              const gpMargin = deal.gp_margin_percent;
              if (gpMargin != null && gpMargin >= (pc.min_gp_margin_pct || 0)) {
                if (field === "_cr_er") {
                  eligibleDealValue += (deal.cr_usd || 0) + (deal.er_usd || 0);
                } else if (field) {
                  eligibleDealValue += deal[field] || 0;
                }
              }
            });
          } else {
            // No GP margin gating, use aggregate
            const commissionActualsMap: Record<string, number> = {
              "Managed Services": managedServicesYtd,
              "Perpetual License": perpetualLicenseYtd,
              "CR/ER": crErYtd,
              "Implementation": implementationYtd,
            };
            eligibleDealValue = commissionActualsMap[pc.commission_type] || 0;
          }

          const rate = pc.commission_rate_pct / 100;
          const meetsThreshold = !pc.min_threshold_usd || eligibleDealValue >= pc.min_threshold_usd;
          const grossPayout = meetsThreshold ? eligibleDealValue * rate : 0;
          const payoutOnBookingPct = pc.payout_on_booking_pct ?? 70;
          const payoutOnCollectionPct = pc.payout_on_collection_pct ?? 25;
          const payoutOnYearEndPct = pc.payout_on_year_end_pct ?? 5;

          return {
            commissionType: pc.commission_type,
            dealValue: eligibleDealValue,
            rate: pc.commission_rate_pct,
            minThreshold: pc.min_threshold_usd,
            grossPayout,
            amountPaid: grossPayout * (payoutOnBookingPct / 100),
            holdback: grossPayout * (payoutOnCollectionPct / 100),
            yearEndHoldback: grossPayout * (payoutOnYearEndPct / 100),
            payoutOnBookingPct,
            payoutOnCollectionPct,
            payoutOnYearEndPct,
          };
        });

        // NRR calculation
        let nrrResult: NRRCalculationResult | null = null;
        const nrrOtePct = plan?.nrr_ote_percent || 0;
        if (plan && nrrOtePct > 0) {
          const crErTarget = targetMap.get("CR/ER") || 0;
          const implTarget = targetMap.get("Implementation") || 0;
          const nrrDeals = (employeeDeals || []).map((d: any) => ({
            id: d.id,
            cr_usd: d.cr_usd,
            er_usd: d.er_usd,
            implementation_usd: d.implementation_usd,
            gp_margin_percent: d.gp_margin_percent,
          }));
          nrrResult = calculateNRRPayout(
            nrrDeals,
            crErTarget,
            implTarget,
            nrrOtePct,
            targetBonusUsd,
            plan.cr_er_min_gp_margin_pct || 0,
            plan.impl_min_gp_margin_pct || 0
          );
        }

        // SPIFF calculation
        let spiffResult: SpiffAggregateResult | null = null;
        const empPlanSpiffs = planId ? allPlanSpiffs.filter(s => s.plan_id === planId) : [];
        if (empPlanSpiffs.length > 0) {
          const spiffDeals = (employeeDeals || []).map((d: any) => ({
            id: d.id,
            new_software_booking_arr_usd: d.new_software_booking_arr_usd,
            project_id: d.project_id,
            customer_name: d.customer_name,
          }));
          const spiffMetrics = planMetrics.map(pm => ({
            metric_name: pm.metric_name,
            weightage_percent: pm.weightage_percent,
          }));
          const targetsByMetric: Record<string, number> = {};
          targetMap.forEach((v, k) => { targetsByMetric[k] = v; });
          spiffResult = calculateAllSpiffs(empPlanSpiffs, spiffDeals, spiffMetrics, targetBonusUsd, targetsByMetric);
        }

        // Clawback amount
        const clawbackAmount = allClawbacks
          .filter(c => c.employee_id === employeeId)
          .reduce((sum, c) => sum + (c.remaining_amount_usd || 0), 0);

        // Totals
        const totalEligiblePayout = metrics.reduce((s, m) => s + m.eligiblePayout, 0);
        const totalPaid = metrics.reduce((s, m) => s + m.amountPaid, 0);
        const totalHoldback = metrics.reduce((s, m) => s + m.holdback, 0);
        const totalYearEndHoldback = metrics.reduce((s, m) => s + m.yearEndHoldback, 0);
        const totalCommissionPayout = commissions.reduce((s, c) => s + c.grossPayout, 0);
        const totalCommissionPaid = commissions.reduce((s, c) => s + c.amountPaid, 0);
        const totalCommissionHoldback = commissions.reduce((s, c) => s + c.holdback, 0);
        const totalCommissionYearEndHoldback = commissions.reduce((s, c) => s + c.yearEndHoldback, 0);

        // Overall achievement (weighted average across metrics)
        let overallAchievementPct = 0;
        if (metrics.length > 0) {
          const totalWeight = metrics.reduce((s, m) => s + m.weightagePercent, 0);
          overallAchievementPct = totalWeight > 0
            ? metrics.reduce((s, m) => s + m.achievementPct * m.weightagePercent, 0) / totalWeight
            : 0;
        }

        return {
          employeeId,
          employeeName: emp.full_name,
          designation: emp.designation,
          salesFunction,
          planName: resolvedPlanName,
          targetBonusUsd,
          metrics,
          commissions,
          totalEligiblePayout,
          totalPaid,
          totalHoldback,
          totalYearEndHoldback,
          totalCommissionPayout,
          totalCommissionPaid,
          totalCommissionHoldback,
          totalCommissionYearEndHoldback,
          overallAchievementPct,
          status: getStatus(overallAchievementPct),
          nrrResult,
          nrrOtePct,
          spiffResult,
          clawbackAmount,
        };
      }));

      // 5. Team aggregates
      const teamTotalTvp = members.reduce((s, m) => s + m.targetBonusUsd, 0);
      const teamTotalEligible = members.reduce((s, m) => 
        s + m.totalEligiblePayout + m.totalCommissionPayout + (m.nrrResult?.payoutUsd || 0) + (m.spiffResult?.totalSpiffUsd || 0), 0);
      const teamTotalPaid = members.reduce((s, m) => 
        s + m.totalPaid + m.totalCommissionPaid + (m.nrrResult?.payoutUsd || 0) + (m.spiffResult?.totalSpiffUsd || 0) - m.clawbackAmount, 0);

      // Weighted average achievement
      let teamWeightedAchievement = 0;
      if (teamTotalTvp > 0) {
        teamWeightedAchievement = members.reduce(
          (s, m) => s + m.overallAchievementPct * m.targetBonusUsd, 0
        ) / teamTotalTvp;
      }

      return {
        members,
        teamMemberCount: members.length,
        teamTotalTvp,
        teamWeightedAchievement,
        teamTotalEligible,
        teamTotalPaid,
      };
    },
  });
}
