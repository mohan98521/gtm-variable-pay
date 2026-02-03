import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { DealRecord } from "./useMyActualsData";
import { calculateDealCommission, PlanCommission } from "@/lib/commissions";
import { 
  calculateDealVariablePayAttributions,
  DealForAttribution,
  DealVariablePayAttribution,
  AggregateVariablePayContext,
} from "@/lib/dealVariablePayAttribution";
import { PlanMetric } from "@/hooks/usePlanMetrics";

// All 8 participant role columns in the deals table
const PARTICIPANT_ROLES = [
  "sales_rep_employee_id",
  "sales_head_employee_id",
  "sales_engineering_employee_id",
  "sales_engineering_head_employee_id",
  "product_specialist_employee_id",
  "product_specialist_head_employee_id",
  "solution_manager_employee_id",
  "solution_manager_head_employee_id",
] as const;

// Roles that can view all data (non-sales roles without targets)
const VIEW_ALL_ROLES = ["admin", "gtm_ops", "finance", "executive"] as const;

/**
 * Get the last day of a month given YYYY-MM format
 */
function getMonthEndDate(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${yearMonth}-${lastDay.toString().padStart(2, "0")}`;
}

export interface IncentiveBreakdown {
  type: string;
  value: number;
  rate: number;
  amount: number;
  payout_on_booking_pct: number;
  payout_on_collection_pct: number;
  payout_on_year_end_pct: number;
}

export interface DealWithIncentives extends DealRecord {
  // Collection fields (from deal_collections)
  is_collected: boolean;
  collection_date: string | null;
  collection_month: string | null;
  is_clawback_triggered: boolean;
  first_milestone_due_date: string | null;
  linked_to_impl: boolean;

  // Calculated commission incentive fields
  eligible_incentive_usd: number;
  payout_on_booking_usd: number;
  payout_on_collection_usd: number;
  payout_on_year_end_usd: number;
  actual_paid_usd: number;

  // Per-category breakdown
  incentive_breakdown: IncentiveBreakdown[];

  // Collection status display
  collection_status: "Pending" | "Collected" | "Clawback" | "Overdue";

  // NEW: Variable Pay Attribution fields
  vp_proportion_pct: number | null;
  vp_eligible_usd: number | null;
  vp_payout_on_booking_usd: number | null;
  vp_payout_on_collection_usd: number | null;
  vp_payout_on_year_end_usd: number | null;
  vp_clawback_eligible_usd: number | null;
  vp_is_clawback_exempt: boolean;
}

interface DealCollectionRow {
  deal_id: string;
  is_collected: boolean | null;
  collection_date: string | null;
  collection_month: string | null;
  is_clawback_triggered: boolean | null;
  first_milestone_due_date: string | null;
}

/**
 * Helper to check if user has "view all data" role
 */
async function canUserViewAllData(userId: string): Promise<boolean> {
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const roles = (userRoles || []).map((r) => r.role);
  return VIEW_ALL_ROLES.some((role) => roles.includes(role));
}

/**
 * Commission type mapping based on deal value columns
 */
const COMMISSION_TYPE_MAPPINGS: { type: string; valueKey: keyof DealRecord }[] = [
  { type: "Managed Services", valueKey: "managed_services_usd" },
  { type: "Perpetual License", valueKey: "perpetual_license_usd" },
  { type: "Implementation", valueKey: "implementation_usd" },
];

/**
 * Calculate CR/ER combined value
 */
function getCrErValue(deal: DealRecord): number {
  return (deal.cr_usd || 0) + (deal.er_usd || 0);
}

/**
 * Calculate incentive breakdown for a deal based on plan commissions
 */
function calculateIncentiveBreakdown(
  deal: DealRecord,
  planCommissions: PlanCommission[],
  linkedToImpl: boolean
): {
  breakdowns: IncentiveBreakdown[];
  totalEligible: number;
  totalBooking: number;
  totalCollection: number;
  totalYearEnd: number;
} {
  const breakdowns: IncentiveBreakdown[] = [];
  let totalEligible = 0;
  let totalBooking = 0;
  let totalCollection = 0;
  let totalYearEnd = 0;

  // Check standard commission types
  for (const mapping of COMMISSION_TYPE_MAPPINGS) {
    const value = deal[mapping.valueKey] as number | null;
    if (value && value > 0) {
      const commission = planCommissions.find(
        (c) => c.commission_type === mapping.type && c.is_active
      );

      if (commission) {
        // Determine payout percentages based on linked_to_impl
        const bookingPct = linkedToImpl ? 0 : (commission.payout_on_booking_pct ?? 70);
        const collectionPct = linkedToImpl ? 100 : (commission.payout_on_collection_pct ?? 25);
        const yearEndPct = linkedToImpl ? 0 : (commission.payout_on_year_end_pct ?? 5);

        const result = calculateDealCommission(
          value,
          commission.commission_rate_pct,
          commission.min_threshold_usd,
          bookingPct,
          collectionPct,
          yearEndPct
        );

        if (result.qualifies) {
          breakdowns.push({
            type: mapping.type,
            value,
            rate: commission.commission_rate_pct,
            amount: result.gross,
            payout_on_booking_pct: bookingPct,
            payout_on_collection_pct: collectionPct,
            payout_on_year_end_pct: yearEndPct,
          });

          totalEligible += result.gross;
          totalBooking += result.paid;
          totalCollection += result.holdback;
          totalYearEnd += result.yearEndHoldback;
        }
      }
    }
  }

  // Check CR/ER combined
  const crErValue = getCrErValue(deal);
  if (crErValue > 0) {
    const commission = planCommissions.find(
      (c) => c.commission_type === "CR/ER" && c.is_active
    );

    if (commission) {
      const bookingPct = linkedToImpl ? 0 : (commission.payout_on_booking_pct ?? 70);
      const collectionPct = linkedToImpl ? 100 : (commission.payout_on_collection_pct ?? 25);
      const yearEndPct = linkedToImpl ? 0 : (commission.payout_on_year_end_pct ?? 5);

      const result = calculateDealCommission(
        crErValue,
        commission.commission_rate_pct,
        commission.min_threshold_usd,
        bookingPct,
        collectionPct,
        yearEndPct
      );

      if (result.qualifies) {
        breakdowns.push({
          type: "CR/ER",
          value: crErValue,
          rate: commission.commission_rate_pct,
          amount: result.gross,
          payout_on_booking_pct: bookingPct,
          payout_on_collection_pct: collectionPct,
          payout_on_year_end_pct: yearEndPct,
        });

        totalEligible += result.gross;
        totalBooking += result.paid;
        totalCollection += result.holdback;
        totalYearEnd += result.yearEndHoldback;
      }
    }
  }

  return {
    breakdowns,
    totalEligible,
    totalBooking,
    totalCollection,
    totalYearEnd,
  };
}

/**
 * Determine collection status based on collection data and clawback
 */
function getCollectionStatus(
  isCollected: boolean,
  isClawback: boolean,
  firstMilestoneDueDate: string | null
): "Pending" | "Collected" | "Clawback" | "Overdue" {
  if (isClawback) return "Clawback";
  if (isCollected) return "Collected";
  
  // Check if overdue
  if (firstMilestoneDueDate) {
    const dueDate = new Date(firstMilestoneDueDate);
    const today = new Date();
    if (dueDate < today) return "Overdue";
  }
  
  return "Pending";
}

// Map sales_function to plan name
const SALES_FUNCTION_TO_PLAN: Record<string, string> = {
  "Farming": "Farmer",
  "Hunting": "Hunter",
  "Overlay": "Overlay",
};

interface EmployeeVPConfig {
  employeeId: string;
  metric: PlanMetric;
  targetUsd: number;
  bonusAllocationUsd: number;
  planId: string;
  isClawbackExempt: boolean;
}

/**
 * Batch fetch VP configurations for multiple employees (optimized for admin view)
 */
async function fetchAllEmployeeVPConfigs(
  employeeIds: string[],
  fiscalYear: number
): Promise<Map<string, EmployeeVPConfig>> {
  const configMap = new Map<string, EmployeeVPConfig>();
  
  if (employeeIds.length === 0) return configMap;
  
  // Batch fetch all employees
  const { data: employees } = await supabase
    .from("employees")
    .select("employee_id, tvp_usd, sales_function")
    .in("employee_id", employeeIds);
  
  if (!employees?.length) return configMap;
  
  // Batch fetch all performance targets
  const { data: perfTargets } = await supabase
    .from("performance_targets")
    .select("employee_id, target_value_usd")
    .in("employee_id", employeeIds)
    .eq("effective_year", fiscalYear)
    .eq("metric_type", "New Software Booking ARR");
  
  // Create lookup maps
  const targetMap = new Map<string, number>();
  (perfTargets || []).forEach(pt => {
    targetMap.set(pt.employee_id, pt.target_value_usd);
  });
  
  // Group employees by plan name
  const employeesByPlan = new Map<string, typeof employees>();
  employees.forEach(emp => {
    const planName = SALES_FUNCTION_TO_PLAN[emp.sales_function || ""];
    if (!planName) return;
    
    if (!employeesByPlan.has(planName)) {
      employeesByPlan.set(planName, []);
    }
    employeesByPlan.get(planName)!.push(emp);
  });
  
  // Fetch all relevant plans
  const planNames = Array.from(employeesByPlan.keys());
  if (planNames.length === 0) return configMap;
  
  const { data: plans } = await supabase
    .from("comp_plans")
    .select("id, name, is_clawback_exempt")
    .in("name", planNames)
    .eq("effective_year", fiscalYear)
    .eq("is_active", true);
  
  if (!plans?.length) return configMap;
  
  // Fetch all plan metrics
  const planIds = plans.map(p => p.id);
  const { data: allMetrics } = await supabase
    .from("plan_metrics")
    .select("*")
    .in("plan_id", planIds);
  
  if (!allMetrics?.length) return configMap;
  
  // Filter to ARR metrics and create plan->metric map
  const planMetricMap = new Map<string, typeof allMetrics[0]>();
  allMetrics.forEach(m => {
    if (
      m.metric_name === "New Software Booking ARR" ||
      m.metric_name.toLowerCase().includes("new software") ||
      m.metric_name.toLowerCase().includes("booking arr")
    ) {
      planMetricMap.set(m.plan_id, m);
    }
  });
  
  // Fetch all multiplier grids for relevant metrics
  const metricIds = Array.from(planMetricMap.values()).map(m => m.id);
  const { data: allGrids } = await supabase
    .from("multiplier_grids")
    .select("*")
    .in("plan_metric_id", metricIds)
    .order("min_pct");
  
  // Group grids by metric
  const gridsByMetric = new Map<string, typeof allGrids>();
  (allGrids || []).forEach(g => {
    if (!gridsByMetric.has(g.plan_metric_id)) {
      gridsByMetric.set(g.plan_metric_id, []);
    }
    gridsByMetric.get(g.plan_metric_id)!.push(g);
  });
  
  // Build plan name -> plan data map
  const planNameToData = new Map<string, { id: string; isClawbackExempt: boolean }>();
  plans.forEach(p => planNameToData.set(p.name, { id: p.id, isClawbackExempt: p.is_clawback_exempt || false }));
  
  // Build final config for each employee
  employees.forEach(emp => {
    const planName = SALES_FUNCTION_TO_PLAN[emp.sales_function || ""];
    if (!planName) return;
    
    const planData = planNameToData.get(planName);
    if (!planData) return;
    
    const metric = planMetricMap.get(planData.id);
    if (!metric) return;
    
    const grids = gridsByMetric.get(metric.id) || [];
    const targetUsd = targetMap.get(emp.employee_id) || 0;
    const tvpUsd = emp.tvp_usd || 0;
    const bonusAllocation = (tvpUsd * metric.weightage_percent) / 100;
    
    configMap.set(emp.employee_id, {
      employeeId: emp.employee_id,
      metric: {
        ...metric,
        multiplier_grids: grids,
      } as PlanMetric,
      targetUsd,
      bonusAllocationUsd: bonusAllocation,
      planId: planData.id,
      isClawbackExempt: planData.isClawbackExempt,
    });
  });
  
  return configMap;
}

/**
 * Fetch the New Software Booking ARR metric config for a single employee
 */
async function fetchEmployeeVPConfig(
  employeeId: string,
  fiscalYear: number
): Promise<EmployeeVPConfig | null> {
  const configMap = await fetchAllEmployeeVPConfigs([employeeId], fiscalYear);
  return configMap.get(employeeId) || null;
}

// Extended VP attribution with clawback exemption status
interface VPAttributionWithExemption extends DealVariablePayAttribution {
  isClawbackExempt: boolean;
}

/**
 * Calculate VP attributions for all employees in the deal set (admin view)
 */
async function calculateVPForAllEmployees(
  deals: DealRecord[],
  fiscalYear: number,
  fiscalYearStart: string,
  fiscalYearEnd: string
): Promise<Map<string, VPAttributionWithExemption>> {
  const vpMap = new Map<string, VPAttributionWithExemption>();
  
  // Extract unique employee IDs from sales_rep_employee_id
  const uniqueEmployeeIds = new Set<string>();
  deals.forEach(deal => {
    if (deal.sales_rep_employee_id) {
      uniqueEmployeeIds.add(deal.sales_rep_employee_id);
    }
  });
  
  if (uniqueEmployeeIds.size === 0) return vpMap;
  
  // Batch fetch all VP configs
  const employeeIds = Array.from(uniqueEmployeeIds);
  const vpConfigs = await fetchAllEmployeeVPConfigs(employeeIds, fiscalYear);
  
  if (vpConfigs.size === 0) return vpMap;
  
  // Fetch ALL YTD deals for VP calculation (need full context for each employee)
  const { data: ytdDeals } = await supabase
    .from("deals")
    .select("id, new_software_booking_arr_usd, month_year, project_id, customer_name, sales_rep_employee_id, sales_head_employee_id, sales_engineering_employee_id, sales_engineering_head_employee_id, product_specialist_employee_id, product_specialist_head_employee_id, solution_manager_employee_id, solution_manager_head_employee_id")
    .gte("month_year", fiscalYearStart)
    .lte("month_year", fiscalYearEnd);
  
  if (!ytdDeals?.length) return vpMap;
  
  // Calculate today's month for calculation
  const today = new Date();
  const calculationMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  
  // For each employee with a valid config, calculate their VP attributions
  for (const [empId, config] of vpConfigs) {
    if (config.targetUsd <= 0) continue;
    
    // Filter to this employee's deals (where they are sales_rep)
    const employeeDeals = ytdDeals.filter(d => d.sales_rep_employee_id === empId);
    
    if (employeeDeals.length === 0) continue;
    
    // Calculate VP attributions for this employee
    const vpResult = calculateDealVariablePayAttributions(
      employeeDeals as DealForAttribution[],
      empId,
      config.metric,
      config.targetUsd,
      config.bonusAllocationUsd,
      fiscalYear,
      calculationMonth
    );
    
    // Add to map (keyed by deal_id) with clawback exemption status
    vpResult.attributions.forEach(attr => {
      vpMap.set(attr.dealId, {
        ...attr,
        isClawbackExempt: config.isClawbackExempt,
      });
    });
  }
  
  return vpMap;
}

/**
 * Hook to fetch deals with collection status and calculated incentives
 */
export function useMyDealsWithIncentives(selectedMonth: string | null) {
  const { selectedYear } = useFiscalYear();

  return useQuery({
    queryKey: ["my_deals_with_incentives", selectedYear, selectedMonth],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      // Check if user can view all data
      const canViewAll = await canUserViewAllData(user.id);

      const fiscalYearStart = `${selectedYear}-01-01`;
      const fiscalYearEnd = `${selectedYear}-12-31`;

      // Build deal query
      let dealsQuery = supabase
        .from("deals")
        .select("*")
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd)
        .order("month_year", { ascending: false });

      // If specific month selected, filter to that month
      if (selectedMonth) {
        const startDate = `${selectedMonth}-01`;
        const endDate = getMonthEndDate(selectedMonth);
        dealsQuery = dealsQuery.gte("month_year", startDate).lte("month_year", endDate);
      }

      const { data: deals, error: dealsError } = await dealsQuery;
      if (dealsError) throw dealsError;

      // Get user's employee_id for filtering if not admin
      let employeeId: string | null = null;
      if (!canViewAll) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("employee_id")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile?.employee_id) return [];
        employeeId = profile.employee_id;
      }

      // Filter deals for non-admin users
      let filteredDeals = deals || [];
      if (!canViewAll && employeeId) {
        filteredDeals = filteredDeals.filter((deal) => {
          return PARTICIPANT_ROLES.some((role) => deal[role] === employeeId);
        });
      }

      if (filteredDeals.length === 0) return [];

      // Fetch deal_collections for all relevant deals
      const dealIds = filteredDeals.map((d) => d.id);
      const { data: collections } = await supabase
        .from("deal_collections")
        .select("deal_id, is_collected, collection_date, collection_month, is_clawback_triggered, first_milestone_due_date")
        .in("deal_id", dealIds);

      // Create a map of deal_id to collection data
      const collectionsMap = new Map<string, DealCollectionRow>();
      (collections || []).forEach((c) => {
        collectionsMap.set(c.deal_id, c);
      });

      // Fetch plan commissions - get all active plan commissions
      const { data: planCommissions } = await supabase
        .from("plan_commissions")
        .select("*")
        .eq("is_active", true);

      const commissionsList: PlanCommission[] = (planCommissions || []).map((pc) => ({
        commission_type: pc.commission_type,
        commission_rate_pct: pc.commission_rate_pct,
        min_threshold_usd: pc.min_threshold_usd,
        is_active: pc.is_active ?? true,
        payout_on_booking_pct: pc.payout_on_booking_pct ?? 70,
        payout_on_collection_pct: pc.payout_on_collection_pct ?? 25,
        payout_on_year_end_pct: pc.payout_on_year_end_pct ?? 5,
      }));

      // Calculate Variable Pay Attribution
      let vpAttributionMap = new Map<string, VPAttributionWithExemption>();
      
      if (canViewAll) {
        // For admin users: calculate VP for ALL employees with deals
        vpAttributionMap = await calculateVPForAllEmployees(
          filteredDeals as DealRecord[],
          selectedYear,
          fiscalYearStart,
          fiscalYearEnd
        );
      } else if (employeeId) {
        // For sales users: calculate VP for their own deals only
        const vpConfig = await fetchEmployeeVPConfig(employeeId, selectedYear);
        
        if (vpConfig && vpConfig.targetUsd > 0) {
          // Get ALL YTD deals for VP calculation (not just filtered by month)
          const { data: ytdDeals } = await supabase
            .from("deals")
            .select("id, new_software_booking_arr_usd, month_year, project_id, customer_name, sales_rep_employee_id, sales_head_employee_id, sales_engineering_employee_id, sales_engineering_head_employee_id, product_specialist_employee_id, product_specialist_head_employee_id, solution_manager_employee_id, solution_manager_head_employee_id")
            .gte("month_year", fiscalYearStart)
            .lte("month_year", fiscalYearEnd);
          
          // Filter to employee's deals
          const employeeYtdDeals = (ytdDeals || []).filter(deal =>
            PARTICIPANT_ROLES.some(role => deal[role] === employeeId)
          );
          
          // Calculate VP attributions
          const today = new Date();
          const calculationMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
          
          const vpResult = calculateDealVariablePayAttributions(
            employeeYtdDeals as DealForAttribution[],
            employeeId,
            vpConfig.metric,
            vpConfig.targetUsd,
            vpConfig.bonusAllocationUsd,
            selectedYear,
            calculationMonth
          );
          
          // Create a map for quick lookup with exemption status
          vpResult.attributions.forEach(attr => {
            vpAttributionMap.set(attr.dealId, {
              ...attr,
              isClawbackExempt: vpConfig.isClawbackExempt,
            });
          });
        }
      }

      // Enhance each deal with collection and incentive data
      const dealsWithIncentives: DealWithIncentives[] = filteredDeals.map((deal) => {
        const collection = collectionsMap.get(deal.id);
        const linkedToImpl = deal.linked_to_impl || false;
        const isCollected = collection?.is_collected ?? false;
        const isClawback = collection?.is_clawback_triggered ?? false;

        // Calculate commission incentive breakdown
        const incentiveCalc = calculateIncentiveBreakdown(
          deal as DealRecord,
          commissionsList,
          linkedToImpl
        );

        // Calculate actual paid based on collection status
        let actualPaid = incentiveCalc.totalBooking; // Always get booking portion
        if (isCollected) {
          actualPaid += incentiveCalc.totalCollection; // Add collection portion if collected
        }
        if (isClawback) {
          actualPaid = 0; // Clawback means no payout
        }

        const collectionStatus = getCollectionStatus(
          isCollected,
          isClawback,
          collection?.first_milestone_due_date ?? null
        );

        // Get VP attribution for this deal
        const vpAttr = vpAttributionMap.get(deal.id);

        return {
          ...(deal as DealRecord),
          // Collection fields
          is_collected: isCollected,
          collection_date: collection?.collection_date ?? null,
          collection_month: collection?.collection_month ?? null,
          is_clawback_triggered: isClawback,
          first_milestone_due_date: collection?.first_milestone_due_date ?? null,
          linked_to_impl: linkedToImpl,
          collection_status: collectionStatus,

          // Calculated commission incentive fields
          eligible_incentive_usd: Math.round(incentiveCalc.totalEligible * 100) / 100,
          payout_on_booking_usd: Math.round(incentiveCalc.totalBooking * 100) / 100,
          payout_on_collection_usd: Math.round(incentiveCalc.totalCollection * 100) / 100,
          payout_on_year_end_usd: Math.round(incentiveCalc.totalYearEnd * 100) / 100,
          actual_paid_usd: Math.round(actualPaid * 100) / 100,

          // Breakdown
          incentive_breakdown: incentiveCalc.breakdowns,

          // Variable Pay Attribution
          vp_proportion_pct: vpAttr?.proportionPct ?? null,
          vp_eligible_usd: vpAttr?.variablePaySplitUsd ?? null,
          vp_payout_on_booking_usd: vpAttr?.payoutOnBookingUsd ?? null,
          vp_payout_on_collection_usd: vpAttr?.payoutOnCollectionUsd ?? null,
          vp_payout_on_year_end_usd: vpAttr?.payoutOnYearEndUsd ?? null,
          vp_clawback_eligible_usd: vpAttr?.clawbackEligibleUsd ?? null,
          vp_is_clawback_exempt: vpAttr?.isClawbackExempt ?? false,
        };
      });

      return dealsWithIncentives;
    },
  });
}

/**
 * Variable Pay Summary for the deals report
 */
export interface VariablePayReportSummary {
  totalArrUsd: number;
  achievementPct: number;
  multiplier: number;
  totalVariablePayUsd: number;
  totalPayoutOnBookingUsd: number;
  totalPayoutOnCollectionUsd: number;
  totalPayoutOnYearEndUsd: number;
  pendingClawbackUsd: number;
  dealsWithVP: number;
}

/**
 * Calculate VP summary from deals
 */
export function calculateVPSummaryFromDeals(deals: DealWithIncentives[]): VariablePayReportSummary | null {
  const dealsWithVP = deals.filter(d => d.vp_eligible_usd !== null && d.vp_eligible_usd > 0);
  
  if (dealsWithVP.length === 0) return null;
  
  const totalArrUsd = deals.reduce((sum, d) => sum + (d.new_software_booking_arr_usd || 0), 0);
  const totalVpEligible = dealsWithVP.reduce((sum, d) => sum + (d.vp_eligible_usd || 0), 0);
  const totalBooking = dealsWithVP.reduce((sum, d) => sum + (d.vp_payout_on_booking_usd || 0), 0);
  const totalCollection = dealsWithVP.reduce((sum, d) => sum + (d.vp_payout_on_collection_usd || 0), 0);
  const totalYearEnd = dealsWithVP.reduce((sum, d) => sum + (d.vp_payout_on_year_end_usd || 0), 0);
  
  // Pending clawback = booking portion of pending deals (exclude clawback exempt plans)
  const pendingDeals = dealsWithVP.filter(d => 
    (d.collection_status === "Pending" || d.collection_status === "Overdue") &&
    !d.vp_is_clawback_exempt
  );
  const pendingClawback = pendingDeals.reduce((sum, d) => sum + (d.vp_clawback_eligible_usd || 0), 0);
  
  // Calculate achievement & multiplier (from first deal with data)
  // This is aggregate context - ideally we'd store this, but we can derive it
  const totalProportion = dealsWithVP.reduce((sum, d) => sum + (d.vp_proportion_pct || 0), 0);
  
  return {
    totalArrUsd,
    achievementPct: totalProportion > 0 ? Math.round(totalProportion) : 0,
    multiplier: totalVpEligible > 0 && totalArrUsd > 0 ? Math.round((totalVpEligible / totalArrUsd) * 100) / 100 : 0,
    totalVariablePayUsd: totalVpEligible,
    totalPayoutOnBookingUsd: totalBooking,
    totalPayoutOnCollectionUsd: totalCollection,
    totalPayoutOnYearEndUsd: totalYearEnd,
    pendingClawbackUsd: pendingClawback,
    dealsWithVP: dealsWithVP.length,
  };
}
