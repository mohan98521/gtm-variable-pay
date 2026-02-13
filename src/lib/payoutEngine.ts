/**
 * Payout Calculation Engine
 * 
 * Core calculation engine for payout runs that:
 * - Validates prerequisites (exchange rates, employee data)
 * - Calculates Variable Pay with compensation rate conversion
 * - Calculates Commissions with market rate conversion
 * - Handles linked_to_impl override (0/100/0)
 * - Handles clawback-exempt plans (merge booking+collection)
 * - Calculates incremental monthly VP (YTD minus prior months)
 * - Releases collection amounts for deals collected this month
 * - Releases year-end reserves in December
 * - Orchestrates batch calculations for all employees
 */

import { supabase } from "@/integrations/supabase/client";
import { PlanMetric } from "@/hooks/usePlanMetrics";
import { PlanCommission } from "./commissions";
import { 
  calculateDealVariablePayAttributions, 
  DealForAttribution,
  DealVariablePayAttribution,
  AggregateVariablePayContext 
} from "./dealVariablePayAttribution";
import { calculateDealCommission, calculateTotalCommission, CommissionCalculation } from "./commissions";
import { calculateNRRPayout, NRRDeal, NRRCalculationResult } from "./nrrCalculation";
import { calculateAllSpiffs, SpiffConfig, SpiffDeal, SpiffMetric, SpiffDealBreakdown } from "./spiffCalculation";

// ============= HELPERS =============

function ensureFullDate(monthYear: string): string {
  return monthYear.length === 7 ? monthYear + '-01' : monthYear;
}

// ============= TYPE DEFINITIONS =============

export interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  local_currency: string;
  compensation_exchange_rate: number | null;
  tvp_usd: number | null;
  is_active: boolean;
  sales_function: string | null;
}

export interface PayoutRunValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'missing_compensation_rate' | 'missing_market_rate' | 'month_locked' | 'no_employees';
  message: string;
  details?: string[];
}

export interface ValidationWarning {
  type: 'missing_plan_assignment' | 'no_targets' | 'incomplete_data';
  message: string;
  details?: string[];
}

export interface EmployeePayoutResult {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  localCurrency: string;
  
  // Variable Pay
  variablePayUsd: number;
  variablePayLocal: number;
  vpCompensationRate: number;
  vpBookingUsd: number;
  vpBookingLocal: number;
  vpCollectionUsd: number;
  vpCollectionLocal: number;
  vpYearEndUsd: number;
  vpYearEndLocal: number;
  
  // Commissions
  commissionsUsd: number;
  commissionsLocal: number;
  commissionMarketRate: number;
  commBookingUsd: number;
  commBookingLocal: number;
  commCollectionUsd: number;
  commCollectionLocal: number;
  commYearEndUsd: number;
  commYearEndLocal: number;
  
  // Collection Releases
  collectionReleasesUsd: number;
  collectionReleasesLocal: number;
  collectionReleaseNotes: string;
  
  // Year-End Releases (December only)
  yearEndReleasesUsd: number;
  yearEndReleasesLocal: number;

  // NRR Additional Pay
  nrrPayoutUsd: number;
  nrrPayoutLocal: number;
  nrrResult: NRRCalculationResult | null;
  nrrBookingPct: number;
  nrrCollectionPct: number;
  nrrYearEndPct: number;
  
  // SPIFFs
  spiffPayoutUsd: number;
  spiffPayoutLocal: number;
  spiffBreakdowns: SpiffDealBreakdown[];
  spiffBookingPct: number;
  spiffCollectionPct: number;
  spiffYearEndPct: number;
  
  // Deal Team SPIFFs (manual allocation)
  dealTeamSpiffUsd: number;
  dealTeamSpiffLocal: number;
  
  // Totals
  totalPayoutUsd: number;
  totalPayoutLocal: number;
  totalBookingUsd: number;
  totalBookingLocal: number;
  payableThisMonthUsd: number;
  payableThisMonthLocal: number;
  
  // Context
  planId: string | null;
  planName: string | null;
  dealsCount: number;
  
  // Detail breakdowns for persistence
  vpAttributions: DealVariablePayAttribution[];
  commissionCalculations: CommissionCalculation[];
}

export interface PayoutRunResult {
  runId: string;
  monthYear: string;
  calculatedAt: string;
  totalEmployees: number;
  totalPayoutUsd: number;
  totalVariablePayUsd: number;
  totalCommissionsUsd: number;
  employeePayouts: EmployeePayoutResult[];
}

// ============= VALIDATION FUNCTIONS =============

/**
 * Validate prerequisites before running payout calculation
 */
export async function validatePayoutRunPrerequisites(
  monthYear: string
): Promise<PayoutRunValidation> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // 1. Check if month is already locked
  const { data: existingRun } = await supabase
    .from('payout_runs')
    .select('id, run_status, is_locked')
    .eq('month_year', monthYear.length === 7 ? monthYear + '-01' : monthYear)
    .maybeSingle();
  
  if (existingRun?.is_locked) {
    errors.push({
      type: 'month_locked',
      message: `Month ${monthYear} is already finalized and locked`,
    });
  }
  
  // 2. Fetch all active employees
  const { data: employees } = await supabase
    .from('employees')
    .select('id, employee_id, full_name, local_currency, compensation_exchange_rate')
    .eq('is_active', true);
  
  if (!employees || employees.length === 0) {
    errors.push({
      type: 'no_employees',
      message: 'No active employees found',
    });
    return { isValid: false, errors, warnings };
  }
  
  // 3. Check compensation rates for all employees
  const missingCompRates = employees.filter(e => 
    e.local_currency !== 'USD' && !e.compensation_exchange_rate
  );
  
  if (missingCompRates.length > 0) {
    errors.push({
      type: 'missing_compensation_rate',
      message: `${missingCompRates.length} employee(s) missing compensation exchange rate`,
      details: missingCompRates.map(e => `${e.full_name} (${e.local_currency})`),
    });
  }
  
  // 4. Check market rates for all non-USD currencies
  const currencies = [...new Set(employees.map(e => e.local_currency).filter(c => c !== 'USD'))];
  
  if (currencies.length > 0) {
    const { data: rates } = await supabase
      .from('exchange_rates')
      .select('currency_code')
      .eq('month_year', monthYear.length === 7 ? monthYear + '-01' : monthYear)
    .in('currency_code', currencies);
    
    const existingCurrencies = new Set(rates?.map(r => r.currency_code) || []);
    const missingRates = currencies.filter(c => !existingCurrencies.has(c));
    
    if (missingRates.length > 0) {
      errors.push({
        type: 'missing_market_rate',
        message: `Missing market exchange rates for ${monthYear}`,
        details: missingRates,
      });
    }
  }
  
  // 5. Check plan assignments (warning only)
  const { data: targets } = await supabase
    .from('user_targets')
    .select('user_id')
    .lte('effective_start_date', ensureFullDate(monthYear))
    .gte('effective_end_date', ensureFullDate(monthYear));
  
  const employeeIdsWithTargets = new Set(targets?.map(t => t.user_id) || []);
  const employeesWithoutTargets = employees.filter(e => !employeeIdsWithTargets.has(e.id));
  
  if (employeesWithoutTargets.length > 0) {
    warnings.push({
      type: 'missing_plan_assignment',
      message: `${employeesWithoutTargets.length} employee(s) without plan assignments will be skipped`,
      details: employeesWithoutTargets.map(e => e.full_name),
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============= EXCHANGE RATE HELPERS =============

/**
 * Get market exchange rate for a currency and month
 */
async function getMarketExchangeRate(
  currencyCode: string,
  monthYear: string
): Promise<number> {
  if (currencyCode === 'USD') return 1;
  
  const { data } = await supabase
    .from('exchange_rates')
    .select('rate_to_usd')
    .eq('currency_code', currencyCode)
    .eq('month_year', ensureFullDate(monthYear))
    .maybeSingle();
  
  return data?.rate_to_usd ?? 1;
}

/**
 * Convert USD to local currency using compensation rate (for VP)
 */
function convertVPToLocal(amountUsd: number, compensationRate: number | null): number {
  const rate = compensationRate ?? 1;
  return amountUsd * rate;
}

/**
 * Convert USD to local currency using market rate (for commissions)
 */
function convertCommissionToLocal(amountUsd: number, marketRate: number): number {
  return amountUsd * marketRate;
}

// ============= EMPLOYEE PAYOUT CALCULATION =============

interface EmployeeCalculationContext {
  employee: Employee;
  monthYear: string;
  fiscalYear: number;
  planId: string;
  planName: string;
  metrics: PlanMetric[];
  commissions: PlanCommission[];
  targetBonusUsd: number;
  marketRate: number;
  isClawbackExempt: boolean;
}

/**
 * Get sum of prior months' VP for incremental calculation
 */
async function getPriorMonthsVp(
  employeeId: string,
  fiscalYear: number,
  currentMonthYear: string
): Promise<number> {
  const { data } = await supabase
    .from('monthly_payouts')
    .select('calculated_amount_usd')
    .eq('employee_id', employeeId)
    .eq('payout_type', 'Variable Pay')
    .gte('month_year', `${fiscalYear}-01-01`)
    .lt('month_year', ensureFullDate(currentMonthYear))
    .not('payout_run_id', 'is', null);
  
  return (data || []).reduce((sum, p) => sum + (p.calculated_amount_usd || 0), 0);
}

/**
 * Calculate Variable Pay for a single employee
 */
async function calculateEmployeeVariablePay(
  ctx: EmployeeCalculationContext
): Promise<{
  totalVpUsd: number;
  bookingUsd: number;
  collectionUsd: number;
  yearEndUsd: number;
  attributions: DealVariablePayAttribution[];
  vpContext: AggregateVariablePayContext | null;
}> {
  if (ctx.metrics.length === 0) {
    return { totalVpUsd: 0, bookingUsd: 0, collectionUsd: 0, yearEndUsd: 0, attributions: [], vpContext: null };
  }

  const empId = ctx.employee.employee_id;
  const participantOrFilter = `sales_rep_employee_id.eq.${empId},sales_head_employee_id.eq.${empId},sales_engineering_employee_id.eq.${empId},sales_engineering_head_employee_id.eq.${empId},product_specialist_employee_id.eq.${empId},product_specialist_head_employee_id.eq.${empId},solution_manager_employee_id.eq.${empId},solution_manager_head_employee_id.eq.${empId}`;

  let ytdVpUsd = 0;
  let ytdBookingUsd = 0;
  let ytdCollectionUsd = 0;
  let ytdYearEndUsd = 0;
  let allAttributions: DealVariablePayAttribution[] = [];
  let lastContext: AggregateVariablePayContext | null = null;

  // Iterate over ALL plan metrics (e.g., "New Software Booking ARR" + "Closing ARR")
  for (const metric of ctx.metrics) {
    // Get employee's target for this metric
    const { data: perfTarget } = await supabase
      .from('performance_targets')
      .select('target_value_usd')
      .eq('employee_id', empId)
      .eq('effective_year', ctx.fiscalYear)
      .eq('metric_type', metric.metric_name)
      .maybeSingle();

    const targetUsd = perfTarget?.target_value_usd ?? 0;
    if (targetUsd === 0) continue;

    const bonusAllocationUsd = (ctx.targetBonusUsd * metric.weightage_percent) / 100;

    // Determine actuals based on metric type
    const isClosingArr = metric.metric_name.toLowerCase().includes('closing arr');
    const isTeamMetric = metric.metric_name.startsWith("Team ");
    const isOrgMetric = metric.metric_name.startsWith("Org ");

    // Get payout split percentages from metric config
    const bookingPct = metric.payout_on_booking_pct ?? 0;
    const collectionPct = metric.payout_on_collection_pct ?? 100;
    const yearEndPct = metric.payout_on_year_end_pct ?? 0;

    // For "Team " prefix metrics, fetch subordinate employee IDs
    let teamReportIds: string[] = [];
    if (isTeamMetric) {
      const { data: subReports } = await supabase
        .from('employees')
        .select('employee_id')
        .eq('manager_employee_id', empId)
        .eq('is_active', true);
      teamReportIds = (subReports || []).map(e => e.employee_id);
    }

    if (isClosingArr) {
      // Closing ARR: fetch from closing_arr_actuals table (latest month snapshot, eligible only)
      // For Team Leads with team metrics: include subordinate records for combined portfolio
      let closingArrOrFilter = `sales_rep_employee_id.eq.${empId},sales_head_employee_id.eq.${empId}`;
      
      // Check if this employee is a Team Lead — extend Closing ARR to include team
      const isTeamLead = (ctx.employee.sales_function || "").startsWith("Team Lead");
      if (isTeamLead && ctx.metrics.some(m => m.metric_name.startsWith("Team "))) {
        // Fetch sub-reports if not already fetched
        let tlReportIds = teamReportIds;
        if (tlReportIds.length === 0) {
          const { data: subReports } = await supabase
            .from('employees')
            .select('employee_id')
            .eq('manager_employee_id', empId)
            .eq('is_active', true);
          tlReportIds = (subReports || []).map(e => e.employee_id);
        }
        tlReportIds.forEach(rid => {
          closingArrOrFilter += `,sales_rep_employee_id.eq.${rid},sales_head_employee_id.eq.${rid}`;
        });
      }

      const { data: closingArr } = await supabase
        .from('closing_arr_actuals')
        .select('month_year, closing_arr, end_date, is_multi_year, renewal_years')
        .or(closingArrOrFilter)
        .gte('month_year', `${ctx.fiscalYear}-01-01`)
        .lte('month_year', ctx.monthYear)
        .gt('end_date', `${ctx.fiscalYear}-12-31`);

      // Fetch renewal multipliers for the current plan
      const { data: renewalMultipliers } = await supabase
        .from('closing_arr_renewal_multipliers' as any)
        .select('*')
        .eq('plan_id', ctx.planId)
        .order('min_years');

      const multiplierTiers = (renewalMultipliers || []) as any[];

      // Helper to find matching multiplier
      const findMultiplier = (years: number): number => {
        for (const m of multiplierTiers) {
          if (years >= m.min_years && (m.max_years === null || years <= m.max_years)) {
            return m.multiplier_value;
          }
        }
        return 1.0;
      };

      // Group by month and use the latest month snapshot, applying renewal multipliers
      const closingByMonth = new Map<string, number>();
      (closingArr || []).forEach((arr: any) => {
        const monthKey = arr.month_year?.substring(0, 7) || '';
        let value = arr.closing_arr || 0;
        // Apply renewal multiplier if multi-year
        if (arr.is_multi_year && arr.renewal_years > 0) {
          value = value * findMultiplier(arr.renewal_years);
        }
        closingByMonth.set(monthKey, (closingByMonth.get(monthKey) || 0) + value);
      });

      const sortedMonths = Array.from(closingByMonth.keys()).sort();
      const latestMonth = sortedMonths[sortedMonths.length - 1];
      const totalActualUsd = latestMonth ? closingByMonth.get(latestMonth) || 0 : 0;

      if (totalActualUsd === 0) continue;

      // Use the aggregate VP calculation (no per-deal attribution for Closing ARR)
      const { calculateAggregateVariablePay } = await import('./dealVariablePayAttribution');
      const vpCalc = calculateAggregateVariablePay(totalActualUsd, targetUsd, bonusAllocationUsd, metric);

      ytdVpUsd += vpCalc.totalVariablePay;
      ytdBookingUsd += vpCalc.totalVariablePay * (bookingPct / 100);
      ytdCollectionUsd += vpCalc.totalVariablePay * (collectionPct / 100);
      ytdYearEndUsd += vpCalc.totalVariablePay * (yearEndPct / 100);

      lastContext = {
        totalActualUsd,
        targetUsd,
        achievementPct: Math.round(vpCalc.achievementPct * 100) / 100,
        multiplier: vpCalc.multiplier,
        bonusAllocationUsd,
        totalVariablePayUsd: Math.round(vpCalc.totalVariablePay * 100) / 100,
        metricName: metric.metric_name,
        fiscalYear: ctx.fiscalYear,
        calculationMonth: ensureFullDate(ctx.monthYear),
      };
    } else {
      // Deal-based metric (New Software Booking ARR, Team, or Org)
      let dealsQuery;

      if (isOrgMetric) {
        // "Org " metrics: fetch ALL deals without any participant filter
        dealsQuery = supabase
          .from('deals')
          .select('id, new_software_booking_arr_usd, month_year, project_id, customer_name')
          .gte('month_year', `${ctx.fiscalYear}-01-01`)
          .lte('month_year', ctx.monthYear);
      } else if (isTeamMetric && teamReportIds.length > 0) {
        // "Team " metrics: fetch subordinates' deals
        const parts: string[] = [];
        teamReportIds.forEach(rid => {
          parts.push(`sales_rep_employee_id.eq.${rid},sales_head_employee_id.eq.${rid},sales_engineering_employee_id.eq.${rid},sales_engineering_head_employee_id.eq.${rid},product_specialist_employee_id.eq.${rid},product_specialist_head_employee_id.eq.${rid},solution_manager_employee_id.eq.${rid},solution_manager_head_employee_id.eq.${rid}`);
        });
        dealsQuery = supabase
          .from('deals')
          .select('id, new_software_booking_arr_usd, month_year, project_id, customer_name')
          .or(parts.join(','))
          .gte('month_year', `${ctx.fiscalYear}-01-01`)
          .lte('month_year', ctx.monthYear);
      } else {
        dealsQuery = supabase
          .from('deals')
          .select('id, new_software_booking_arr_usd, month_year, project_id, customer_name')
          .or(participantOrFilter)
          .gte('month_year', `${ctx.fiscalYear}-01-01`)
          .lte('month_year', ctx.monthYear);
      }

      const { data: deals } = await dealsQuery;

      const validDeals: DealForAttribution[] = (deals || []).map(d => ({
        id: d.id,
        new_software_booking_arr_usd: d.new_software_booking_arr_usd,
        month_year: d.month_year,
        project_id: d.project_id,
        customer_name: d.customer_name,
      }));

      const result = calculateDealVariablePayAttributions(
        validDeals,
        ctx.employee.id,
        metric,
        targetUsd,
        bonusAllocationUsd,
        ctx.fiscalYear,
        ensureFullDate(ctx.monthYear)
      );

      ytdVpUsd += result.context.totalVariablePayUsd;
      ytdBookingUsd += result.attributions.reduce((sum, a) => sum + a.payoutOnBookingUsd, 0);
      ytdCollectionUsd += result.attributions.reduce((sum, a) => sum + a.payoutOnCollectionUsd, 0);
      ytdYearEndUsd += result.attributions.reduce((sum, a) => sum + a.payoutOnYearEndUsd, 0);
      allAttributions = allAttributions.concat(result.attributions);
      lastContext = result.context;
    }
  }

  // Calculate incremental VP (subtract prior months)
  const priorVp = await getPriorMonthsVp(ctx.employee.id, ctx.fiscalYear, ctx.monthYear);
  const monthlyVpUsd = Math.max(0, ytdVpUsd - priorVp);
  
  // Scale splits proportionally to the monthly increment
  const vpRatio = ytdVpUsd > 0 ? monthlyVpUsd / ytdVpUsd : 0;
  let monthlyBookingUsd = ytdBookingUsd * vpRatio;
  let monthlyCollectionUsd = ytdCollectionUsd * vpRatio;
  let monthlyYearEndUsd = ytdYearEndUsd * vpRatio;

  // For clawback-exempt plans, merge booking + collection into immediate booking
  if (ctx.isClawbackExempt) {
    monthlyBookingUsd = monthlyBookingUsd + monthlyCollectionUsd;
    monthlyCollectionUsd = 0;
  }

  return {
    totalVpUsd: monthlyVpUsd,
    bookingUsd: monthlyBookingUsd,
    collectionUsd: monthlyCollectionUsd,
    yearEndUsd: monthlyYearEndUsd,
    attributions: allAttributions,
    vpContext: lastContext,
  };
}

/**
 * Calculate Commissions for a single employee
 */
async function calculateEmployeeCommissions(
  ctx: EmployeeCalculationContext
): Promise<{
  totalCommUsd: number;
  bookingUsd: number;
  collectionUsd: number;
  yearEndUsd: number;
  calculations: CommissionCalculation[];
}> {
  if (ctx.commissions.length === 0) {
    return { totalCommUsd: 0, bookingUsd: 0, collectionUsd: 0, yearEndUsd: 0, calculations: [] };
  }
  
  // Get deals for this month that qualify for commissions (all 8 participant roles)
  // Include linked_to_impl flag for override logic
  const empId = ctx.employee.employee_id;
  const { data: deals } = await supabase
    .from('deals')
    .select('id, tcv_usd, perpetual_license_usd, managed_services_usd, implementation_usd, cr_usd, er_usd, linked_to_impl')
    .or(`sales_rep_employee_id.eq.${empId},sales_head_employee_id.eq.${empId},sales_engineering_employee_id.eq.${empId},sales_engineering_head_employee_id.eq.${empId},product_specialist_employee_id.eq.${empId},product_specialist_head_employee_id.eq.${empId},solution_manager_employee_id.eq.${empId},solution_manager_head_employee_id.eq.${empId}`)
    .eq('month_year', ctx.monthYear);
  
  const calculations: CommissionCalculation[] = [];
  
  for (const deal of deals || []) {
    const isLinkedToImpl = deal.linked_to_impl === true;
    
    // Helper to get split values, respecting linked_to_impl override and clawback exemption
    const getSplits = (comm: PlanCommission) => {
      if (isLinkedToImpl) {
        return { booking: 0, collection: 100, yearEnd: 0 };
      }
      let booking = comm.payout_on_booking_pct ?? 0;
      let collection = comm.payout_on_collection_pct ?? 100;
      const yearEnd = comm.payout_on_year_end_pct ?? 0;
      
      // For clawback-exempt plans, merge booking + collection into immediate booking
      if (ctx.isClawbackExempt) {
        booking = booking + collection;
        collection = 0;
      }
      
      return { booking, collection, yearEnd };
    };

    // Perpetual License
    if (deal.perpetual_license_usd && deal.perpetual_license_usd > 0) {
      const comm = ctx.commissions.find(c => c.commission_type === 'Perpetual License' && c.is_active);
      if (comm) {
        const splits = getSplits(comm);
        const result = calculateDealCommission(
          deal.perpetual_license_usd,
          comm.commission_rate_pct,
          comm.min_threshold_usd,
          splits.booking,
          splits.collection,
          splits.yearEnd
        );
        calculations.push({
          dealId: deal.id,
          commissionType: 'Perpetual License',
          tcvUsd: deal.perpetual_license_usd,
          commissionRatePct: comm.commission_rate_pct,
          minThresholdUsd: comm.min_threshold_usd,
          qualifies: result.qualifies,
          grossCommission: result.gross,
          paidAmount: result.paid,
          holdbackAmount: result.holdback,
          yearEndHoldback: result.yearEndHoldback,
        });
      }
    }
    
    // Managed Services
    if (deal.managed_services_usd && deal.managed_services_usd > 0) {
      const comm = ctx.commissions.find(c => c.commission_type === 'Managed Services' && c.is_active);
      if (comm) {
        const splits = getSplits(comm);
        const result = calculateDealCommission(
          deal.managed_services_usd,
          comm.commission_rate_pct,
          comm.min_threshold_usd,
          splits.booking,
          splits.collection,
          splits.yearEnd
        );
        calculations.push({
          dealId: deal.id,
          commissionType: 'Managed Services',
          tcvUsd: deal.managed_services_usd,
          commissionRatePct: comm.commission_rate_pct,
          minThresholdUsd: comm.min_threshold_usd,
          qualifies: result.qualifies,
          grossCommission: result.gross,
          paidAmount: result.paid,
          holdbackAmount: result.holdback,
          yearEndHoldback: result.yearEndHoldback,
        });
      }
    }
    
    // Implementation
    if (deal.implementation_usd && deal.implementation_usd > 0) {
      const comm = ctx.commissions.find(c => c.commission_type === 'Implementation' && c.is_active);
      if (comm) {
        const splits = getSplits(comm);
        const result = calculateDealCommission(
          deal.implementation_usd,
          comm.commission_rate_pct,
          comm.min_threshold_usd,
          splits.booking,
          splits.collection,
          splits.yearEnd
        );
        calculations.push({
          dealId: deal.id,
          commissionType: 'Implementation',
          tcvUsd: deal.implementation_usd,
          commissionRatePct: comm.commission_rate_pct,
          minThresholdUsd: comm.min_threshold_usd,
          qualifies: result.qualifies,
          grossCommission: result.gross,
          paidAmount: result.paid,
          holdbackAmount: result.holdback,
          yearEndHoldback: result.yearEndHoldback,
        });
      }
    }
    
    // CR/ER combined
    const crErUsd = (deal.cr_usd || 0) + (deal.er_usd || 0);
    if (crErUsd > 0) {
      const comm = ctx.commissions.find(c => c.commission_type === 'CR/ER' && c.is_active);
      if (comm) {
        const splits = getSplits(comm);
        const result = calculateDealCommission(
          crErUsd,
          comm.commission_rate_pct,
          comm.min_threshold_usd,
          splits.booking,
          splits.collection,
          splits.yearEnd
        );
        calculations.push({
          dealId: deal.id,
          commissionType: 'CR/ER',
          tcvUsd: crErUsd,
          commissionRatePct: comm.commission_rate_pct,
          minThresholdUsd: comm.min_threshold_usd,
          qualifies: result.qualifies,
          grossCommission: result.gross,
          paidAmount: result.paid,
          holdbackAmount: result.holdback,
          yearEndHoldback: result.yearEndHoldback,
        });
      }
    }
  }
  
  const totals = calculateTotalCommission(calculations.filter(c => c.qualifies));
  
  return {
    totalCommUsd: totals.totalGross,
    bookingUsd: totals.totalPaid,
    collectionUsd: totals.totalHoldback,
    yearEndUsd: totals.totalYearEndHoldback,
    calculations,
  };
}

// ============= COLLECTION RELEASES =============

/**
 * Calculate collection releases for deals collected in the current month.
 * Looks up VP attributions and commission holdbacks from prior months.
 */
async function calculateCollectionReleases(
  employeeId: string,
  employeeCode: string,
  monthYear: string,
  fiscalYear: number
): Promise<{ vpReleaseUsd: number; commReleaseUsd: number; clawbackReversedDealIds: string[] }> {
  // Find deals collected this month
  const { data: collections } = await supabase
    .from('deal_collections')
    .select('deal_id')
    .eq('collection_month', ensureFullDate(monthYear))
    .eq('is_collected', true);
  
  if (!collections || collections.length === 0) {
    return { vpReleaseUsd: 0, commReleaseUsd: 0, clawbackReversedDealIds: [] };
  }
  
  const collectedDealIds = collections.map(c => c.deal_id);
  
  // VP releases: check clawback status to determine release amount
  // For clawback-triggered deals: release full variable_pay_split_usd (100%)
  // For normal deals: release payout_on_collection_usd only
  const { data: vpAttrs } = await supabase
    .from('deal_variable_pay_attribution')
    .select('deal_id, payout_on_collection_usd, variable_pay_split_usd, is_clawback_triggered')
    .eq('employee_id', employeeId)
    .eq('fiscal_year', fiscalYear)
    .in('deal_id', collectedDealIds);
  
  const vpReleaseUsd = (vpAttrs || []).reduce((sum, a) => {
    if (a.is_clawback_triggered) {
      // Full release: deal becomes 100% payable upon collection after clawback
      return sum + (a.variable_pay_split_usd || 0);
    }
    return sum + (a.payout_on_collection_usd || 0);
  }, 0);
  
  // Resolve clawback ledger entries for clawback-triggered deals that are now collected
  const clawbackTriggeredDealIds = (vpAttrs || [])
    .filter(a => a.is_clawback_triggered)
    .map(a => a.deal_id);
  
  if (clawbackTriggeredDealIds.length > 0) {
    const { data: ledgerEntries } = await supabase
      .from('clawback_ledger')
      .select('id, original_amount_usd')
      .eq('employee_id', employeeId)
      .in('deal_id', clawbackTriggeredDealIds)
      .in('status', ['pending', 'partial']);
    
    for (const entry of (ledgerEntries || [])) {
      await supabase
        .from('clawback_ledger')
        .update({
          status: 'recovered',
          recovered_amount_usd: entry.original_amount_usd,
          last_recovery_month: ensureFullDate(monthYear),
          updated_at: new Date().toISOString(),
        })
        .eq('id', entry.id);
    }
  }
  
  // Commission releases: sum collection_amount_usd from monthly_payouts for collected deals
  const { data: commPayouts } = await supabase
    .from('monthly_payouts')
    .select('collection_amount_usd')
    .eq('employee_id', employeeId)
    .neq('payout_type', 'Variable Pay')
    .neq('payout_type', 'Clawback')
    .neq('payout_type', 'Collection Release')
    .neq('payout_type', 'Year-End Release')
    .in('deal_id', collectedDealIds);
  
  const commReleaseUsd = (commPayouts || []).reduce((sum, p) => sum + (p.collection_amount_usd || 0), 0);
  
  return { vpReleaseUsd, commReleaseUsd, clawbackReversedDealIds: clawbackTriggeredDealIds };
}

// ============= YEAR-END RELEASES (DECEMBER) =============

/**
 * Calculate year-end releases for December payout run.
 * Sums all year_end_amount_usd from monthly_payouts in the fiscal year.
 */
async function calculateYearEndReleases(
  employeeId: string,
  fiscalYear: number
): Promise<number> {
  const { data } = await supabase
    .from('monthly_payouts')
    .select('year_end_amount_usd')
    .eq('employee_id', employeeId)
    .gte('month_year', `${fiscalYear}-01-01`)
    .lte('month_year', `${fiscalYear}-12-01`)
    .neq('payout_type', 'Year-End Release')
    .not('year_end_amount_usd', 'is', null);
  
  return (data || []).reduce((sum, p) => sum + (p.year_end_amount_usd || 0), 0);
}

/**
 * Calculate full monthly payout for a single employee
 */
export async function calculateMonthlyPayout(
  employee: Employee,
  monthYear: string
): Promise<EmployeePayoutResult | null> {
  const fiscalYear = parseInt(monthYear.substring(0, 4));
  const currentMonth = parseInt(monthYear.substring(5, 7));
  const isDecember = currentMonth === 12;
  
  // Get employee's plan assignment
  const { data: target } = await supabase
    .from('user_targets')
    .select(`
      plan_id,
      target_bonus_usd,
      comp_plans (id, name, is_clawback_exempt, nrr_ote_percent, cr_er_min_gp_margin_pct, impl_min_gp_margin_pct)
    `)
    .eq('user_id', employee.id)
    .lte('effective_start_date', ensureFullDate(monthYear))
    .gte('effective_end_date', ensureFullDate(monthYear))
    .maybeSingle();
  
  if (!target) {
    return null; // No plan assignment for this period
  }
  
  const planId = target.plan_id;
  const planData = target.comp_plans as any;
  const planName = planData?.name || 'Unknown Plan';
  const isClawbackExempt = planData?.is_clawback_exempt === true;
  const targetBonusUsd = target.target_bonus_usd ?? employee.tvp_usd ?? 0;
  
  // Get plan metrics with multiplier grids
  const { data: metrics } = await supabase
    .from('plan_metrics')
    .select(`
      *,
      multiplier_grids (*)
    `)
    .eq('plan_id', planId);
  
  // Get plan commissions
  const { data: commissions } = await supabase
    .from('plan_commissions')
    .select('*')
    .eq('plan_id', planId);
  
  // Get market rate for commissions
  const marketRate = await getMarketExchangeRate(employee.local_currency, monthYear);
  const compensationRate = employee.compensation_exchange_rate ?? 1;
  
  const ctx: EmployeeCalculationContext = {
    employee,
    monthYear,
    fiscalYear,
    planId,
    planName,
    metrics: (metrics || []) as unknown as PlanMetric[],
    commissions: (commissions || []) as unknown as PlanCommission[],
    targetBonusUsd,
    marketRate,
    isClawbackExempt,
  };
  
  // Calculate VP (now returns incremental monthly amount)
  const vpResult = await calculateEmployeeVariablePay(ctx);
  
  // Calculate Commissions
  const commResult = await calculateEmployeeCommissions(ctx);
  
  // Calculate Collection Releases
  const collReleases = await calculateCollectionReleases(
    employee.id, employee.employee_id, monthYear, fiscalYear
  );
  const collectionReleasesUsd = collReleases.vpReleaseUsd + collReleases.commReleaseUsd;
  const collectionReleaseNotes = collReleases.clawbackReversedDealIds.length > 0
    ? `Includes full release for clawback-reversed deal(s). Released upon collection of previously held amounts.`
    : 'Released upon collection of previously held amounts';
  
  // Calculate Year-End Releases (December only)
  let yearEndReleasesUsd = 0;
  if (isDecember) {
    yearEndReleasesUsd = await calculateYearEndReleases(employee.id, fiscalYear);
  }

  // === NRR Additional Pay ===
  let nrrPayoutUsd = 0;
  let nrrResult: NRRCalculationResult | null = null;
  const nrrOtePct = (planData as any)?.nrr_ote_percent ?? 0;
  const crErMinGp = (planData as any)?.cr_er_min_gp_margin_pct ?? 0;
  const implMinGp = (planData as any)?.impl_min_gp_margin_pct ?? 0;
  const nrrBookingPct = ((planData as any)?.nrr_payout_on_booking_pct ?? 0) / 100;
  const nrrCollectionPct = ((planData as any)?.nrr_payout_on_collection_pct ?? 100) / 100;
  const nrrYearEndPct = ((planData as any)?.nrr_payout_on_year_end_pct ?? 0) / 100;
  
  if (nrrOtePct > 0) {
    const empId = employee.employee_id;
    const participantOrFilter = `sales_rep_employee_id.eq.${empId},sales_head_employee_id.eq.${empId},sales_engineering_employee_id.eq.${empId},sales_engineering_head_employee_id.eq.${empId},product_specialist_employee_id.eq.${empId},product_specialist_head_employee_id.eq.${empId},solution_manager_employee_id.eq.${empId},solution_manager_head_employee_id.eq.${empId}`;
    
    const { data: nrrDeals } = await supabase
      .from('deals')
      .select('id, cr_usd, er_usd, implementation_usd, gp_margin_percent')
      .or(participantOrFilter)
      .gte('month_year', `${fiscalYear}-01-01`)
      .lte('month_year', monthYear);
    
    // Get CR/ER and Implementation targets
    const { data: crErTarget } = await supabase
      .from('performance_targets')
      .select('target_value_usd')
      .eq('employee_id', empId)
      .eq('effective_year', fiscalYear)
      .eq('metric_type', 'CR/ER')
      .maybeSingle();
    
    const { data: implTarget } = await supabase
      .from('performance_targets')
      .select('target_value_usd')
      .eq('employee_id', empId)
      .eq('effective_year', fiscalYear)
      .eq('metric_type', 'Implementation')
      .maybeSingle();
    
    nrrResult = calculateNRRPayout(
      (nrrDeals || []) as NRRDeal[],
      crErTarget?.target_value_usd ?? 0,
      implTarget?.target_value_usd ?? 0,
      nrrOtePct,
      targetBonusUsd,
      crErMinGp,
      implMinGp
    );
    nrrPayoutUsd = nrrResult.payoutUsd;
  }

  // === SPIFF Calculations ===
  let spiffPayoutUsd = 0;
  let spiffBreakdowns: SpiffDealBreakdown[] = [];
  
  const { data: planSpiffs } = await supabase
    .from('plan_spiffs')
    .select('*')
    .eq('plan_id', planId)
    .eq('is_active', true);
  
  if (planSpiffs && planSpiffs.length > 0) {
    const empId = employee.employee_id;
    const participantOrFilter = `sales_rep_employee_id.eq.${empId},sales_head_employee_id.eq.${empId},sales_engineering_employee_id.eq.${empId},sales_engineering_head_employee_id.eq.${empId},product_specialist_employee_id.eq.${empId},product_specialist_head_employee_id.eq.${empId},solution_manager_employee_id.eq.${empId},solution_manager_head_employee_id.eq.${empId}`;
    
    const { data: spiffDeals } = await supabase
      .from('deals')
      .select('id, new_software_booking_arr_usd, project_id, customer_name')
      .or(participantOrFilter)
      .gte('month_year', `${fiscalYear}-01-01`)
      .lte('month_year', monthYear);
    
    // Build targets by metric
    const spiffMetrics: SpiffMetric[] = ((metrics || []) as any[]).map(m => ({
      metric_name: m.metric_name,
      weightage_percent: m.weightage_percent,
    }));
    
    const targetsByMetric: Record<string, number> = {};
    for (const spiff of planSpiffs) {
      if (!targetsByMetric[spiff.linked_metric_name]) {
        const { data: perfTarget } = await supabase
          .from('performance_targets')
          .select('target_value_usd')
          .eq('employee_id', employee.employee_id)
          .eq('effective_year', fiscalYear)
          .eq('metric_type', spiff.linked_metric_name)
          .maybeSingle();
        targetsByMetric[spiff.linked_metric_name] = perfTarget?.target_value_usd ?? 0;
      }
    }
    
    const spiffResult = calculateAllSpiffs(
      planSpiffs as SpiffConfig[],
      (spiffDeals || []) as SpiffDeal[],
      spiffMetrics,
      targetBonusUsd,
      targetsByMetric
    );
    spiffPayoutUsd = spiffResult.totalSpiffUsd;
    spiffBreakdowns = spiffResult.breakdowns;
  }

  // === Deal Team SPIFF (manual allocations) ===
  let dealTeamSpiffUsd = 0;
  {
    const { data: dtsAllocations } = await supabase
      .from('deal_team_spiff_allocations' as any)
      .select('allocated_amount_usd')
      .eq('employee_id', employee.employee_id)
      .eq('status', 'approved')
      .eq('payout_month', ensureFullDate(monthYear));
    
    dealTeamSpiffUsd = ((dtsAllocations as any[]) || []).reduce(
      (sum: number, a: any) => sum + (a.allocated_amount_usd || 0), 0
    );
  }
  
  // Convert to local currency
  const vpLocal = convertVPToLocal(vpResult.totalVpUsd, compensationRate);
  const vpBookingLocal = convertVPToLocal(vpResult.bookingUsd, compensationRate);
  const vpCollectionLocal = convertVPToLocal(vpResult.collectionUsd, compensationRate);
  const vpYearEndLocal = convertVPToLocal(vpResult.yearEndUsd, compensationRate);
  
  const commLocal = convertCommissionToLocal(commResult.totalCommUsd, marketRate);
  const commBookingLocal = convertCommissionToLocal(commResult.bookingUsd, marketRate);
  const commCollectionLocal = convertCommissionToLocal(commResult.collectionUsd, marketRate);
  const commYearEndLocal = convertCommissionToLocal(commResult.yearEndUsd, marketRate);
  
  const collectionReleasesLocal = convertVPToLocal(collectionReleasesUsd, compensationRate);
  const yearEndReleasesLocal = convertVPToLocal(yearEndReleasesUsd, compensationRate);
  
  const nrrPayoutLocal = convertVPToLocal(nrrPayoutUsd, compensationRate);
  const spiffPayoutLocal = convertVPToLocal(spiffPayoutUsd, compensationRate);
  const dealTeamSpiffLocal = convertVPToLocal(dealTeamSpiffUsd, compensationRate);
  
  // Payable This Month = Upon Booking + Collection Releases + Year-End Releases + NRR booking portion + SPIFF booking portions + Deal Team SPIFF (100% booking)
  const nrrBookingUsd = nrrPayoutUsd * nrrBookingPct;
  
  // Calculate SPIFF booking portion from individual spiff splits
  let spiffBookingUsd = 0;
  let spiffCollectionUsd = 0;
  let spiffYearEndUsd = 0;
  if (planSpiffs && planSpiffs.length > 0) {
    for (const breakdown of spiffBreakdowns) {
      const matchingSpiff = planSpiffs.find(s => s.spiff_name === breakdown.spiffName);
      const bkPct = (matchingSpiff as any)?.payout_on_booking_pct ?? 0;
      const coPct = (matchingSpiff as any)?.payout_on_collection_pct ?? 100;
      const yePct = (matchingSpiff as any)?.payout_on_year_end_pct ?? 0;
      spiffBookingUsd += breakdown.spiffPayoutUsd * (bkPct / 100);
      spiffCollectionUsd += breakdown.spiffPayoutUsd * (coPct / 100);
      spiffYearEndUsd += breakdown.spiffPayoutUsd * (yePct / 100);
    }
  }
  
  const payableThisMonthUsd = vpResult.bookingUsd + commResult.bookingUsd + collectionReleasesUsd + yearEndReleasesUsd + nrrBookingUsd + spiffBookingUsd + dealTeamSpiffUsd;
  const payableThisMonthLocal = vpBookingLocal + commBookingLocal + collectionReleasesLocal + yearEndReleasesLocal + convertVPToLocal(nrrBookingUsd, compensationRate) + convertVPToLocal(spiffBookingUsd, compensationRate) + dealTeamSpiffLocal;
  
  return {
    employeeId: employee.id,
    employeeName: employee.full_name,
    employeeCode: employee.employee_id,
    localCurrency: employee.local_currency,
    
    variablePayUsd: vpResult.totalVpUsd,
    variablePayLocal: vpLocal,
    vpCompensationRate: compensationRate,
    vpBookingUsd: vpResult.bookingUsd,
    vpBookingLocal,
    vpCollectionUsd: vpResult.collectionUsd,
    vpCollectionLocal,
    vpYearEndUsd: vpResult.yearEndUsd,
    vpYearEndLocal,
    
    commissionsUsd: commResult.totalCommUsd,
    commissionsLocal: commLocal,
    commissionMarketRate: marketRate,
    commBookingUsd: commResult.bookingUsd,
    commBookingLocal,
    commCollectionUsd: commResult.collectionUsd,
    commCollectionLocal,
    commYearEndUsd: commResult.yearEndUsd,
    commYearEndLocal,
    
    collectionReleasesUsd,
    collectionReleasesLocal,
    collectionReleaseNotes,
    yearEndReleasesUsd,
    yearEndReleasesLocal,
    
    nrrPayoutUsd,
    nrrPayoutLocal,
    nrrResult,
    nrrBookingPct,
    nrrCollectionPct,
    nrrYearEndPct,
    spiffPayoutUsd,
    spiffPayoutLocal,
    spiffBreakdowns,
    spiffBookingPct: spiffPayoutUsd > 0 ? spiffBookingUsd / spiffPayoutUsd : 0,
    spiffCollectionPct: spiffPayoutUsd > 0 ? spiffCollectionUsd / spiffPayoutUsd : 1,
    spiffYearEndPct: spiffPayoutUsd > 0 ? spiffYearEndUsd / spiffPayoutUsd : 0,
    
    dealTeamSpiffUsd,
    dealTeamSpiffLocal,
    
    totalPayoutUsd: vpResult.totalVpUsd + commResult.totalCommUsd + nrrPayoutUsd + spiffPayoutUsd + dealTeamSpiffUsd,
    totalPayoutLocal: vpLocal + commLocal + nrrPayoutLocal + spiffPayoutLocal + dealTeamSpiffLocal,
    totalBookingUsd: vpResult.bookingUsd + commResult.bookingUsd,
    totalBookingLocal: vpBookingLocal + commBookingLocal,
    payableThisMonthUsd,
    payableThisMonthLocal,
    
    planId,
    planName,
    dealsCount: vpResult.attributions.length,
    
    vpAttributions: vpResult.attributions,
    commissionCalculations: commResult.calculations,
  };
}

// ============= CLAWBACK DETECTION =============

interface ClawbackResult {
  totalClawbacksUsd: number;
  clawbackCount: number;
}

/**
 * Check and apply clawbacks for overdue deal collections.
 * Uses the plan's clawback_period_days (default 180) from booking_month end.
 * If first_milestone_due_date is set, uses the earlier of the two deadlines.
 * Also inserts into clawback_ledger for carry-forward tracking.
 */
export async function checkAndApplyClawbacks(
  payoutRunId: string,
  monthYear: string
): Promise<ClawbackResult> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Find all uncollected, non-clawback-triggered collections
  const { data: pendingCollections } = await supabase
    .from('deal_collections')
    .select(`
      id,
      deal_id,
      booking_month,
      deal_value_usd,
      first_milestone_due_date,
      project_id,
      customer_name
    `)
    .eq('is_collected', false)
    .or('is_clawback_triggered.is.null,is_clawback_triggered.eq.false');
  
  if (!pendingCollections || pendingCollections.length === 0) {
    return { totalClawbacksUsd: 0, clawbackCount: 0 };
  }
  
  let totalClawbacksUsd = 0;
  let clawbackCount = 0;
  
  for (const collection of pendingCollections) {
    // Determine clawback deadline based on plan's clawback_period_days
    // First, find the employee(s) associated with this deal to get their plan
    const { data: attributions } = await supabase
      .from('deal_variable_pay_attribution')
      .select('employee_id, payout_on_booking_usd, local_currency, compensation_exchange_rate, plan_id')
      .eq('deal_id', collection.deal_id);
    
    if (!attributions || attributions.length === 0) continue;
    
    // Get the plan's clawback period (use first attribution's plan)
    const planId = attributions[0].plan_id;
    let clawbackPeriodDays = 180; // default
    let isClawbackExempt = false;
    
    if (planId) {
      const { data: plan } = await supabase
        .from('comp_plans')
        .select('clawback_period_days, is_clawback_exempt')
        .eq('id', planId)
        .maybeSingle();
      
      if (plan) {
        clawbackPeriodDays = plan.clawback_period_days ?? 180;
        isClawbackExempt = plan.is_clawback_exempt === true;
      }
    }
    
    // Skip clawback-exempt plans
    if (isClawbackExempt) continue;
    
    // Calculate deadline: end of booking month + clawback_period_days
    const bookingDate = new Date(collection.booking_month);
    const bookingMonthEnd = new Date(bookingDate.getFullYear(), bookingDate.getMonth() + 1, 0); // last day of booking month
    const clawbackDeadline = new Date(bookingMonthEnd);
    clawbackDeadline.setDate(clawbackDeadline.getDate() + clawbackPeriodDays);
    
    // If first_milestone_due_date is set, use the earlier deadline
    let effectiveDeadline = clawbackDeadline;
    if (collection.first_milestone_due_date) {
      const milestoneDate = new Date(collection.first_milestone_due_date);
      if (milestoneDate < clawbackDeadline) {
        effectiveDeadline = milestoneDate;
      }
    }
    
    // Check if past deadline
    if (today <= effectiveDeadline) continue;
    
    // This deal is overdue — trigger clawback
    const clawbackAmount = attributions.reduce((sum, attr) => sum + attr.payout_on_booking_usd, 0);
    totalClawbacksUsd += clawbackAmount;
    clawbackCount++;
    
    // Create clawback payout records (negative amounts) and clawback_ledger entries
    for (const attr of attributions) {
      const localAmount = attr.payout_on_booking_usd * (attr.compensation_exchange_rate || 1);
      
      await supabase.from('monthly_payouts').insert({
        payout_run_id: payoutRunId,
        employee_id: attr.employee_id,
        month_year: monthYear,
        payout_type: 'Clawback',
        calculated_amount_usd: -attr.payout_on_booking_usd,
        calculated_amount_local: -localAmount,
        local_currency: attr.local_currency || 'USD',
        exchange_rate_used: attr.compensation_exchange_rate || 1,
        exchange_rate_type: 'compensation',
        clawback_amount_usd: attr.payout_on_booking_usd,
        clawback_amount_local: localAmount,
        status: 'calculated',
        notes: `Clawback for deal ${collection.project_id} - ${collection.customer_name || 'Unknown'} (${clawbackPeriodDays}-day period exceeded)`,
      });
      
      // Insert into clawback_ledger for carry-forward tracking
      await supabase.from('clawback_ledger' as any).insert({
        employee_id: attr.employee_id,
        deal_id: collection.deal_id,
        deal_collection_id: collection.id,
        original_amount_usd: attr.payout_on_booking_usd,
        recovered_amount_usd: 0,
        status: 'pending',
        triggered_month: ensureFullDate(monthYear),
      });
    }
    
    // Update deal_variable_pay_attribution records
    await supabase
      .from('deal_variable_pay_attribution')
      .update({
        is_clawback_triggered: true,
        clawback_date: todayStr,
        clawback_amount_usd: clawbackAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('deal_id', collection.deal_id);
    
    // Update the collection record
    await supabase
      .from('deal_collections')
      .update({
        is_clawback_triggered: true,
        clawback_triggered_at: new Date().toISOString(),
        clawback_amount_usd: clawbackAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', collection.id);
  }
  
  return {
    totalClawbacksUsd,
    clawbackCount,
  };
}

/**
 * Apply clawback carry-forward deductions from an employee's payable amount.
 * Checks the clawback_ledger for pending/partial entries and deducts from payable.
 * Returns the adjusted payable amount after deductions.
 */
export async function applyClawbackRecoveries(
  employeeId: string,
  payableAmountUsd: number,
  monthYear: string
): Promise<{ adjustedPayableUsd: number; totalRecoveredUsd: number }> {
  if (payableAmountUsd <= 0) {
    return { adjustedPayableUsd: payableAmountUsd, totalRecoveredUsd: 0 };
  }

  // Fetch pending/partial clawback ledger entries for this employee
  const { data: pendingClawbacks } = await supabase
    .from('clawback_ledger' as any)
    .select('id, remaining_amount_usd, recovered_amount_usd')
    .eq('employee_id', employeeId)
    .in('status', ['pending', 'partial'])
    .order('triggered_month', { ascending: true });

  if (!pendingClawbacks || pendingClawbacks.length === 0) {
    return { adjustedPayableUsd: payableAmountUsd, totalRecoveredUsd: 0 };
  }

  let remainingPayable = payableAmountUsd;
  let totalRecovered = 0;

  for (const entry of pendingClawbacks as any[]) {
    if (remainingPayable <= 0) break;

    const canRecover = Math.min(remainingPayable, entry.remaining_amount_usd);
    if (canRecover <= 0) continue;

    const newRecovered = (entry.recovered_amount_usd || 0) + canRecover;
    const newRemaining = entry.remaining_amount_usd - canRecover;
    const newStatus = newRemaining <= 0 ? 'recovered' : 'partial';

    await supabase
      .from('clawback_ledger' as any)
      .update({
        recovered_amount_usd: newRecovered,
        status: newStatus,
        last_recovery_month: ensureFullDate(monthYear),
      })
      .eq('id', entry.id);

    remainingPayable -= canRecover;
    totalRecovered += canRecover;
  }

  return {
    adjustedPayableUsd: remainingPayable,
    totalRecoveredUsd: totalRecovered,
  };
}

// ============= BATCH CALCULATION =============

/**
 * Run full payout calculation for all employees
 */
export async function runPayoutCalculation(
  payoutRunId: string,
  monthYear: string
): Promise<PayoutRunResult> {
  // === Calculation Lock: prevent concurrent runs ===
  // Use CAS pattern: only proceed if current status is 'draft' or 'review'
  const { data: lockResult, error: lockError } = await supabase
    .from('payout_runs')
    .update({ run_status: 'calculating', updated_at: new Date().toISOString() })
    .eq('id', payoutRunId)
    .in('run_status', ['draft', 'review'])
    .select('id')
    .maybeSingle();
  
  if (lockError || !lockResult) {
    throw new Error('Cannot start calculation: another calculation may already be in progress, or the run is not in draft/review status.');
  }
  
  try {
    return await executePayoutCalculation(payoutRunId, monthYear);
  } catch (error) {
    // Reset status back to draft on failure
    await supabase
      .from('payout_runs')
      .update({ run_status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', payoutRunId)
      .eq('run_status', 'calculating');
    throw error;
  }
}

async function executePayoutCalculation(
  payoutRunId: string,
  monthYear: string
): Promise<PayoutRunResult> {
  const calculatedAt = new Date().toISOString();
  const fiscalYear = parseInt(monthYear.substring(0, 4));
  
  // First, check and apply any clawbacks
  const clawbackResult = await checkAndApplyClawbacks(payoutRunId, monthYear);
  
  // Fetch all active employees
  const { data: employees } = await supabase
    .from('employees')
    .select('id, employee_id, full_name, email, local_currency, compensation_exchange_rate, tvp_usd, is_active, sales_function')
    .eq('is_active', true);
  
  if (!employees || employees.length === 0) {
    throw new Error('No active employees found');
  }
  
  const employeePayouts: EmployeePayoutResult[] = [];
  
  // Calculate payout for each employee
  for (const emp of employees) {
    const result = await calculateMonthlyPayout(emp as Employee, monthYear);
    if (result) {
      employeePayouts.push(result);
    }
  }
  
  // Calculate totals
  const totalPayoutUsd = employeePayouts.reduce((sum, p) => sum + p.totalPayoutUsd, 0);
  const totalVariablePayUsd = employeePayouts.reduce((sum, p) => sum + p.variablePayUsd, 0);
  const totalCommissionsUsd = employeePayouts.reduce((sum, p) => sum + p.commissionsUsd, 0);
  
  // Persist to database
  await persistPayoutResults(payoutRunId, monthYear, fiscalYear, employeePayouts);
  
  // Update payout run totals and status
  await supabase
    .from('payout_runs')
    .update({
      run_status: 'review',
      calculated_at: calculatedAt,
      total_payout_usd: Math.round(totalPayoutUsd * 100) / 100,
      total_variable_pay_usd: Math.round(totalVariablePayUsd * 100) / 100,
      total_commissions_usd: Math.round(totalCommissionsUsd * 100) / 100,
      total_clawbacks_usd: Math.round(clawbackResult.totalClawbacksUsd * 100) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payoutRunId);
  
  return {
    runId: payoutRunId,
    monthYear,
    calculatedAt,
    totalEmployees: employeePayouts.length,
    totalPayoutUsd,
    totalVariablePayUsd,
    totalCommissionsUsd,
    employeePayouts,
  };
}

/**
 * Persist payout results to database
 */
async function persistPayoutResults(
  payoutRunId: string,
  monthYear: string,
  fiscalYear: number,
  employeePayouts: EmployeePayoutResult[]
): Promise<void> {
  // Delete existing payouts for this run (except clawbacks which are created before)
  const { error: deletePayoutsError } = await supabase
    .from('monthly_payouts')
    .delete()
    .eq('payout_run_id', payoutRunId)
    .neq('payout_type', 'Clawback');
  
  if (deletePayoutsError) {
    throw new Error(`Failed to clear old payout records: ${deletePayoutsError.message}`);
  }
  
  // Verify deletion succeeded - check if non-clawback records still exist
  const { data: remainingRecords } = await supabase
    .from('monthly_payouts')
    .select('id')
    .eq('payout_run_id', payoutRunId)
    .neq('payout_type', 'Clawback')
    .limit(1);
  
  if (remainingRecords && remainingRecords.length > 0) {
    throw new Error('Failed to clear old payout records: records still exist after deletion. This may be due to database policies. Please contact an administrator.');
  }
  
  const { error: deleteAttrError } = await supabase
    .from('deal_variable_pay_attribution')
    .delete()
    .eq('payout_run_id', payoutRunId);
  
  if (deleteAttrError) {
    throw new Error(`Failed to clear old attribution records: ${deleteAttrError.message}`);
  }
  
  // Insert monthly payouts
  const payoutRecords = employeePayouts.flatMap(emp => {
    const records: any[] = [];
    
    // Variable Pay record
    if (emp.variablePayUsd > 0) {
      records.push({
        payout_run_id: payoutRunId,
        employee_id: emp.employeeId,
        month_year: monthYear,
        payout_type: 'Variable Pay',
        plan_id: emp.planId,
        calculated_amount_usd: emp.variablePayUsd,
        calculated_amount_local: emp.variablePayLocal,
        local_currency: emp.localCurrency,
        exchange_rate_used: emp.vpCompensationRate,
        exchange_rate_type: 'compensation',
        booking_amount_usd: emp.vpBookingUsd,
        booking_amount_local: emp.vpBookingLocal,
        collection_amount_usd: emp.vpCollectionUsd,
        collection_amount_local: emp.vpCollectionLocal,
        year_end_amount_usd: emp.vpYearEndUsd,
        year_end_amount_local: emp.vpYearEndLocal,
        status: 'calculated',
      });
    }
    
    // Commission records by type
    const commissionsByType = emp.commissionCalculations.reduce((acc, c) => {
      if (!c.qualifies) return acc;
      if (!acc[c.commissionType]) {
        acc[c.commissionType] = { gross: 0, paid: 0, holdback: 0, yearEnd: 0 };
      }
      acc[c.commissionType].gross += c.grossCommission;
      acc[c.commissionType].paid += c.paidAmount;
      acc[c.commissionType].holdback += c.holdbackAmount;
      acc[c.commissionType].yearEnd += c.yearEndHoldback;
      return acc;
    }, {} as Record<string, { gross: number; paid: number; holdback: number; yearEnd: number }>);
    
    for (const [commType, amounts] of Object.entries(commissionsByType)) {
      records.push({
        payout_run_id: payoutRunId,
        employee_id: emp.employeeId,
        month_year: monthYear,
        payout_type: commType,
        plan_id: emp.planId,
        calculated_amount_usd: amounts.gross,
        calculated_amount_local: amounts.gross * emp.commissionMarketRate,
        local_currency: emp.localCurrency,
        exchange_rate_used: emp.commissionMarketRate,
        exchange_rate_type: 'market',
        booking_amount_usd: amounts.paid,
        booking_amount_local: amounts.paid * emp.commissionMarketRate,
        collection_amount_usd: amounts.holdback,
        collection_amount_local: amounts.holdback * emp.commissionMarketRate,
        year_end_amount_usd: amounts.yearEnd,
        year_end_amount_local: amounts.yearEnd * emp.commissionMarketRate,
        status: 'calculated',
      });
    }
    
    // Collection Release record
    if (emp.collectionReleasesUsd > 0) {
      records.push({
        payout_run_id: payoutRunId,
        employee_id: emp.employeeId,
        month_year: monthYear,
        payout_type: 'Collection Release',
        plan_id: emp.planId,
        calculated_amount_usd: emp.collectionReleasesUsd,
        calculated_amount_local: emp.collectionReleasesLocal,
        local_currency: emp.localCurrency,
        exchange_rate_used: emp.vpCompensationRate,
        exchange_rate_type: 'compensation',
        booking_amount_usd: emp.collectionReleasesUsd,
        booking_amount_local: emp.collectionReleasesLocal,
        status: 'calculated',
        notes: emp.collectionReleaseNotes,
      });
    }
    
    // Year-End Release record (December only)
    if (emp.yearEndReleasesUsd > 0) {
      records.push({
        payout_run_id: payoutRunId,
        employee_id: emp.employeeId,
        month_year: monthYear,
        payout_type: 'Year-End Release',
        plan_id: emp.planId,
        calculated_amount_usd: emp.yearEndReleasesUsd,
        calculated_amount_local: emp.yearEndReleasesLocal,
        local_currency: emp.localCurrency,
        exchange_rate_used: emp.vpCompensationRate,
        exchange_rate_type: 'compensation',
        booking_amount_usd: emp.yearEndReleasesUsd,
        booking_amount_local: emp.yearEndReleasesLocal,
        status: 'calculated',
        notes: 'Year-end release of accumulated reserves',
      });
    }

    // NRR Additional Pay record
    if (emp.nrrPayoutUsd > 0) {
      const nBk = emp.nrrPayoutUsd * (emp.nrrBookingPct ?? 0);
      const nCo = emp.nrrPayoutUsd * (emp.nrrCollectionPct ?? 1);
      const nYe = emp.nrrPayoutUsd * (emp.nrrYearEndPct ?? 0);
      records.push({
        payout_run_id: payoutRunId,
        employee_id: emp.employeeId,
        month_year: monthYear,
        payout_type: 'NRR Additional Pay',
        plan_id: emp.planId,
        calculated_amount_usd: emp.nrrPayoutUsd,
        calculated_amount_local: emp.nrrPayoutLocal,
        local_currency: emp.localCurrency,
        exchange_rate_used: emp.vpCompensationRate,
        exchange_rate_type: 'compensation',
        booking_amount_usd: nBk,
        booking_amount_local: nBk * emp.vpCompensationRate,
        collection_amount_usd: nCo,
        collection_amount_local: nCo * emp.vpCompensationRate,
        year_end_amount_usd: nYe,
        year_end_amount_local: nYe * emp.vpCompensationRate,
        status: 'calculated',
        notes: emp.nrrResult
          ? `NRR Achievement: ${emp.nrrResult.achievementPct}% (Actuals: $${emp.nrrResult.nrrActuals.toLocaleString()} / Target: $${emp.nrrResult.nrrTarget.toLocaleString()})`
          : 'NRR Additional Pay',
      });
    }

    // SPIFF records
    if (emp.spiffPayoutUsd > 0) {
      const sBk = emp.spiffPayoutUsd * (emp.spiffBookingPct ?? 0);
      const sCo = emp.spiffPayoutUsd * (emp.spiffCollectionPct ?? 1);
      const sYe = emp.spiffPayoutUsd * (emp.spiffYearEndPct ?? 0);
      records.push({
        payout_run_id: payoutRunId,
        employee_id: emp.employeeId,
        month_year: monthYear,
        payout_type: 'SPIFF',
        plan_id: emp.planId,
        calculated_amount_usd: emp.spiffPayoutUsd,
        calculated_amount_local: emp.spiffPayoutLocal,
        local_currency: emp.localCurrency,
        exchange_rate_used: emp.vpCompensationRate,
        exchange_rate_type: 'compensation',
        booking_amount_usd: sBk,
        booking_amount_local: sBk * emp.vpCompensationRate,
        collection_amount_usd: sCo,
        collection_amount_local: sCo * emp.vpCompensationRate,
        year_end_amount_usd: sYe,
        year_end_amount_local: sYe * emp.vpCompensationRate,
        status: 'calculated',
        notes: emp.spiffBreakdowns.map(b => `${b.spiffName}: $${b.spiffPayoutUsd.toLocaleString()} (${b.customerName || b.projectId})`).join('; '),
      });
    }

    // Deal Team SPIFF records (100% upon booking, no holdback)
    if (emp.dealTeamSpiffUsd > 0) {
      records.push({
        payout_run_id: payoutRunId,
        employee_id: emp.employeeId,
        month_year: monthYear,
        payout_type: 'Deal Team SPIFF',
        plan_id: emp.planId,
        calculated_amount_usd: emp.dealTeamSpiffUsd,
        calculated_amount_local: emp.dealTeamSpiffLocal,
        local_currency: emp.localCurrency,
        exchange_rate_used: emp.vpCompensationRate,
        exchange_rate_type: 'compensation',
        booking_amount_usd: emp.dealTeamSpiffUsd,
        booking_amount_local: emp.dealTeamSpiffLocal,
        collection_amount_usd: 0,
        collection_amount_local: 0,
        year_end_amount_usd: 0,
        year_end_amount_local: 0,
        status: 'calculated',
        notes: 'Deal Team SPIFF - Manual allocation',
      });
    }
    
    return records;
  });
  
  if (payoutRecords.length > 0) {
    await supabase.from('monthly_payouts').insert(payoutRecords);
  }
  
  // Insert deal variable pay attributions
  const attributionRecords = employeePayouts.flatMap(emp => 
    emp.vpAttributions.map(attr => ({
      payout_run_id: payoutRunId,
      deal_id: attr.dealId,
      employee_id: emp.employeeId,
      fiscal_year: fiscalYear,
      calculation_month: ensureFullDate(monthYear),
      metric_name: attr.metricName,
      deal_value_usd: attr.dealValueUsd,
      proportion_pct: attr.proportionPct,
      variable_pay_split_usd: attr.variablePaySplitUsd,
      variable_pay_split_local: attr.variablePaySplitUsd * emp.vpCompensationRate,
      payout_on_booking_usd: attr.payoutOnBookingUsd,
      payout_on_booking_local: attr.payoutOnBookingUsd * emp.vpCompensationRate,
      payout_on_collection_usd: attr.payoutOnCollectionUsd,
      payout_on_collection_local: attr.payoutOnCollectionUsd * emp.vpCompensationRate,
      payout_on_year_end_usd: attr.payoutOnYearEndUsd,
      payout_on_year_end_local: attr.payoutOnYearEndUsd * emp.vpCompensationRate,
      clawback_eligible_usd: attr.clawbackEligibleUsd,
      local_currency: emp.localCurrency,
      compensation_exchange_rate: emp.vpCompensationRate,
      plan_id: emp.planId,
      // These are required by the schema - we'll set defaults
      total_actual_usd: 0,
      target_usd: 0,
      achievement_pct: 0,
      multiplier: 1,
      total_variable_pay_usd: emp.variablePayUsd,
    }))
  );
  
  if (attributionRecords.length > 0) {
    await supabase.from('deal_variable_pay_attribution').insert(attributionRecords);
  }
}
