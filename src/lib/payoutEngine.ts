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
  
  // Year-End Releases (December only)
  yearEndReleasesUsd: number;
  yearEndReleasesLocal: number;
  
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

    // Get payout split percentages from metric config
    const bookingPct = metric.payout_on_booking_pct ?? 0;
    const collectionPct = metric.payout_on_collection_pct ?? 100;
    const yearEndPct = metric.payout_on_year_end_pct ?? 0;

    if (isClosingArr) {
      // Closing ARR: fetch from closing_arr_actuals table (latest month snapshot, eligible only)
      const { data: closingArr } = await supabase
        .from('closing_arr_actuals')
        .select('month_year, closing_arr, end_date')
        .or(`sales_rep_employee_id.eq.${empId},sales_head_employee_id.eq.${empId}`)
        .gte('month_year', `${ctx.fiscalYear}-01-01`)
        .lte('month_year', ctx.monthYear)
        .gt('end_date', `${ctx.fiscalYear}-12-31`);

      // Group by month and use the latest month snapshot
      const closingByMonth = new Map<string, number>();
      (closingArr || []).forEach(arr => {
        const monthKey = arr.month_year?.substring(0, 7) || '';
        closingByMonth.set(monthKey, (closingByMonth.get(monthKey) || 0) + (arr.closing_arr || 0));
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
      // New Software Booking ARR (or any deal-based metric): fetch from deals table
      const { data: deals } = await supabase
        .from('deals')
        .select('id, new_software_booking_arr_usd, month_year, project_id, customer_name')
        .or(participantOrFilter)
        .gte('month_year', `${ctx.fiscalYear}-01-01`)
        .lte('month_year', ctx.monthYear);

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
): Promise<{ vpReleaseUsd: number; commReleaseUsd: number }> {
  // Find deals collected this month
  const { data: collections } = await supabase
    .from('deal_collections')
    .select('deal_id')
    .eq('collection_month', ensureFullDate(monthYear))
    .eq('is_collected', true);
  
  if (!collections || collections.length === 0) {
    return { vpReleaseUsd: 0, commReleaseUsd: 0 };
  }
  
  const collectedDealIds = collections.map(c => c.deal_id);
  
  // VP releases: sum payout_on_collection_usd from deal_variable_pay_attribution for this employee
  const { data: vpAttrs } = await supabase
    .from('deal_variable_pay_attribution')
    .select('payout_on_collection_usd')
    .eq('employee_id', employeeId)
    .eq('fiscal_year', fiscalYear)
    .in('deal_id', collectedDealIds);
  
  const vpReleaseUsd = (vpAttrs || []).reduce((sum, a) => sum + (a.payout_on_collection_usd || 0), 0);
  
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
  
  return { vpReleaseUsd, commReleaseUsd };
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
      comp_plans (id, name, is_clawback_exempt)
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
  
  // Calculate Year-End Releases (December only)
  let yearEndReleasesUsd = 0;
  if (isDecember) {
    yearEndReleasesUsd = await calculateYearEndReleases(employee.id, fiscalYear);
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
  
  // Payable This Month = Upon Booking + Collection Releases + Year-End Releases (Dec)
  const payableThisMonthUsd = vpResult.bookingUsd + commResult.bookingUsd + collectionReleasesUsd + yearEndReleasesUsd;
  const payableThisMonthLocal = vpBookingLocal + commBookingLocal + collectionReleasesLocal + yearEndReleasesLocal;
  
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
    yearEndReleasesUsd,
    yearEndReleasesLocal,
    
    totalPayoutUsd: vpResult.totalVpUsd + commResult.totalCommUsd,
    totalPayoutLocal: vpLocal + commLocal,
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
 * Check and apply clawbacks for overdue deal collections (180-day rule)
 */
export async function checkAndApplyClawbacks(
  payoutRunId: string,
  monthYear: string
): Promise<ClawbackResult> {
  // Find overdue collections that haven't been triggered yet
  const { data: overdueCollections } = await supabase
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
    .lt('first_milestone_due_date', new Date().toISOString().split('T')[0])
    .or('is_clawback_triggered.is.null,is_clawback_triggered.eq.false');
  
  if (!overdueCollections || overdueCollections.length === 0) {
    return { totalClawbacksUsd: 0, clawbackCount: 0 };
  }
  
  let totalClawbacksUsd = 0;
  
  for (const collection of overdueCollections) {
    // Find the VP attributions for this deal to calculate clawback amount
    const { data: attributions } = await supabase
      .from('deal_variable_pay_attribution')
      .select('employee_id, payout_on_booking_usd, local_currency, compensation_exchange_rate')
      .eq('deal_id', collection.deal_id);
    
    if (!attributions || attributions.length === 0) continue;
    
    // Sum up the booking payouts that need to be clawed back
    const clawbackAmount = attributions.reduce((sum, attr) => sum + attr.payout_on_booking_usd, 0);
    totalClawbacksUsd += clawbackAmount;
    
    // Create clawback payout records (negative amounts)
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
        notes: `Clawback for deal ${collection.project_id} - ${collection.customer_name || 'Unknown'}`,
      });
    }
    
    // Update deal_variable_pay_attribution records
    await supabase
      .from('deal_variable_pay_attribution')
      .update({
        is_clawback_triggered: true,
        clawback_date: new Date().toISOString().split('T')[0],
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
    clawbackCount: overdueCollections.length,
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
  await supabase
    .from('monthly_payouts')
    .delete()
    .eq('payout_run_id', payoutRunId)
    .neq('payout_type', 'Clawback');
  
  await supabase
    .from('deal_variable_pay_attribution')
    .delete()
    .eq('payout_run_id', payoutRunId);
  
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
        notes: 'Released upon collection of previously held amounts',
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
