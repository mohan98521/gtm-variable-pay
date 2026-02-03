/**
 * Hook for calculating deal-level variable pay attribution
 * 
 * Calculates pro-rata variable pay for each deal based on YTD performance.
 * Uses the New Software Booking ARR metric from the employee's assigned plan.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { 
  calculateDealVariablePayAttributions,
  calculateVariablePaySummary,
  DealForAttribution,
  DealVariablePayAttribution,
  AggregateVariablePayContext,
  VariablePaySummary,
} from "@/lib/dealVariablePayAttribution";
import { PlanMetric } from "@/hooks/usePlanMetrics";

// Participant role columns to check for deal attribution
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

// Roles that can view all data
const VIEW_ALL_ROLES = ["admin", "gtm_ops", "finance", "executive"] as const;

export interface DealVPAttributionResult {
  attributions: DealVariablePayAttribution[];
  context: AggregateVariablePayContext | null;
  summary: VariablePaySummary | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetches the New Software Booking ARR metric from the employee's assigned plan
 */
async function fetchEmployeePlanMetric(
  employeeId: string,
  fiscalYear: number
): Promise<{ metric: PlanMetric; targetUsd: number; bonusAllocationUsd: number } | null> {
  // Get employee's user_target for the fiscal year
  const fiscalYearStart = `${fiscalYear}-01-01`;
  const fiscalYearEnd = `${fiscalYear}-12-31`;
  
  // First get the employee record to find auth_user_id
  const { data: employee } = await supabase
    .from("employees")
    .select("id, tvp_usd")
    .eq("employee_id", employeeId)
    .maybeSingle();
  
  if (!employee) return null;
  
  // Get user_target for this employee
  const { data: userTarget } = await supabase
    .from("user_targets")
    .select("plan_id, target_bonus_usd, effective_start_date, effective_end_date")
    .eq("user_id", employee.id)
    .gte("effective_end_date", fiscalYearStart)
    .lte("effective_start_date", fiscalYearEnd)
    .order("effective_start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (!userTarget?.plan_id) {
    // Fallback: try to find plan by employee's sales_function
    const { data: empData } = await supabase
      .from("employees")
      .select("sales_function")
      .eq("employee_id", employeeId)
      .maybeSingle();
    
    if (!empData?.sales_function) return null;
    
    // Map sales_function to plan name
    const planNameMap: Record<string, string> = {
      "Farming": "Farmer",
      "Hunting": "Hunter",
      "Overlay": "Overlay",
    };
    const planName = planNameMap[empData.sales_function];
    if (!planName) return null;
    
    // Get plan by name and year
    const { data: plan } = await supabase
      .from("comp_plans")
      .select("id")
      .eq("name", planName)
      .eq("effective_year", fiscalYear)
      .eq("is_active", true)
      .maybeSingle();
    
    if (!plan) return null;
    
    // Get plan metrics
    const { data: metrics } = await supabase
      .from("plan_metrics")
      .select("*")
      .eq("plan_id", plan.id);
    
    if (!metrics?.length) return null;
    
    // Find New Software Booking ARR metric
    const arrMetric = metrics.find(m => 
      m.metric_name === "New Software Booking ARR" || 
      m.metric_name.toLowerCase().includes("new software") ||
      m.metric_name.toLowerCase().includes("booking arr")
    );
    
    if (!arrMetric) return null;
    
    // Get multiplier grids
    const { data: grids } = await supabase
      .from("multiplier_grids")
      .select("*")
      .eq("plan_metric_id", arrMetric.id)
      .order("min_pct");
    
    // Get target from performance_targets
    const { data: perfTarget } = await supabase
      .from("performance_targets")
      .select("target_value_usd")
      .eq("employee_id", employeeId)
      .eq("effective_year", fiscalYear)
      .eq("metric_type", "New Software Booking ARR")
      .maybeSingle();
    
    const tvpUsd = employee.tvp_usd || 0;
    const bonusAllocation = (tvpUsd * arrMetric.weightage_percent) / 100;
    
    return {
      metric: {
        ...arrMetric,
        multiplier_grids: grids || [],
      } as PlanMetric,
      targetUsd: perfTarget?.target_value_usd || 0,
      bonusAllocationUsd: bonusAllocation,
    };
  }
  
  // Get plan metrics for the assigned plan
  const { data: metrics } = await supabase
    .from("plan_metrics")
    .select("*")
    .eq("plan_id", userTarget.plan_id);
  
  if (!metrics?.length) return null;
  
  // Find New Software Booking ARR metric
  const arrMetric = metrics.find(m => 
    m.metric_name === "New Software Booking ARR" || 
    m.metric_name.toLowerCase().includes("new software") ||
    m.metric_name.toLowerCase().includes("booking arr")
  );
  
  if (!arrMetric) return null;
  
  // Get multiplier grids
  const { data: grids } = await supabase
    .from("multiplier_grids")
    .select("*")
    .eq("plan_metric_id", arrMetric.id)
    .order("min_pct");
  
  // Get target from performance_targets
  const { data: perfTarget } = await supabase
    .from("performance_targets")
    .select("target_value_usd")
    .eq("employee_id", employeeId)
    .eq("effective_year", fiscalYear)
    .eq("metric_type", "New Software Booking ARR")
    .maybeSingle();
  
  // Calculate bonus allocation: TVP × weightage
  const tvpUsd = userTarget.target_bonus_usd || employee.tvp_usd || 0;
  const bonusAllocation = (tvpUsd * arrMetric.weightage_percent) / 100;
  
  return {
    metric: {
      ...arrMetric,
      multiplier_grids: grids || [],
    } as PlanMetric,
    targetUsd: perfTarget?.target_value_usd || 0,
    bonusAllocationUsd: bonusAllocation,
  };
}

/**
 * Hook to calculate deal-level variable pay attribution for the current user
 */
export function useDealVariablePayAttribution() {
  const { selectedYear } = useFiscalYear();
  
  return useQuery({
    queryKey: ["deal_variable_pay_attribution", selectedYear],
    queryFn: async (): Promise<{
      attributions: DealVariablePayAttribution[];
      context: AggregateVariablePayContext | null;
      summary: VariablePaySummary | null;
    }> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { attributions: [], context: null, summary: null };
      }
      
      // Get user's employee_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("employee_id")
        .eq("id", user.id)
        .maybeSingle();
      
      if (!profile?.employee_id) {
        return { attributions: [], context: null, summary: null };
      }
      
      const employeeId = profile.employee_id;
      
      // Fetch plan metric configuration
      const planConfig = await fetchEmployeePlanMetric(employeeId, selectedYear);
      
      if (!planConfig || planConfig.targetUsd === 0) {
        return { attributions: [], context: null, summary: null };
      }
      
      // Fetch YTD deals where employee is a participant
      const fiscalYearStart = `${selectedYear}-01-01`;
      const fiscalYearEnd = `${selectedYear}-12-31`;
      
      const { data: deals, error: dealsError } = await supabase
        .from("deals")
        .select("id, new_software_booking_arr_usd, month_year, project_id, customer_name, sales_rep_employee_id, sales_head_employee_id, sales_engineering_employee_id, sales_engineering_head_employee_id, product_specialist_employee_id, product_specialist_head_employee_id, solution_manager_employee_id, solution_manager_head_employee_id")
        .gte("month_year", fiscalYearStart)
        .lte("month_year", fiscalYearEnd);
      
      if (dealsError) throw dealsError;
      
      // Filter deals where this employee is a participant
      const employeeDeals = (deals || []).filter(deal => 
        PARTICIPANT_ROLES.some(role => deal[role] === employeeId)
      );
      
      // Get current month for calculation_month
      const today = new Date();
      const calculationMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      
      // Calculate attributions
      const result = calculateDealVariablePayAttributions(
        employeeDeals as DealForAttribution[],
        employeeId,
        planConfig.metric,
        planConfig.targetUsd,
        planConfig.bonusAllocationUsd,
        selectedYear,
        calculationMonth
      );
      
      const summary = result.attributions.length > 0 
        ? calculateVariablePaySummary(result.attributions, result.context)
        : null;
      
      return {
        attributions: result.attributions,
        context: result.context,
        summary,
      };
    },
  });
}

/**
 * Hook to get variable pay attribution for a specific deal
 */
export function useDealVariablePayForDeal(dealId: string | undefined) {
  const { data: allAttributions } = useDealVariablePayAttribution();
  
  if (!dealId || !allAttributions?.attributions) {
    return null;
  }
  
  return allAttributions.attributions.find(a => a.dealId === dealId) || null;
}
