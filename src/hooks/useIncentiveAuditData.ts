import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateProRation, getEffectiveDates } from "@/lib/compensation";
import { 
  calculateVariablePayFromPlan, 
  VariablePayResult,
  MetricActual 
} from "@/lib/compensationEngine";
import { 
  calculateDealCommission, 
  getCommissionForType,
  PlanCommission as CommissionType
} from "@/lib/commissions";
import { PlanMetric, MultiplierGrid } from "@/hooks/usePlanMetrics";

// All 8 participant role columns in the deals table
const PARTICIPANT_ROLES = [
  'sales_rep_employee_id',
  'sales_head_employee_id',
  'sales_engineering_employee_id',
  'sales_engineering_head_employee_id',
  'product_specialist_employee_id',
  'product_specialist_head_employee_id',
  'solution_manager_employee_id',
  'solution_manager_head_employee_id',
] as const;

export interface CommissionDetail {
  commissionType: string;
  dealValue: number;
  rate: number;
  grossCommission: number;
  immediatePayout: number;
  holdback: number;
}

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
  // Commission fields
  commissions: CommissionDetail[];
  totalCommissionGross: number;
  totalCommissionPaid: number;
  totalCommissionHoldback: number;
}

interface DealRow {
  new_software_booking_arr_usd: number | null;
  managed_services_usd: number | null;
  implementation_usd: number | null;
  cr_usd: number | null;
  er_usd: number | null;
  tcv_usd: number | null;
  perpetual_license_usd: number | null;
  sales_rep_employee_id: string | null;
  sales_head_employee_id: string | null;
  sales_engineering_employee_id: string | null;
  sales_engineering_head_employee_id: string | null;
  product_specialist_employee_id: string | null;
  product_specialist_head_employee_id: string | null;
  solution_manager_employee_id: string | null;
  solution_manager_head_employee_id: string | null;
}

interface PlanCommissionRow {
  id: string;
  plan_id: string;
  commission_type: string;
  commission_rate_pct: number;
  min_threshold_usd: number | null;
  is_active: boolean;
}

/**
 * Fetch and calculate incentive audit data for all employees
 * Uses the database-driven compensation engine with multi-participant attribution
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

      // 5. Fetch all plan commissions
      const { data: allCommissions, error: commissionsError } = await supabase
        .from("plan_commissions")
        .select("*")
        .in("plan_id", planIds);

      if (commissionsError) throw commissionsError;

      // Build commissions map by plan_id
      const commissionsMap = new Map<string, PlanCommissionRow[]>();
      (allCommissions || []).forEach(comm => {
        const planCommissions = commissionsMap.get(comm.plan_id) || [];
        planCommissions.push(comm);
        commissionsMap.set(comm.plan_id, planCommissions);
      });

      // 5b. Build metrics map with grids
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

      // 7. Fetch deals with ALL participant role columns for multi-participant attribution
      const { data: deals } = await supabase
        .from("deals")
        .select(`
          new_software_booking_arr_usd,
          managed_services_usd,
          implementation_usd,
          cr_usd,
          er_usd,
          tcv_usd,
          perpetual_license_usd,
          sales_rep_employee_id,
          sales_head_employee_id,
          sales_engineering_employee_id,
          sales_engineering_head_employee_id,
          product_specialist_employee_id,
          product_specialist_head_employee_id,
          solution_manager_employee_id,
          solution_manager_head_employee_id
        `)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd);

      // Aggregate deals by employee - credit ALL participant roles with the full value
      const dealsActualMap = new Map<string, number>();
      const dealsByEmployee = new Map<string, DealRow[]>();
      
      (deals || []).forEach((deal: DealRow) => {
        // Credit each participant role with the deal's new_software_booking_arr_usd
        PARTICIPANT_ROLES.forEach(role => {
          const empId = deal[role];
          if (empId) {
            // Aggregate for variable pay (New Software Booking ARR)
            const current = dealsActualMap.get(empId) || 0;
            dealsActualMap.set(empId, current + (deal.new_software_booking_arr_usd || 0));
            
            // Store full deal for commission calculation
            const empDeals = dealsByEmployee.get(empId) || [];
            // Avoid duplicates - only add if this employee hasn't been credited for this deal yet
            if (!empDeals.includes(deal)) {
              empDeals.push(deal);
              dealsByEmployee.set(empId, empDeals);
            }
          }
        });
      });

      // 8. Fetch closing ARR actuals - also with multi-participant attribution
      const { data: closingArr } = await supabase
        .from("closing_arr_actuals")
        .select("sales_rep_employee_id, closing_arr")
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd);

      // Aggregate closing ARR by employee (closing_arr_actuals only has sales_rep_employee_id)
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

        // Get plan commissions
        const planCommissions = commissionsMap.get(userTarget.plan_id) || [];

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

        // Calculate commissions for this employee's deals
        const employeeDeals = dealsByEmployee.get(profile.employee_id!) || [];
        const commissionDetails: CommissionDetail[] = [];
        let totalCommissionGross = 0;
        let totalCommissionPaid = 0;
        let totalCommissionHoldback = 0;

        // Calculate commissions for each deal type
        // Standard commission type mappings (excluding CR/ER which needs special handling)
        const standardMappings = [
          { type: 'Managed Services', field: 'managed_services_usd' as keyof DealRow },
          { type: 'Implementation', field: 'implementation_usd' as keyof DealRow },
          { type: 'Perpetual License', field: 'perpetual_license_usd' as keyof DealRow },
        ];

        // Aggregate deal values by commission type
        const aggregatedValues = new Map<string, number>();
        
        employeeDeals.forEach(deal => {
          // Standard commission types
          standardMappings.forEach(({ type, field }) => {
            const value = deal[field] as number | null;
            if (value && value > 0) {
              const current = aggregatedValues.get(type) || 0;
              aggregatedValues.set(type, current + value);
            }
          });
          
          // CR/ER is special - combine both cr_usd and er_usd columns
          const crErValue = (deal.cr_usd || 0) + (deal.er_usd || 0);
          if (crErValue > 0) {
            const current = aggregatedValues.get('CR/ER') || 0;
            aggregatedValues.set('CR/ER', current + crErValue);
          }
        });

        // Calculate commission for each aggregated type
        aggregatedValues.forEach((dealValue, commType) => {
          const commConfig = planCommissions.find(
            c => c.commission_type === commType && c.is_active
          );
          
          if (commConfig) {
            const calcResult = calculateDealCommission(
              dealValue,
              commConfig.commission_rate_pct,
              commConfig.min_threshold_usd
            );
            
            if (calcResult.qualifies && calcResult.gross > 0) {
              commissionDetails.push({
                commissionType: commType,
                dealValue,
                rate: commConfig.commission_rate_pct,
                grossCommission: calcResult.gross,
                immediatePayout: calcResult.paid,
                holdback: calcResult.holdback,
              });
              
              totalCommissionGross += calcResult.gross;
              totalCommissionPaid += calcResult.paid;
              totalCommissionHoldback += calcResult.holdback;
            }
          }
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
          commissions: commissionDetails,
          totalCommissionGross,
          totalCommissionPaid,
          totalCommissionHoldback,
        });
      }

      return auditData;
    },
  });
}
