import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { getMultiplierFromGrid, calculateAchievementPercent } from "@/lib/compensationEngine";
import { PlanMetric, MultiplierGrid } from "./usePlanMetrics";

// Map employee sales_function to plan name
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
};

// Participant roles for deal attribution
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

export interface MetricCompensation {
  metricName: string;
  targetValue: number;
  actualValue: number;
  achievementPct: number;
  weightagePercent: number;
  allocation: number;
  multiplier: number;
  eligiblePayout: number;
  amountPaid: number;      // 75% of eligible
  holdback: number;        // 25% of eligible
  logicType: string;
  gateThreshold: number | null;
  multiplierGrids: MultiplierGrid[];
}

export interface CommissionCompensation {
  commissionType: string;
  dealValue: number;
  rate: number;
  minThreshold: number | null;
  grossPayout: number;
  amountPaid: number;      // 75%
  holdback: number;        // 25%
}

export interface MonthlyMetricBreakdown {
  month: string;
  monthLabel: string;
  newSoftwareArr: number;
  closingArr: number;
}

export interface CurrentUserCompensation {
  employeeId: string;
  employeeName: string;
  targetBonusUsd: number;
  planId: string;
  planName: string;
  fiscalYear: number;
  metrics: MetricCompensation[];
  commissions: CommissionCompensation[];
  monthlyBreakdown: MonthlyMetricBreakdown[];
  clawbackAmount: number;
  totalEligiblePayout: number;
  totalPaid: number;
  totalHoldback: number;
  totalCommissionPayout: number;
  totalCommissionPaid: number;
  totalCommissionHoldback: number;
  // Raw data for simulator
  planMetrics: PlanMetric[];
}

/**
 * Get complete compensation data for current user by bypassing user_targets
 * Sources data directly from: employees, performance_targets, comp_plans, plan_metrics, deals
 */
export function useCurrentUserCompensation() {
  const { selectedYear } = useFiscalYear();

  return useQuery({
    queryKey: ["current_user_compensation", selectedYear],
    queryFn: async (): Promise<CurrentUserCompensation | null> => {
      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // 2. Get profile with employee_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("employee_id, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.employee_id) return null;

      const employeeId = profile.employee_id;

      // 3. Get employee master data
      const { data: employee } = await supabase
        .from("employees")
        .select("full_name, tvp_usd, sales_function, local_currency")
        .eq("employee_id", employeeId)
        .maybeSingle();

      if (!employee) return null;

      // 4. Map sales_function to plan name and find plan
      const salesFunction = employee.sales_function || "";
      const planName = SALES_FUNCTION_TO_PLAN[salesFunction] || salesFunction;

      const { data: plan } = await supabase
        .from("comp_plans")
        .select("id, name")
        .eq("effective_year", selectedYear)
        .eq("name", planName)
        .maybeSingle();

      // If no plan found, try to get any active plan
      const planId = plan?.id;
      const resolvedPlanName = plan?.name || planName || "No Plan";

      // 5. Get performance targets for this employee and year
      const { data: targets } = await supabase
        .from("performance_targets")
        .select("metric_type, target_value_usd")
        .eq("employee_id", employeeId)
        .eq("effective_year", selectedYear);

      // Build target map
      const targetMap = new Map<string, number>();
      (targets || []).forEach(t => {
        targetMap.set(t.metric_type, t.target_value_usd);
      });

      // 6. Get plan metrics and multiplier grids (if plan exists)
      let planMetrics: PlanMetric[] = [];
      if (planId) {
        const { data: metrics } = await supabase
          .from("plan_metrics")
          .select("*")
          .eq("plan_id", planId)
          .order("metric_name");

        if (metrics && metrics.length > 0) {
          const metricIds = metrics.map(m => m.id);
          const { data: grids } = await supabase
            .from("multiplier_grids")
            .select("*")
            .in("plan_metric_id", metricIds)
            .order("min_pct");

          planMetrics = metrics.map(m => ({
            ...m,
            multiplier_grids: (grids || []).filter(g => g.plan_metric_id === m.id),
          }));
        }
      }

      // 7. Get plan commissions (if plan exists)
      let planCommissions: Array<{
        commission_type: string;
        commission_rate_pct: number;
        min_threshold_usd: number | null;
      }> = [];
      
      if (planId) {
        const { data: commissions } = await supabase
          .from("plan_commissions")
          .select("commission_type, commission_rate_pct, min_threshold_usd")
          .eq("plan_id", planId)
          .eq("is_active", true);
        
        planCommissions = commissions || [];
      }

      // 8. Get actuals from deals table with commission fields
      const fiscalYearStart = `${selectedYear}-01-01`;
      const fiscalYearEnd = `${selectedYear}-12-31`;

      const { data: deals } = await supabase
        .from("deals")
        .select(`
          month_year,
          new_software_booking_arr_usd,
          managed_services_usd,
          perpetual_license_usd,
          cr_usd,
          er_usd,
          implementation_usd,
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

      // Aggregate actuals by month and metric
      const newBookingByMonth = new Map<string, number>();
      let newBookingYtd = 0;
      
      // Commission aggregations
      let managedServicesYtd = 0;
      let perpetualLicenseYtd = 0;
      let crErYtd = 0;
      let implementationYtd = 0;

      (deals || []).forEach((deal: any) => {
        const isParticipant = PARTICIPANT_ROLES.some(role => deal[role] === employeeId);
        if (isParticipant) {
          const monthKey = deal.month_year?.substring(0, 7) || "";
          const value = deal.new_software_booking_arr_usd || 0;
          newBookingByMonth.set(monthKey, (newBookingByMonth.get(monthKey) || 0) + value);
          newBookingYtd += value;
          
          // Aggregate commission deal values
          managedServicesYtd += deal.managed_services_usd || 0;
          perpetualLicenseYtd += deal.perpetual_license_usd || 0;
          crErYtd += (deal.cr_usd || 0) + (deal.er_usd || 0);
          implementationYtd += deal.implementation_usd || 0;
        }
      });

      // 9. Get ELIGIBLE closing ARR actuals (only records with end_date > fiscal year end)
      // Attribution: Both sales_rep and sales_head receive credit
      // Logic: Use LATEST month's value (not cumulative) since uploads are portfolio snapshots
      const { data: closingArr } = await supabase
        .from("closing_arr_actuals")
        .select("month_year, closing_arr, end_date, sales_rep_employee_id, sales_head_employee_id")
        .or(`sales_rep_employee_id.eq.${employeeId},sales_head_employee_id.eq.${employeeId}`)
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd)
        .gt("end_date", `${selectedYear}-12-31`); // ELIGIBILITY FILTER

      // Group eligible closing ARR by month
      const closingByMonth = new Map<string, number>();
      (closingArr || []).forEach((arr) => {
        const monthKey = arr.month_year?.substring(0, 7) || "";
        const value = arr.closing_arr || 0;
        closingByMonth.set(monthKey, (closingByMonth.get(monthKey) || 0) + value);
      });

      // Use only the LATEST month's eligible Closing ARR for achievement (not cumulative)
      const sortedClosingMonths = Array.from(closingByMonth.keys()).sort();
      const latestClosingMonth = sortedClosingMonths[sortedClosingMonths.length - 1];
      const closingYtd = latestClosingMonth ? closingByMonth.get(latestClosingMonth) || 0 : 0;

      // 10. Build metrics with calculations
      const targetBonusUsd = employee.tvp_usd || 0;

      // Create actuals map
      const actualsMap = new Map<string, number>([
        ["New Software Booking ARR", newBookingYtd],
        ["Closing ARR", closingYtd],
      ]);

      // Calculate metrics
      const metrics: MetricCompensation[] = [];

      if (planMetrics.length > 0) {
        planMetrics.forEach(pm => {
          const targetValue = targetMap.get(pm.metric_name) || 0;
          const actualValue = actualsMap.get(pm.metric_name) || 0;
          const achievementPct = calculateAchievementPercent(actualValue, targetValue);
          const allocation = (targetBonusUsd * pm.weightage_percent) / 100;
          const multiplier = getMultiplierFromGrid(achievementPct, pm);

          // Check gate
          const isGated = pm.logic_type === "Gated_Threshold";
          const belowGate = isGated && pm.gate_threshold_percent && achievementPct <= pm.gate_threshold_percent;
          const eligiblePayout = belowGate ? 0 : (achievementPct / 100) * allocation * multiplier;

          const amountPaid = eligiblePayout * 0.75;
          const holdback = eligiblePayout * 0.25;

          metrics.push({
            metricName: pm.metric_name,
            targetValue,
            actualValue,
            achievementPct,
            weightagePercent: pm.weightage_percent,
            allocation,
            multiplier,
            eligiblePayout,
            amountPaid,
            holdback,
            logicType: pm.logic_type,
            gateThreshold: pm.gate_threshold_percent,
            multiplierGrids: pm.multiplier_grids || [],
          });
        });
      } else {
        // Fallback: create metrics from performance targets if no plan metrics
        const metricNames = ["New Software Booking ARR", "Closing ARR"];
        const defaultWeightage = 50;

        metricNames.forEach(metricName => {
          const targetValue = targetMap.get(metricName) || 0;
          const actualValue = actualsMap.get(metricName) || 0;
          const achievementPct = calculateAchievementPercent(actualValue, targetValue);
          const allocation = (targetBonusUsd * defaultWeightage) / 100;
          // Default multiplier logic
          const multiplier = achievementPct >= 100 ? 1.0 : 1.0;
          const eligiblePayout = (achievementPct / 100) * allocation * multiplier;
          const amountPaid = eligiblePayout * 0.75;
          const holdback = eligiblePayout * 0.25;

          metrics.push({
            metricName,
            targetValue,
            actualValue,
            achievementPct,
            weightagePercent: defaultWeightage,
            allocation,
            multiplier,
            eligiblePayout,
            amountPaid,
            holdback,
            logicType: "Linear",
            gateThreshold: null,
            multiplierGrids: [],
          });
        });
      }

      // 11. Calculate commission payouts
      const commissionActualsMap: Record<string, number> = {
        "Managed Services": managedServicesYtd,
        "Perpetual License": perpetualLicenseYtd,
        "CR/ER": crErYtd,
        "Implementation": implementationYtd,
      };

      const commissions: CommissionCompensation[] = planCommissions.map(pc => {
        const dealValue = commissionActualsMap[pc.commission_type] || 0;
        const rate = pc.commission_rate_pct / 100;
        const meetsThreshold = !pc.min_threshold_usd || dealValue >= pc.min_threshold_usd;
        const grossPayout = meetsThreshold ? dealValue * rate : 0;
        const amountPaid = grossPayout * 0.75;
        const holdback = grossPayout * 0.25;

        return {
          commissionType: pc.commission_type,
          dealValue,
          rate: pc.commission_rate_pct,
          minThreshold: pc.min_threshold_usd,
          grossPayout,
          amountPaid,
          holdback,
        };
      });

      // 12. Build monthly breakdown
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const allMonths = new Set<string>();
      newBookingByMonth.forEach((_, k) => allMonths.add(k));
      closingByMonth.forEach((_, k) => allMonths.add(k));

      const monthlyBreakdown: MonthlyMetricBreakdown[] = Array.from(allMonths)
        .sort()
        .map(month => {
          const monthIndex = parseInt(month.substring(5, 7), 10) - 1;
          return {
            month,
            monthLabel: monthNames[monthIndex] || month.substring(5, 7),
            newSoftwareArr: newBookingByMonth.get(month) || 0,
            closingArr: closingByMonth.get(month) || 0,
          };
        });

      // 13. Calculate totals
      const totalEligiblePayout = metrics.reduce((sum, m) => sum + m.eligiblePayout, 0);
      const totalPaid = metrics.reduce((sum, m) => sum + m.amountPaid, 0);
      const totalHoldback = metrics.reduce((sum, m) => sum + m.holdback, 0);
      
      const totalCommissionPayout = commissions.reduce((sum, c) => sum + c.grossPayout, 0);
      const totalCommissionPaid = commissions.reduce((sum, c) => sum + c.amountPaid, 0);
      const totalCommissionHoldback = commissions.reduce((sum, c) => sum + c.holdback, 0);
      
      const clawbackAmount = 0; // TODO: Calculate from monthly_payouts if needed

      return {
        employeeId,
        employeeName: employee.full_name || profile.full_name || "Unknown",
        targetBonusUsd,
        planId: planId || "",
        planName: resolvedPlanName,
        fiscalYear: selectedYear,
        metrics,
        commissions,
        monthlyBreakdown,
        clawbackAmount,
        totalEligiblePayout,
        totalPaid,
        totalHoldback,
        totalCommissionPayout,
        totalCommissionPaid,
        totalCommissionHoldback,
        planMetrics,
      };
    },
  });
}
