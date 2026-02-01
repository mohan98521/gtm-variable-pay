import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateProRation, getEffectiveDates } from "@/lib/compensation";
import { 
  calculateVariablePayFromPlan, 
  VariablePayResult,
  MetricActual 
} from "@/lib/compensationEngine";
import { PlanMetric, MultiplierGrid } from "@/hooks/usePlanMetrics";

export interface IncentiveAuditRow {
  employeeId: string;
  employeeName: string;
  email: string;
  salesFunction: string | null;
  planName: string;
  targetBonusUsd: number;
  proRatedTargetBonusUsd: number;
  proRationFactor: number;
  metrics: {
    metricName: string;
    target: number;
    actual: number;
    achievementPct: number;
    allocation: number;
    multiplier: number;
    payout: number;
    logicType: string;
    isGated: boolean;
    gateThreshold: number | null;
  }[];
  totalPayout: number;
}

/**
 * Fetch and calculate incentive audit data for all employees
 * Uses the database-driven compensation engine
 */
export function useIncentiveAuditData(fiscalYear: number = 2026) {
  return useQuery({
    queryKey: ["incentive_audit_data", fiscalYear],
    queryFn: async () => {
      const fiscalYearStart = `${fiscalYear}-01-01`;
      const fiscalYearEnd = `${fiscalYear}-12-31`;

      // 1. Fetch all user targets with plan info and profiles
      const { data: userTargets, error: targetsError } = await supabase
        .from("user_targets")
        .select(`
          *,
          profiles:user_id (
            id,
            email,
            full_name,
            employee_id,
            sales_function,
            date_of_hire
          ),
          comp_plans:plan_id (
            id,
            name
          )
        `)
        .gte("effective_end_date", fiscalYearStart)
        .lte("effective_start_date", fiscalYearEnd);

      if (targetsError) throw targetsError;
      if (!userTargets || userTargets.length === 0) return [];

      // 2. Get all unique plan IDs
      const planIds = [...new Set(userTargets.map(ut => ut.plan_id))];

      // 3. Fetch all plan metrics
      const { data: allMetrics, error: metricsError } = await supabase
        .from("plan_metrics")
        .select("*")
        .in("plan_id", planIds);

      if (metricsError) throw metricsError;

      // 4. Fetch all multiplier grids
      const metricIds = (allMetrics || []).map(m => m.id);
      let allGrids: MultiplierGrid[] = [];
      if (metricIds.length > 0) {
        const { data: grids, error: gridsError } = await supabase
          .from("multiplier_grids")
          .select("*")
          .in("plan_metric_id", metricIds);

        if (gridsError) throw gridsError;
        allGrids = grids || [];
      }

      // 5. Build metrics map with grids
      const metricsMap = new Map<string, PlanMetric[]>();
      (allMetrics || []).forEach(metric => {
        const planMetrics = metricsMap.get(metric.plan_id) || [];
        planMetrics.push({
          ...metric,
          multiplier_grids: allGrids.filter(g => g.plan_metric_id === metric.id),
        });
        metricsMap.set(metric.plan_id, planMetrics);
      });

      // 6. Fetch performance targets for all employees
      const employeeIds = userTargets
        .map(ut => ut.profiles?.employee_id)
        .filter((id): id is string => !!id);

      const { data: perfTargets } = await supabase
        .from("performance_targets")
        .select("*")
        .eq("effective_year", fiscalYear)
        .in("employee_id", employeeIds);

      // Build target map: employee_id -> metric_type -> target_value
      const targetMap = new Map<string, Map<string, number>>();
      (perfTargets || []).forEach(pt => {
        const empTargets = targetMap.get(pt.employee_id) || new Map<string, number>();
        empTargets.set(pt.metric_type, pt.target_value_usd);
        targetMap.set(pt.employee_id, empTargets);
      });

      // 7. Fetch deals actuals (New Software Booking ARR)
      const { data: deals } = await supabase
        .from("deals")
        .select("sales_rep_employee_id, new_software_booking_arr_usd")
        .in("sales_rep_employee_id", employeeIds)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd);

      // Aggregate deals by employee
      const dealsActualMap = new Map<string, number>();
      (deals || []).forEach(deal => {
        if (deal.sales_rep_employee_id) {
          const current = dealsActualMap.get(deal.sales_rep_employee_id) || 0;
          dealsActualMap.set(deal.sales_rep_employee_id, current + (deal.new_software_booking_arr_usd || 0));
        }
      });

      // 8. Fetch closing ARR actuals
      const { data: closingArr } = await supabase
        .from("closing_arr_actuals")
        .select("sales_rep_employee_id, closing_arr")
        .in("sales_rep_employee_id", employeeIds)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd);

      // Aggregate closing ARR by employee
      const closingActualMap = new Map<string, number>();
      (closingArr || []).forEach(arr => {
        if (arr.sales_rep_employee_id) {
          const current = closingActualMap.get(arr.sales_rep_employee_id) || 0;
          closingActualMap.set(arr.sales_rep_employee_id, current + (arr.closing_arr || 0));
        }
      });

      // 9. Calculate incentive for each employee
      const auditData: IncentiveAuditRow[] = [];

      for (const userTarget of userTargets) {
        const profile = userTarget.profiles;
        const plan = userTarget.comp_plans;
        
        if (!profile || !plan || !profile.employee_id) continue;

        // Get plan metrics
        const planMetrics = metricsMap.get(userTarget.plan_id) || [];
        if (planMetrics.length === 0) continue;

        // Calculate pro-ration
        const { startDate, endDate } = getEffectiveDates(
          profile.date_of_hire,
          null,
          fiscalYear
        );

        const proRation = calculateProRation({
          effectiveStartDate: startDate,
          effectiveEndDate: endDate,
          targetBonusUSD: userTarget.target_bonus_usd || 0,
        });

        // Get targets and actuals for each metric
        const employeeTargets = targetMap.get(profile.employee_id) || new Map<string, number>();

        const metricsActuals: MetricActual[] = planMetrics.map(metric => {
          let targetValue = 0;
          let actualValue = 0;

          // Map metric name to actual data source
          if (metric.metric_name === "New Software Booking ARR") {
            targetValue = employeeTargets.get("New Software Booking ARR") || 0;
            actualValue = dealsActualMap.get(profile.employee_id!) || 0;
          } else if (metric.metric_name === "Closing ARR") {
            targetValue = employeeTargets.get("Closing ARR") || 0;
            actualValue = closingActualMap.get(profile.employee_id!) || 0;
          } else {
            // For other metrics, try to match by name
            targetValue = employeeTargets.get(metric.metric_name) || 0;
            actualValue = 0; // Would need additional data sources
          }

          return {
            metricId: metric.id,
            metricName: metric.metric_name,
            targetValue,
            actualValue,
          };
        });

        // Use the database-driven compensation engine
        const result = calculateVariablePayFromPlan({
          userId: profile.id,
          planId: plan.id,
          planName: plan.name,
          targetBonusUSD: userTarget.target_bonus_usd || 0,
          proRatedTargetBonusUSD: proRation.proRatedTargetBonusUSD,
          proRationFactor: proRation.proRationFactor,
          metrics: planMetrics,
          metricsActuals,
        });

        auditData.push({
          employeeId: profile.employee_id,
          employeeName: profile.full_name,
          email: profile.email,
          salesFunction: profile.sales_function,
          planName: plan.name,
          targetBonusUsd: userTarget.target_bonus_usd || 0,
          proRatedTargetBonusUsd: proRation.proRatedTargetBonusUSD,
          proRationFactor: proRation.proRationFactor,
          metrics: result.metricPayouts.map(mp => ({
            metricName: mp.metricName,
            target: mp.targetValue,
            actual: mp.actualValue,
            achievementPct: mp.achievementPercent,
            allocation: mp.bonusAllocation,
            multiplier: mp.multiplier,
            payout: mp.payout,
            logicType: mp.logicType,
            isGated: mp.isGated,
            gateThreshold: mp.gateThreshold,
          })),
          totalPayout: result.totalPayoutUSD,
        });
      }

      return auditData;
    },
  });
}
