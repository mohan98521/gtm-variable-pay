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
 * 
 * PERFORMANCE: Uses bulk prefetching + parallel employee processing.
 * All shared data is fetched once upfront (~15 queries) then filtered
 * in-memory per employee, reducing 600+ round-trips to ~20 total.
 */

import { supabase } from "@/integrations/supabase/client";
import { PlanMetric } from "@/hooks/usePlanMetrics";
import { PlanCommission } from "./commissions";
import { 
  calculateDealVariablePayAttributions,
  calculateAggregateVariablePay,
  DealForAttribution,
  DealVariablePayAttribution,
  AggregateVariablePayContext 
} from "./dealVariablePayAttribution";
import { calculateDealCommission, calculateTotalCommission, CommissionCalculation } from "./commissions";
import { calculateNRRPayout, NRRDeal, NRRCalculationResult, NRRDealBreakdown } from "./nrrCalculation";
import { calculateAllSpiffs, SpiffConfig, SpiffDeal, SpiffMetric, SpiffDealBreakdown, SpiffAggregateResult } from "./spiffCalculation";
import { resolveTeamMembers } from "@/hooks/useSupportTeams";
import { calculateBlendedProRata, BlendedProRataSegment } from "./compensation";

// ============= HELPERS =============

function ensureFullDate(monthYear: string): string {
  return monthYear.length === 7 ? monthYear + '-01' : monthYear;
}

// ============= PREFETCHED DATA =============

/**
 * All bulk-fetched data used during payout calculation.
 * Fetched once before the employee loop, then filtered in-memory per employee.
 */
export interface PrefetchedData {
  // All deals for the fiscal year (all employees)
  allDeals: any[];
  // All closing ARR actuals for the fiscal year
  allClosingArr: any[];
  // All performance targets for the fiscal year
  allPerformanceTargets: any[];
  // All exchange rates for the current month
  allExchangeRates: any[];
  // All user_targets with comp_plans for the fiscal year
  allUserTargets: any[];
  // All plan metrics with multiplier grids (keyed by plan_id)
  allPlanMetrics: any[];
  // All multiplier grids
  allMultiplierGrids: any[];
  // All plan commissions
  allPlanCommissions: any[];
  // All plan spiffs
  allPlanSpiffs: any[];
  // All prior month payouts (VP, NRR, SPIFF) for the fiscal year up to current month
  allPriorPayouts: any[];
  // All deal collections
  allDealCollections: any[];
  // All support team memberships
  allTeamMemberships: any[];
  // All deal team SPIFF allocations for the current month
  allDealTeamSpiffAllocations: any[];
  // All clawback ledger entries (pending/partial)
  allClawbackLedger: any[];
  // All closing ARR renewal multipliers
  allRenewalMultipliers: any[];
  // All deal variable pay attributions for the fiscal year
  allVpAttributions: any[];
  // All monthly payouts for commission releases
  allMonthlyPayouts: any[];
  // All employees (for team report lookups)
  allEmployees: any[];
  // All deal participants (unused currently but available)
  // Deals with full commission fields (for the current month only)
  allCommissionDeals: any[];
}

/**
 * Prefetch all shared data needed for payout calculation.
 * Runs ~15-20 queries in parallel, replacing 25+ queries per employee.
 */
async function prefetchPayoutData(
  monthYear: string,
  fiscalYear: number
): Promise<PrefetchedData> {
  const fullMonthYear = ensureFullDate(monthYear);
  const fiscalYearStart = `${fiscalYear}-01-01`;
  const fiscalYearEnd = `${fiscalYear}-12-31`;

  // Run all queries in parallel
  const [
    dealsResult,
    closingArrResult,
    perfTargetsResult,
    exchangeRatesResult,
    userTargetsResult,
    planMetricsResult,
    multiplierGridsResult,
    planCommissionsResult,
    planSpiffsResult,
    priorPayoutsResult,
    collectionsResult,
    teamMembershipsResult,
    dtsAllocationsResult,
    clawbackLedgerResult,
    renewalMultipliersResult,
    vpAttributionsResult,
    monthlyPayoutsResult,
    employeesResult,
    commissionDealsResult,
  ] = await Promise.all([
    // All deals for fiscal year (with all fields needed for VP, commission, NRR, SPIFF)
    supabase
      .from('deals')
      .select('id, new_software_booking_arr_usd, month_year, project_id, customer_name, sales_rep_employee_id, sales_head_employee_id, sales_engineering_employee_id, sales_engineering_head_employee_id, product_specialist_employee_id, product_specialist_head_employee_id, solution_manager_employee_id, solution_manager_head_employee_id, solution_architect_employee_id, channel_sales_employee_id, tcv_usd, perpetual_license_usd, managed_services_usd, implementation_usd, cr_usd, er_usd, linked_to_impl, gp_margin_percent, eligible_for_perpetual_incentive, sales_engineering_team_id, solution_manager_team_id')
      .gte('month_year', fiscalYearStart)
      .lte('month_year', fullMonthYear),

    // All closing ARR actuals for fiscal year
    supabase
      .from('closing_arr_actuals')
      .select('id, month_year, closing_arr, end_date, is_multi_year, renewal_years, sales_rep_employee_id, sales_head_employee_id')
      .gte('month_year', fiscalYearStart)
      .lte('month_year', fullMonthYear),

    // All performance targets for fiscal year
    supabase
      .from('performance_targets')
      .select('employee_id, metric_type, target_value_usd, effective_year')
      .eq('effective_year', fiscalYear),

    // Exchange rates for current month
    supabase
      .from('exchange_rates')
      .select('currency_code, rate_to_usd')
      .eq('month_year', fullMonthYear),

    // All user_targets with comp_plans for fiscal year
    supabase
      .from('user_targets')
      .select(`
        *,
        comp_plans (id, name, is_clawback_exempt, nrr_ote_percent, cr_er_min_gp_margin_pct, impl_min_gp_margin_pct, nrr_payout_on_booking_pct, nrr_payout_on_collection_pct, nrr_payout_on_year_end_pct, clawback_period_days)
      `)
      .lte('effective_start_date', fiscalYearEnd)
      .gte('effective_end_date', fiscalYearStart),

    // All plan metrics
    supabase
      .from('plan_metrics')
      .select('*'),

    // All multiplier grids
    supabase
      .from('multiplier_grids')
      .select('*')
      .order('min_pct'),

    // All plan commissions
    supabase
      .from('plan_commissions')
      .select('*'),

    // All active plan spiffs
    supabase
      .from('plan_spiffs')
      .select('*')
      .eq('is_active', true),

    // Prior month payouts (VP, NRR, SPIFF) for fiscal year up to current month
    supabase
      .from('monthly_payouts')
      .select('employee_id, payout_type, calculated_amount_usd, month_year, payout_run_id, collection_amount_usd, deal_id, year_end_amount_usd')
      .gte('month_year', fiscalYearStart)
      .lte('month_year', `${fiscalYear}-12-01`)
      .not('payout_run_id', 'is', null),

    // All deal collections
    supabase
      .from('deal_collections')
      .select('id, deal_id, collection_month, is_collected, booking_month, deal_value_usd, first_milestone_due_date, project_id, customer_name, is_clawback_triggered'),

    // All support team memberships
    supabase
      .from('support_team_members' as any)
      .select('team_id, employee_id, is_active, effective_from, effective_to'),

    // Deal team SPIFF allocations for current month
    supabase
      .from('deal_team_spiff_allocations' as any)
      .select('employee_id, allocated_amount_usd, payout_month, status')
      .eq('status', 'approved')
      .eq('payout_month', fullMonthYear),

    // Clawback ledger (pending/partial)
    supabase
      .from('clawback_ledger' as any)
      .select('id, employee_id, deal_id, deal_collection_id, original_amount_usd, recovered_amount_usd, remaining_amount_usd, status, triggered_month')
      .in('status', ['pending', 'partial']),

    // All closing ARR renewal multipliers
    supabase
      .from('closing_arr_renewal_multipliers' as any)
      .select('*')
      .order('min_years'),

    // All VP attributions for fiscal year (for collection releases)
    supabase
      .from('deal_variable_pay_attribution')
      .select('deal_id, employee_id, payout_on_collection_usd, variable_pay_split_usd, is_clawback_triggered, fiscal_year, plan_id, payout_on_booking_usd, local_currency, compensation_exchange_rate')
      .eq('fiscal_year', fiscalYear),

    // All monthly payouts (for commission releases - broader query)
    supabase
      .from('monthly_payouts')
      .select('employee_id, payout_type, collection_amount_usd, deal_id, year_end_amount_usd, month_year')
      .gte('month_year', fiscalYearStart)
      .lte('month_year', `${fiscalYear}-12-01`),

    // All employees (for team report lookups)
    supabase
      .from('employees')
      .select('id, employee_id, full_name, email, local_currency, compensation_exchange_rate, tvp_usd, is_active, sales_function, manager_employee_id'),

    // All deals for current month only (for commission calculation with full fields)
    supabase
      .from('deals')
      .select('id, tcv_usd, perpetual_license_usd, managed_services_usd, implementation_usd, cr_usd, er_usd, linked_to_impl, gp_margin_percent, eligible_for_perpetual_incentive, project_id, customer_name, sales_rep_employee_id, sales_head_employee_id, sales_engineering_employee_id, sales_engineering_head_employee_id, product_specialist_employee_id, product_specialist_head_employee_id, solution_manager_employee_id, solution_manager_head_employee_id, solution_architect_employee_id, sales_engineering_team_id, solution_manager_team_id')
      .eq('month_year', fullMonthYear),
  ]);

  return {
    allDeals: dealsResult.data || [],
    allClosingArr: closingArrResult.data || [],
    allPerformanceTargets: perfTargetsResult.data || [],
    allExchangeRates: exchangeRatesResult.data || [],
    allUserTargets: userTargetsResult.data || [],
    allPlanMetrics: planMetricsResult.data || [],
    allMultiplierGrids: multiplierGridsResult.data || [],
    allPlanCommissions: planCommissionsResult.data || [],
    allPlanSpiffs: planSpiffsResult.data || [],
    allPriorPayouts: priorPayoutsResult.data || [],
    allDealCollections: collectionsResult.data || [],
    allTeamMemberships: (teamMembershipsResult.data as any[]) || [],
    allDealTeamSpiffAllocations: (dtsAllocationsResult.data as any[]) || [],
    allClawbackLedger: (clawbackLedgerResult.data as any[]) || [],
    allRenewalMultipliers: (renewalMultipliersResult.data as any[]) || [],
    allVpAttributions: vpAttributionsResult.data || [],
    allMonthlyPayouts: monthlyPayoutsResult.data || [],
    allEmployees: employeesResult.data || [],
    allCommissionDeals: commissionDealsResult.data || [],
  };
}

// ============= TYPE DEFINITIONS =============

export interface MetricPayoutDetail {
  componentType: 'variable_pay' | 'commission' | 'nrr' | 'spiff' | 'deal_team_spiff' | 'collection_release' | 'year_end_release' | 'clawback';
  metricName: string;
  planId: string | null;
  planName: string | null;
  targetBonusUsd: number;
  allocatedOteUsd: number;
  targetUsd: number;
  actualUsd: number;
  achievementPct: number;
  multiplier: number;
  ytdEligibleUsd: number;
  priorPaidUsd: number;
  thisMonthUsd: number;
  bookingUsd: number;
  collectionUsd: number;
  yearEndUsd: number;
  notes: string | null;
  commissionRatePct?: number;
}


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
  nrrDealBreakdowns: NRRDealBreakdown[];
  spiffDealBreakdowns: SpiffDealBreakdown[];
  
  // Metric-level detailed workings
  metricDetails: MetricPayoutDetail[];
  
  // Closing ARR project-level details
  closingArrDetails: ClosingArrPayoutDetail[];
}

export interface ClosingArrPayoutDetail {
  closingArrActualId: string;
  employeeId: string;
  pid: string;
  customerName: string | null;
  customerCode: string;
  bu: string;
  product: string;
  monthYear: string;
  endDate: string | null;
  isMultiYear: boolean;
  renewalYears: number;
  closingArrUsd: number;
  multiplier: number;
  adjustedArrUsd: number;
  isEligible: boolean;
  exclusionReason: string | null;
  orderCategory2: string | null;
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
    .eq('is_active', true)
    .not('sales_function', 'is', null);
  
  if (!employees || employees.length === 0) {
    errors.push({
      type: 'no_employees',
      message: 'No active sales-eligible employees found',
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
 * Get market exchange rate from prefetched data
 */
function getMarketExchangeRateFromPrefetch(
  currencyCode: string,
  prefetched: PrefetchedData
): number {
  if (currencyCode === 'USD') return 1;
  const rate = prefetched.allExchangeRates.find(r => r.currency_code === currencyCode);
  return rate?.rate_to_usd ?? 1;
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

// ============= IN-MEMORY FILTER HELPERS =============

/**
 * Get team-attributed deal IDs from prefetched data
 */
function getTeamAttributedDealIdsFromPrefetch(
  employeeId: string,
  monthYear: string,
  prefetched: PrefetchedData
): string[] {
  // Find teams this employee belongs to
  const memberships = prefetched.allTeamMemberships.filter((m: any) =>
    m.employee_id === employeeId &&
    m.is_active === true &&
    m.effective_from <= monthYear &&
    (m.effective_to === null || m.effective_to >= monthYear)
  );

  if (memberships.length === 0) return [];
  const teamIds = new Set(memberships.map((m: any) => m.team_id));

  // Find deals that reference any of these teams
  const matchingDeals = prefetched.allDeals.filter(d =>
    (d.sales_engineering_team_id && teamIds.has(d.sales_engineering_team_id)) ||
    (d.solution_manager_team_id && teamIds.has(d.solution_manager_team_id))
  );

  return matchingDeals.map(d => d.id);
}

/**
 * Filter deals where employee is a participant
 */
function getEmployeeDeals(
  empCode: string,
  deals: any[]
): any[] {
  return deals.filter(d =>
    d.sales_rep_employee_id === empCode ||
    d.sales_head_employee_id === empCode ||
    d.sales_engineering_employee_id === empCode ||
    d.sales_engineering_head_employee_id === empCode ||
    d.product_specialist_employee_id === empCode ||
    d.product_specialist_head_employee_id === empCode ||
    d.solution_manager_employee_id === empCode ||
    d.solution_manager_head_employee_id === empCode ||
    d.solution_architect_employee_id === empCode
  );
}

/**
 * Get prior months' payout sum from prefetched data
 */
function getPriorMonthsPayoutFromPrefetch(
  employeeId: string,
  fiscalYear: number,
  currentMonthYear: string,
  payoutType: string,
  prefetched: PrefetchedData
): number {
  const currentFull = ensureFullDate(currentMonthYear);
  return prefetched.allPriorPayouts
    .filter(p =>
      p.employee_id === employeeId &&
      p.payout_type === payoutType &&
      p.month_year >= `${fiscalYear}-01-01` &&
      p.month_year < currentFull &&
      p.payout_run_id !== null
    )
    .reduce((sum: number, p: any) => sum + (p.calculated_amount_usd || 0), 0);
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
  prefetched: PrefetchedData;
}

/**
 * Calculate Variable Pay for a single employee using prefetched data
 */
function calculateEmployeeVariablePay(
  ctx: EmployeeCalculationContext
): {
  totalVpUsd: number;
  ytdVpUsd: number;
  priorVpUsd: number;
  bookingUsd: number;
  collectionUsd: number;
  yearEndUsd: number;
  attributions: DealVariablePayAttribution[];
  vpContext: AggregateVariablePayContext | null;
  vpMetricDetails: Array<{
    metricName: string;
    targetUsd: number;
    actualUsd: number;
    achievementPct: number;
    multiplier: number;
    allocatedOteUsd: number;
    ytdEligibleUsd: number;
    bookingPct: number;
    collectionPct: number;
    yearEndPct: number;
  }>;
  closingArrDetails: ClosingArrPayoutDetail[];
} {
  if (ctx.metrics.length === 0) {
    return { totalVpUsd: 0, ytdVpUsd: 0, priorVpUsd: 0, bookingUsd: 0, collectionUsd: 0, yearEndUsd: 0, attributions: [], vpContext: null, vpMetricDetails: [], closingArrDetails: [] };
  }

  const empId = ctx.employee.employee_id;

  let ytdVpUsd = 0;
  let ytdBookingUsd = 0;
  let ytdCollectionUsd = 0;
  let ytdYearEndUsd = 0;
  let allAttributions: DealVariablePayAttribution[] = [];
  let lastContext: AggregateVariablePayContext | null = null;
  const closingArrDetailRecords: ClosingArrPayoutDetail[] = [];
  
  const vpMetricDetails: Array<{
    metricName: string;
    targetUsd: number;
    actualUsd: number;
    achievementPct: number;
    multiplier: number;
    allocatedOteUsd: number;
    ytdEligibleUsd: number;
    bookingPct: number;
    collectionPct: number;
    yearEndPct: number;
  }> = [];

  for (const metric of ctx.metrics) {
    // Get employee's target for this metric from prefetched data
    const perfTarget = ctx.prefetched.allPerformanceTargets.find(
      t => t.employee_id === empId && t.effective_year === ctx.fiscalYear && t.metric_type === metric.metric_name
    );

    const targetUsd = perfTarget?.target_value_usd ?? 0;
    if (targetUsd === 0) continue;

    const bonusAllocationUsd = (ctx.targetBonusUsd * metric.weightage_percent) / 100;

    const isClosingArr = metric.metric_name.toLowerCase().includes('closing arr');
    const isTeamMetric = metric.metric_name.startsWith("Team ");
    const isOrgMetric = metric.metric_name.startsWith("Org ");

    const bookingPct = metric.payout_on_booking_pct ?? 0;
    const collectionPct = metric.payout_on_collection_pct ?? 100;
    const yearEndPct = metric.payout_on_year_end_pct ?? 0;

    // For "Team " prefix metrics, get subordinate employee IDs from prefetched data
    let teamReportIds: string[] = [];
    if (isTeamMetric) {
      teamReportIds = ctx.prefetched.allEmployees
        .filter(e => e.manager_employee_id === empId && e.is_active)
        .map(e => e.employee_id);
    }

    if (isClosingArr) {
      // Closing ARR: filter from prefetched closing_arr_actuals
      const isTeamLead = (ctx.employee.sales_function || "").startsWith("Team Lead");
      
      let closingArrFilter: (arr: any) => boolean;
      if (isTeamLead && ctx.metrics.some(m => m.metric_name.startsWith("Team "))) {
        let tlReportIds = teamReportIds;
        if (tlReportIds.length === 0) {
          tlReportIds = ctx.prefetched.allEmployees
            .filter(e => e.manager_employee_id === empId && e.is_active)
            .map(e => e.employee_id);
        }
        const allIds = new Set([empId, ...tlReportIds]);
        closingArrFilter = (arr: any) =>
          (allIds.has(arr.sales_rep_employee_id) || allIds.has(arr.sales_head_employee_id)) &&
          arr.end_date > `${ctx.fiscalYear}-12-31`;
      } else {
        closingArrFilter = (arr: any) =>
          (arr.sales_rep_employee_id === empId || arr.sales_head_employee_id === empId) &&
          arr.end_date > `${ctx.fiscalYear}-12-31`;
      }

      const closingArr = ctx.prefetched.allClosingArr.filter(closingArrFilter);

      // Also get ALL closing ARR records for this employee (including ineligible) for audit
      const isTeamLead2 = (ctx.employee.sales_function || "").startsWith("Team Lead");
      let allEmployeeClosingArr: any[];
      if (isTeamLead2 && ctx.metrics.some(m => m.metric_name.startsWith("Team "))) {
        let tlReportIds2 = teamReportIds;
        if (tlReportIds2.length === 0) {
          tlReportIds2 = ctx.prefetched.allEmployees
            .filter(e => e.manager_employee_id === empId && e.is_active)
            .map(e => e.employee_id);
        }
        const allIds2 = new Set([empId, ...tlReportIds2]);
        allEmployeeClosingArr = ctx.prefetched.allClosingArr.filter((arr: any) =>
          allIds2.has(arr.sales_rep_employee_id) || allIds2.has(arr.sales_head_employee_id)
        );
      } else {
        allEmployeeClosingArr = ctx.prefetched.allClosingArr.filter((arr: any) =>
          arr.sales_rep_employee_id === empId || arr.sales_head_employee_id === empId
        );
      }

      // Get renewal multipliers for plan from prefetched data
      const multiplierTiers = ctx.prefetched.allRenewalMultipliers
        .filter((m: any) => m.plan_id === ctx.planId);

      const findMultiplier = (years: number): number => {
        const sorted = [...multiplierTiers].sort((a: any, b: any) => b.min_years - a.min_years);
        for (const m of sorted) {
          if (years >= m.min_years && (m.max_years === null || years <= m.max_years)) {
            return m.multiplier_value;
          }
        }
        return 1.0;
      };

      // Build closing ARR project-level audit details (ALL records, eligible and ineligible)
      const fiscalYearEnd = `${ctx.fiscalYear}-12-31`;
      for (const arr of allEmployeeClosingArr) {
        const rawArr = arr.closing_arr || 0;
        const mult = (arr.is_multi_year && arr.renewal_years > 0) ? findMultiplier(arr.renewal_years) : 1.0;
        const adjustedArr = rawArr * mult;
        const eligible = arr.end_date > fiscalYearEnd;
        closingArrDetailRecords.push({
          closingArrActualId: arr.id,
          employeeId: ctx.employee.employee_id,
          pid: arr.pid,
          customerName: arr.customer_name,
          customerCode: arr.customer_code,
          bu: arr.bu,
          product: arr.product,
          monthYear: arr.month_year,
          endDate: arr.end_date,
          isMultiYear: arr.is_multi_year,
          renewalYears: arr.renewal_years,
          closingArrUsd: rawArr,
          multiplier: mult,
          adjustedArrUsd: adjustedArr,
          isEligible: eligible,
          exclusionReason: eligible ? null : 'Contract end_date <= fiscal year end',
          orderCategory2: arr.order_category_2 || null,
        });
      }

      const closingByMonth = new Map<string, number>();
      closingArr.forEach((arr: any) => {
        const monthKey = arr.month_year?.substring(0, 7) || '';
        let value = arr.closing_arr || 0;
        if (arr.is_multi_year && arr.renewal_years > 0) {
          value = value * findMultiplier(arr.renewal_years);
        }
        closingByMonth.set(monthKey, (closingByMonth.get(monthKey) || 0) + value);
      });

      const sortedMonths = Array.from(closingByMonth.keys()).sort();
      const latestMonth = sortedMonths[sortedMonths.length - 1];
      const totalActualUsd = latestMonth ? closingByMonth.get(latestMonth) || 0 : 0;

      if (totalActualUsd === 0) continue;

      const vpCalc = calculateAggregateVariablePay(totalActualUsd, targetUsd, bonusAllocationUsd, metric);

      ytdVpUsd += vpCalc.totalVariablePay;
      ytdBookingUsd += vpCalc.totalVariablePay * (bookingPct / 100);
      ytdCollectionUsd += vpCalc.totalVariablePay * (collectionPct / 100);
      ytdYearEndUsd += vpCalc.totalVariablePay * (yearEndPct / 100);

      vpMetricDetails.push({
        metricName: metric.metric_name,
        targetUsd,
        actualUsd: totalActualUsd,
        achievementPct: Math.round(vpCalc.achievementPct * 100) / 100,
        multiplier: vpCalc.multiplier,
        allocatedOteUsd: bonusAllocationUsd,
        ytdEligibleUsd: vpCalc.totalVariablePay,
        bookingPct,
        collectionPct,
        yearEndPct,
      });

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
      // Deal-based metric
      let fetchedDeals: any[];

      if (isOrgMetric) {
        fetchedDeals = ctx.prefetched.allDeals;
      } else if (isTeamMetric && teamReportIds.length > 0) {
        const teamIdSet = new Set(teamReportIds);
        fetchedDeals = ctx.prefetched.allDeals.filter(d => teamIdSet.has(d.sales_rep_employee_id));
      } else {
        // Individual participant filter + support team-attributed deals
        const directDeals = getEmployeeDeals(empId, ctx.prefetched.allDeals);
        const teamDealIds = getTeamAttributedDealIdsFromPrefetch(empId, ctx.monthYear, ctx.prefetched);
        
        if (teamDealIds.length > 0) {
          const existingIds = new Set(directDeals.map(d => d.id));
          const missingIds = teamDealIds.filter(id => !existingIds.has(id));
          const teamDeals = ctx.prefetched.allDeals.filter(d => missingIds.includes(d.id));
          fetchedDeals = directDeals.concat(teamDeals);
        } else {
          fetchedDeals = directDeals;
        }
      }

      const validDeals: DealForAttribution[] = fetchedDeals.map(d => ({
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
      
      vpMetricDetails.push({
        metricName: metric.metric_name,
        targetUsd,
        actualUsd: result.context.totalActualUsd,
        achievementPct: result.context.achievementPct,
        multiplier: result.context.multiplier,
        allocatedOteUsd: bonusAllocationUsd,
        ytdEligibleUsd: result.context.totalVariablePayUsd,
        bookingPct,
        collectionPct,
        yearEndPct,
      });
    }
  }

  // Calculate incremental VP (subtract prior months) from prefetched data
  const priorVp = getPriorMonthsPayoutFromPrefetch(ctx.employee.id, ctx.fiscalYear, ctx.monthYear, 'Variable Pay', ctx.prefetched);
  const monthlyVpUsd = Math.max(0, ytdVpUsd - priorVp);
  
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
    ytdVpUsd,
    priorVpUsd: priorVp,
    bookingUsd: monthlyBookingUsd,
    collectionUsd: monthlyCollectionUsd,
    yearEndUsd: monthlyYearEndUsd,
    attributions: allAttributions,
    vpContext: lastContext,
    vpMetricDetails,
    closingArrDetails: closingArrDetailRecords,
  };
}

/**
 * Calculate Commissions for a single employee using prefetched data
 */
function calculateEmployeeCommissions(
  ctx: EmployeeCalculationContext
): {
  totalCommUsd: number;
  bookingUsd: number;
  collectionUsd: number;
  yearEndUsd: number;
  calculations: CommissionCalculation[];
} {
  if (ctx.commissions.length === 0) {
    return { totalCommUsd: 0, bookingUsd: 0, collectionUsd: 0, yearEndUsd: 0, calculations: [] };
  }
  
  const empId = ctx.employee.employee_id;
  
  // Get deals for current month from prefetched commission deals
  let directDeals = getEmployeeDeals(empId, ctx.prefetched.allCommissionDeals);
  
  // Also include team-attributed deals
  const teamDealIds = getTeamAttributedDealIdsFromPrefetch(empId, ctx.monthYear, ctx.prefetched);
  if (teamDealIds.length > 0) {
    const existingIds = new Set(directDeals.map(d => d.id));
    const missingIds = teamDealIds.filter(id => !existingIds.has(id));
    const teamDeals = ctx.prefetched.allCommissionDeals.filter(d => missingIds.includes(d.id));
    directDeals = directDeals.concat(teamDeals);
  }
  const deals = directDeals;
  
  const calculations: CommissionCalculation[] = [];
  
  for (const deal of deals) {
    const isLinkedToImpl = deal.linked_to_impl === true;
    
    const getSplits = (comm: PlanCommission) => {
      if (isLinkedToImpl) {
        return { booking: 0, collection: 100, yearEnd: 0 };
      }
      let booking = comm.payout_on_booking_pct ?? 0;
      let collection = comm.payout_on_collection_pct ?? 100;
      const yearEnd = comm.payout_on_year_end_pct ?? 0;
      
      if (ctx.isClawbackExempt) {
        booking = booking + collection;
        collection = 0;
      }
      
      return { booking, collection, yearEnd };
    };

    // Perpetual License
    if (deal.perpetual_license_usd && deal.perpetual_license_usd > 0 && deal.eligible_for_perpetual_incentive === true) {
      const comm = ctx.commissions.find(c => c.commission_type === 'Perpetual License' && c.is_active);
      if (comm) {
        const splits = getSplits(comm);
        const result = calculateDealCommission(
          deal.perpetual_license_usd, comm.commission_rate_pct, null,
          splits.booking, splits.collection, splits.yearEnd
        );
        calculations.push({
          dealId: deal.id, commissionType: 'Perpetual License',
          tcvUsd: deal.perpetual_license_usd, commissionRatePct: comm.commission_rate_pct,
          minThresholdUsd: null, qualifies: result.qualifies,
          grossCommission: result.gross, paidAmount: result.paid,
          holdbackAmount: result.holdback, yearEndHoldback: result.yearEndHoldback,
        });
      }
    }
    
    // Managed Services
    if (deal.managed_services_usd && deal.managed_services_usd > 0) {
      const comm = ctx.commissions.find(c => c.commission_type === 'Managed Services' && c.is_active);
      if (comm) {
        const minGpMargin = (comm as any).min_gp_margin_pct;
        const dealGpMargin = deal.gp_margin_percent;
        const gpMarginQualifies = minGpMargin == null || (dealGpMargin != null && dealGpMargin >= minGpMargin);
        
        if (gpMarginQualifies) {
          const splits = getSplits(comm);
          const result = calculateDealCommission(
            deal.managed_services_usd, comm.commission_rate_pct, comm.min_threshold_usd,
            splits.booking, splits.collection, splits.yearEnd
          );
          calculations.push({
            dealId: deal.id, commissionType: 'Managed Services',
            tcvUsd: deal.managed_services_usd, commissionRatePct: comm.commission_rate_pct,
            minThresholdUsd: comm.min_threshold_usd, qualifies: result.qualifies,
            grossCommission: result.gross, paidAmount: result.paid,
            holdbackAmount: result.holdback, yearEndHoldback: result.yearEndHoldback,
          });
        } else {
          calculations.push({
            dealId: deal.id, commissionType: 'Managed Services',
            tcvUsd: deal.managed_services_usd, commissionRatePct: comm.commission_rate_pct,
            minThresholdUsd: comm.min_threshold_usd, qualifies: false,
            grossCommission: 0, paidAmount: 0, holdbackAmount: 0, yearEndHoldback: 0,
            exclusionReason: `GP margin ${dealGpMargin ?? 'N/A'}% below minimum ${minGpMargin}%`,
            gpMarginPct: dealGpMargin, minGpMarginPct: minGpMargin,
          });
        }
      }
    }
    
    // Implementation
    if (deal.implementation_usd && deal.implementation_usd > 0) {
      const comm = ctx.commissions.find(c => c.commission_type === 'Implementation' && c.is_active);
      if (comm) {
        const splits = getSplits(comm);
        const result = calculateDealCommission(
          deal.implementation_usd, comm.commission_rate_pct, comm.min_threshold_usd,
          splits.booking, splits.collection, splits.yearEnd
        );
        calculations.push({
          dealId: deal.id, commissionType: 'Implementation',
          tcvUsd: deal.implementation_usd, commissionRatePct: comm.commission_rate_pct,
          minThresholdUsd: comm.min_threshold_usd, qualifies: result.qualifies,
          grossCommission: result.gross, paidAmount: result.paid,
          holdbackAmount: result.holdback, yearEndHoldback: result.yearEndHoldback,
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
          crErUsd, comm.commission_rate_pct, comm.min_threshold_usd,
          splits.booking, splits.collection, splits.yearEnd
        );
        calculations.push({
          dealId: deal.id, commissionType: 'CR/ER',
          tcvUsd: crErUsd, commissionRatePct: comm.commission_rate_pct,
          minThresholdUsd: comm.min_threshold_usd, qualifies: result.qualifies,
          grossCommission: result.gross, paidAmount: result.paid,
          holdbackAmount: result.holdback, yearEndHoldback: result.yearEndHoldback,
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
 * Calculate collection releases using prefetched data.
 */
function calculateCollectionReleasesFromPrefetch(
  employeeId: string,
  employeeCode: string,
  monthYear: string,
  fiscalYear: number,
  prefetched: PrefetchedData
): { vpReleaseUsd: number; commReleaseUsd: number; clawbackReversedDealIds: string[] } {
  const fullMonthYear = ensureFullDate(monthYear);
  
  // Find deals collected this month
  const collections = prefetched.allDealCollections.filter(
    c => c.collection_month === fullMonthYear && c.is_collected === true
  );
  
  if (collections.length === 0) {
    return { vpReleaseUsd: 0, commReleaseUsd: 0, clawbackReversedDealIds: [] };
  }
  
  const collectedDealIds = new Set(collections.map(c => c.deal_id));
  
  // VP releases from prefetched VP attributions
  const vpAttrs = prefetched.allVpAttributions.filter(
    a => a.employee_id === employeeId && a.fiscal_year === fiscalYear && collectedDealIds.has(a.deal_id)
  );
  
  const vpReleaseUsd = vpAttrs.reduce((sum: number, a: any) => {
    if (a.is_clawback_triggered) {
      return sum + (a.variable_pay_split_usd || 0);
    }
    return sum + (a.payout_on_collection_usd || 0);
  }, 0);
  
  const clawbackReversedDealIds = vpAttrs
    .filter((a: any) => a.is_clawback_triggered)
    .map((a: any) => a.deal_id);
  
  // Commission releases from prefetched monthly payouts
  const commPayouts = prefetched.allMonthlyPayouts.filter(
    p => p.employee_id === employeeId &&
      p.payout_type !== 'Variable Pay' &&
      p.payout_type !== 'Clawback' &&
      p.payout_type !== 'Collection Release' &&
      p.payout_type !== 'Year-End Release' &&
      collectedDealIds.has(p.deal_id)
  );
  
  const commReleaseUsd = commPayouts.reduce((sum: number, p: any) => sum + (p.collection_amount_usd || 0), 0);
  
  return { vpReleaseUsd, commReleaseUsd, clawbackReversedDealIds };
}

/**
 * Apply clawback ledger resolutions for collected deals (mutates DB)
 */
async function resolveClawbacksForCollectedDeals(
  employeeId: string,
  clawbackReversedDealIds: string[],
  monthYear: string,
  prefetched: PrefetchedData
): Promise<void> {
  if (clawbackReversedDealIds.length === 0) return;
  
  const fullMonthYear = ensureFullDate(monthYear);
  const ledgerEntries = prefetched.allClawbackLedger.filter(
    (e: any) => e.employee_id === employeeId &&
      clawbackReversedDealIds.includes(e.deal_id) &&
      (e.status === 'pending' || e.status === 'partial')
  );
  
  for (const entry of ledgerEntries) {
    await supabase
      .from('clawback_ledger')
      .update({
        status: 'recovered',
        recovered_amount_usd: entry.original_amount_usd,
        last_recovery_month: fullMonthYear,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entry.id);
  }
}

// ============= YEAR-END RELEASES (DECEMBER) =============

/**
 * Calculate year-end releases from prefetched data
 */
function calculateYearEndReleasesFromPrefetch(
  employeeId: string,
  fiscalYear: number,
  prefetched: PrefetchedData
): number {
  return prefetched.allMonthlyPayouts
    .filter(p =>
      p.employee_id === employeeId &&
      p.month_year >= `${fiscalYear}-01-01` &&
      p.month_year <= `${fiscalYear}-12-01` &&
      p.payout_type !== 'Year-End Release' &&
      p.year_end_amount_usd != null
    )
    .reduce((sum: number, p: any) => sum + (p.year_end_amount_usd || 0), 0);
}

/**
 * Calculate full monthly payout for a single employee using prefetched data.
 */
export function calculateMonthlyPayoutFromPrefetch(
  employee: Employee,
  monthYear: string,
  prefetched: PrefetchedData
): EmployeePayoutResult | null {
  const fiscalYear = parseInt(monthYear.substring(0, 4));
  const currentMonth = parseInt(monthYear.substring(5, 7));
  const isDecember = currentMonth === 12;
  const fullMonthYear = ensureFullDate(monthYear);
  
  // Get employee's plan assignment from prefetched data
  const target = prefetched.allUserTargets.find(
    t => t.user_id === employee.id &&
      t.effective_start_date <= fullMonthYear &&
      t.effective_end_date >= fullMonthYear
  );
  
  if (!target) {
    return null;
  }
  
  const planId = target.plan_id;
  const planData = target.comp_plans as any;
  const planName = planData?.name || 'Unknown Plan';
  const isClawbackExempt = planData?.is_clawback_exempt === true;
  
  // === BLENDED PRO-RATA TARGET BONUS ===
  const allAssignments = prefetched.allUserTargets
    .filter(t =>
      t.user_id === employee.id &&
      t.effective_start_date <= `${fiscalYear}-12-31` &&
      t.effective_end_date >= `${fiscalYear}-01-01`
    )
    .sort((a: any, b: any) => a.effective_start_date.localeCompare(b.effective_start_date));

  let targetBonusUsd: number;
  
  if (allAssignments.length > 1) {
    const segments: BlendedProRataSegment[] = allAssignments.map((a: any) => ({
      targetBonusUsd: a.target_bonus_usd ?? 0,
      startDate: a.effective_start_date,
      endDate: a.effective_end_date,
    }));
    const currentMonthStr = monthYear.substring(0, 7);
    const blendedResult = calculateBlendedProRata(segments, currentMonthStr, fiscalYear);
    targetBonusUsd = blendedResult.effectiveTargetBonusUsd;
  } else {
    targetBonusUsd = target.target_bonus_usd ?? employee.tvp_usd ?? 0;
  }
  
  // Get plan metrics with multiplier grids from prefetched data
  const planMetrics = prefetched.allPlanMetrics.filter((m: any) => m.plan_id === planId);
  const metricIds = new Set(planMetrics.map((m: any) => m.id));
  const grids = prefetched.allMultiplierGrids.filter((g: any) => metricIds.has(g.plan_metric_id));
  
  const metricsWithGrids: PlanMetric[] = planMetrics.map((metric: any) => ({
    ...metric,
    multiplier_grids: grids.filter((g: any) => g.plan_metric_id === metric.id),
  }));
  
  // Get plan commissions from prefetched data
  const commissions = prefetched.allPlanCommissions.filter((c: any) => c.plan_id === planId) as unknown as PlanCommission[];
  
  // Get market rate from prefetched data
  const marketRate = getMarketExchangeRateFromPrefetch(employee.local_currency, prefetched);
  const compensationRate = employee.compensation_exchange_rate ?? 1;
  
  const ctx: EmployeeCalculationContext = {
    employee,
    monthYear,
    fiscalYear,
    planId,
    planName,
    metrics: metricsWithGrids,
    commissions,
    targetBonusUsd,
    marketRate,
    isClawbackExempt,
    prefetched,
  };
  
  // Calculate VP (synchronous now - no DB calls)
  const vpResult = calculateEmployeeVariablePay(ctx);
  
  // Calculate Commissions (synchronous)
  const commResult = calculateEmployeeCommissions(ctx);
  
  // Calculate Collection Releases (synchronous)
  const collReleases = calculateCollectionReleasesFromPrefetch(
    employee.id, employee.employee_id, monthYear, fiscalYear, prefetched
  );
  const collectionReleasesUsd = collReleases.vpReleaseUsd + collReleases.commReleaseUsd;
  const collectionReleaseNotes = collReleases.clawbackReversedDealIds.length > 0
    ? `Includes full release for clawback-reversed deal(s). Released upon collection of previously held amounts.`
    : 'Released upon collection of previously held amounts';
  
  // Calculate Year-End Releases (December only, synchronous)
  let yearEndReleasesUsd = 0;
  if (isDecember) {
    yearEndReleasesUsd = calculateYearEndReleasesFromPrefetch(employee.id, fiscalYear, prefetched);
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
    const nrrDeals = getEmployeeDeals(empId, prefetched.allDeals);
    
    // Get targets from prefetched data
    const crErTarget = prefetched.allPerformanceTargets.find(
      t => t.employee_id === empId && t.effective_year === fiscalYear && t.metric_type === 'CR/ER'
    );
    const implTarget = prefetched.allPerformanceTargets.find(
      t => t.employee_id === empId && t.effective_year === fiscalYear && t.metric_type === 'Implementation'
    );
    
    nrrResult = calculateNRRPayout(
      nrrDeals as NRRDeal[],
      crErTarget?.target_value_usd ?? 0,
      implTarget?.target_value_usd ?? 0,
      nrrOtePct,
      targetBonusUsd,
      crErMinGp,
      implMinGp
    );
    
    // Apply incremental logic from prefetched data
    const priorNrr = getPriorMonthsPayoutFromPrefetch(employee.id, fiscalYear, monthYear, 'NRR Additional Pay', prefetched);
    nrrPayoutUsd = Math.max(0, nrrResult.payoutUsd - priorNrr);
  }

  // === SPIFF Calculations ===
  let spiffPayoutUsd = 0;
  let spiffBreakdowns: SpiffDealBreakdown[] = [];
  let spiffResult: SpiffAggregateResult = { totalSpiffUsd: 0, breakdowns: [], softwareTargetUsd: 0, eligibleActualsUsd: 0, softwareVariableOteUsd: 0, spiffRatePct: 0 };
  
  const planSpiffs = prefetched.allPlanSpiffs.filter((s: any) => s.plan_id === planId);
  
  if (planSpiffs.length > 0) {
    const empId = employee.employee_id;
    const spiffDeals = getEmployeeDeals(empId, prefetched.allDeals);
    
    // Build targets by metric from prefetched data
    const spiffMetrics: SpiffMetric[] = metricsWithGrids.map(m => ({
      metric_name: m.metric_name,
      weightage_percent: m.weightage_percent,
    }));
    
    const targetsByMetric: Record<string, number> = {};
    for (const spiff of planSpiffs) {
      if (!targetsByMetric[spiff.linked_metric_name]) {
        const perfTarget = prefetched.allPerformanceTargets.find(
          t => t.employee_id === empId && t.effective_year === fiscalYear && t.metric_type === spiff.linked_metric_name
        );
        targetsByMetric[spiff.linked_metric_name] = perfTarget?.target_value_usd ?? 0;
      }
    }
    
    spiffResult = calculateAllSpiffs(
      planSpiffs as SpiffConfig[],
      spiffDeals as SpiffDeal[],
      spiffMetrics,
      targetBonusUsd,
      targetsByMetric
    );
    const priorSpiff = getPriorMonthsPayoutFromPrefetch(employee.id, fiscalYear, monthYear, 'SPIFF', prefetched);
    spiffPayoutUsd = Math.max(0, spiffResult.totalSpiffUsd - priorSpiff);
    spiffBreakdowns = spiffResult.breakdowns;
  }

  // === Deal Team SPIFF (manual allocations) ===
  const dealTeamSpiffUsd = prefetched.allDealTeamSpiffAllocations
    .filter((a: any) => a.employee_id === employee.employee_id)
    .reduce((sum: number, a: any) => sum + (a.allocated_amount_usd || 0), 0);
  
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
  
  // Payable This Month
  const nrrBookingUsd = nrrPayoutUsd * nrrBookingPct;
  
  let spiffBookingUsd = 0;
  let spiffCollectionUsd = 0;
  let spiffYearEndUsd = 0;
  if (planSpiffs.length > 0) {
    for (const breakdown of spiffBreakdowns) {
      const matchingSpiff = planSpiffs.find((s: any) => s.spiff_name === breakdown.spiffName);
      const bkPct = (matchingSpiff as any)?.payout_on_booking_pct ?? 0;
      const coPct = (matchingSpiff as any)?.payout_on_collection_pct ?? 100;
      const yePct = (matchingSpiff as any)?.payout_on_year_end_pct ?? 0;
      spiffBookingUsd += breakdown.spiffPayoutUsd * (bkPct / 100);
      spiffCollectionUsd += breakdown.spiffPayoutUsd * (coPct / 100);
      spiffYearEndUsd += breakdown.spiffPayoutUsd * (yePct / 100);
    }
  }
  
  const payableThisMonthUsd = vpResult.bookingUsd + commResult.bookingUsd + collectionReleasesUsd + yearEndReleasesUsd + nrrBookingUsd + spiffBookingUsd + dealTeamSpiffUsd;
  
  // Note: clawback recovery will be applied after this function returns (needs async DB mutation)
  const payableThisMonthLocal = convertVPToLocal(payableThisMonthUsd, compensationRate);
  
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
    nrrDealBreakdowns: nrrResult?.dealBreakdowns ?? [],
    spiffDealBreakdowns: spiffBreakdowns,
    
    // Build detailed metric workings
    metricDetails: (() => {
      const details: MetricPayoutDetail[] = [];
      const vpRatio = vpResult.ytdVpUsd > 0 ? vpResult.totalVpUsd / vpResult.ytdVpUsd : 0;
      
      // VP metric details
      for (const md of vpResult.vpMetricDetails) {
        const thisMonthEligible = md.ytdEligibleUsd * vpRatio;
        const priorForMetric = md.ytdEligibleUsd - thisMonthEligible;
        details.push({
          componentType: 'variable_pay',
          metricName: md.metricName,
          planId,
          planName,
          targetBonusUsd,
          allocatedOteUsd: md.allocatedOteUsd,
          targetUsd: md.targetUsd,
          actualUsd: md.actualUsd,
          achievementPct: md.achievementPct,
          multiplier: md.multiplier,
          ytdEligibleUsd: md.ytdEligibleUsd,
          priorPaidUsd: priorForMetric,
          thisMonthUsd: thisMonthEligible,
          bookingUsd: thisMonthEligible * (md.bookingPct / 100),
          collectionUsd: thisMonthEligible * (md.collectionPct / 100),
          yearEndUsd: thisMonthEligible * (md.yearEndPct / 100),
          notes: null,
        });
      }
      
      // Commission details
      for (const c of commResult.calculations) {
        if (!c.qualifies) continue;
        details.push({
          componentType: 'commission',
          metricName: c.commissionType,
          planId,
          planName,
          targetBonusUsd: 0,
          allocatedOteUsd: 0,
          targetUsd: c.minThresholdUsd || 0,
          actualUsd: c.tcvUsd,
          achievementPct: 0,
          multiplier: c.commissionRatePct / 100,
          ytdEligibleUsd: c.grossCommission,
          priorPaidUsd: 0,
          thisMonthUsd: c.grossCommission,
          bookingUsd: c.paidAmount,
          collectionUsd: c.holdbackAmount,
          yearEndUsd: c.yearEndHoldback,
          notes: null,
          commissionRatePct: c.commissionRatePct,
        });
      }
      
      // NRR
      if (nrrPayoutUsd > 0 && nrrResult) {
        details.push({
          componentType: 'nrr',
          metricName: 'NRR Additional Pay',
          planId,
          planName,
          targetBonusUsd,
          allocatedOteUsd: targetBonusUsd * (nrrOtePct / 100),
          targetUsd: nrrResult.nrrTarget,
          actualUsd: nrrResult.nrrActuals,
          achievementPct: nrrResult.achievementPct,
          multiplier: 1,
          ytdEligibleUsd: nrrResult.payoutUsd,
          priorPaidUsd: nrrResult.payoutUsd - nrrPayoutUsd,
          thisMonthUsd: nrrPayoutUsd,
          bookingUsd: nrrPayoutUsd * nrrBookingPct,
          collectionUsd: nrrPayoutUsd * nrrCollectionPct,
          yearEndUsd: nrrPayoutUsd * nrrYearEndPct,
          notes: null,
        });
      }
      
      // SPIFF
      if (spiffPayoutUsd > 0) {
        const spiffAllocatedOte = spiffResult.softwareVariableOteUsd * (spiffResult.spiffRatePct / 100);
        const spiffAchPct = spiffResult.softwareTargetUsd > 0
          ? (spiffResult.eligibleActualsUsd / spiffResult.softwareTargetUsd) * 100
          : 0;
        details.push({
          componentType: 'spiff',
          metricName: 'SPIFF',
          planId,
          planName,
          targetBonusUsd,
          allocatedOteUsd: Math.round(spiffAllocatedOte * 100) / 100,
          targetUsd: spiffResult.softwareTargetUsd,
          actualUsd: spiffResult.eligibleActualsUsd,
          achievementPct: Math.round(spiffAchPct * 10000) / 10000,
          multiplier: 1,
          ytdEligibleUsd: spiffResult.totalSpiffUsd,
          priorPaidUsd: spiffResult.totalSpiffUsd - spiffPayoutUsd,
          thisMonthUsd: spiffPayoutUsd,
          bookingUsd: spiffBookingUsd,
          collectionUsd: spiffCollectionUsd,
          yearEndUsd: spiffYearEndUsd,
          notes: spiffBreakdowns.map(b => `${b.spiffName}: $${b.spiffPayoutUsd.toLocaleString()}`).join('; '),
        });
      }
      
      // Deal Team SPIFF
      if (dealTeamSpiffUsd > 0) {
        details.push({
          componentType: 'deal_team_spiff',
          metricName: 'Deal Team SPIFF',
          planId,
          planName,
          targetBonusUsd: 0,
          allocatedOteUsd: 0,
          targetUsd: 0,
          actualUsd: 0,
          achievementPct: 0,
          multiplier: 0,
          ytdEligibleUsd: dealTeamSpiffUsd,
          priorPaidUsd: 0,
          thisMonthUsd: dealTeamSpiffUsd,
          bookingUsd: dealTeamSpiffUsd,
          collectionUsd: 0,
          yearEndUsd: 0,
          notes: 'Manual allocation - 100% upon booking',
        });
      }
      
      // Collection Releases
      if (collectionReleasesUsd > 0) {
        details.push({
          componentType: 'collection_release',
          metricName: 'Collection Releases',
          planId,
          planName,
          targetBonusUsd: 0,
          allocatedOteUsd: 0,
          targetUsd: 0,
          actualUsd: 0,
          achievementPct: 0,
          multiplier: 0,
          ytdEligibleUsd: collectionReleasesUsd,
          priorPaidUsd: 0,
          thisMonthUsd: collectionReleasesUsd,
          bookingUsd: collectionReleasesUsd,
          collectionUsd: 0,
          yearEndUsd: 0,
          notes: 'Released upon collection',
        });
      }
      
      // Year-End Releases
      if (yearEndReleasesUsd > 0) {
        details.push({
          componentType: 'year_end_release',
          metricName: 'Year-End Releases',
          planId,
          planName,
          targetBonusUsd: 0,
          allocatedOteUsd: 0,
          targetUsd: 0,
          actualUsd: 0,
          achievementPct: 0,
          multiplier: 0,
          ytdEligibleUsd: yearEndReleasesUsd,
          priorPaidUsd: 0,
          thisMonthUsd: yearEndReleasesUsd,
          bookingUsd: yearEndReleasesUsd,
          collectionUsd: 0,
          yearEndUsd: 0,
          notes: 'December year-end release',
        });
      }
      
      return details;
    })(),
    
    closingArrDetails: vpResult.closingArrDetails,
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
    const { data: attributions } = await supabase
      .from('deal_variable_pay_attribution')
      .select('employee_id, payout_on_booking_usd, local_currency, compensation_exchange_rate, plan_id')
      .eq('deal_id', collection.deal_id);
    
    if (!attributions || attributions.length === 0) continue;
    
    const planId = attributions[0].plan_id;
    let clawbackPeriodDays = 180;
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
    
    if (isClawbackExempt) continue;
    
    const bookingDate = new Date(collection.booking_month);
    const bookingMonthEnd = new Date(bookingDate.getFullYear(), bookingDate.getMonth() + 1, 0);
    const clawbackDeadline = new Date(bookingMonthEnd);
    clawbackDeadline.setDate(clawbackDeadline.getDate() + clawbackPeriodDays);
    
    let effectiveDeadline = clawbackDeadline;
    if (collection.first_milestone_due_date) {
      const milestoneDate = new Date(collection.first_milestone_due_date);
      if (milestoneDate < clawbackDeadline) {
        effectiveDeadline = milestoneDate;
      }
    }
    
    if (today <= effectiveDeadline) continue;
    
    const clawbackAmount = attributions.reduce((sum, attr) => sum + attr.payout_on_booking_usd, 0);
    totalClawbacksUsd += clawbackAmount;
    clawbackCount++;
    
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
        notes: `Clawback for deal (${clawbackPeriodDays}-day period exceeded)`,
      });
      
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
    
    await supabase
      .from('deal_variable_pay_attribution')
      .update({
        is_clawback_triggered: true,
        clawback_date: todayStr,
        clawback_amount_usd: clawbackAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('deal_id', collection.deal_id);
    
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
 */
export async function applyClawbackRecoveries(
  employeeId: string,
  payableAmountUsd: number,
  monthYear: string
): Promise<{ adjustedPayableUsd: number; totalRecoveredUsd: number }> {
  if (payableAmountUsd <= 0) {
    return { adjustedPayableUsd: payableAmountUsd, totalRecoveredUsd: 0 };
  }

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
 * Progress callback for reporting calculation progress
 */
export type ProgressCallback = (current: number, total: number) => void;

/**
 * Run full payout calculation for all employees
 */
export async function runPayoutCalculation(
  payoutRunId: string,
  monthYear: string,
  onProgress?: ProgressCallback
): Promise<PayoutRunResult> {
  // === Calculation Lock: prevent concurrent runs ===
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
    return await executePayoutCalculation(payoutRunId, monthYear, onProgress);
  } catch (error) {
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
  monthYear: string,
  onProgress?: ProgressCallback
): Promise<PayoutRunResult> {
  const calculatedAt = new Date().toISOString();
  const fiscalYear = parseInt(monthYear.substring(0, 4));
  
  // First, check and apply any clawbacks
  const clawbackResult = await checkAndApplyClawbacks(payoutRunId, monthYear);
  
  // === PREFETCH ALL DATA ===
  const prefetched = await prefetchPayoutData(monthYear, fiscalYear);
  
  // Filter active sales-eligible employees from prefetched data
  const employees = prefetched.allEmployees.filter(
    (e: any) => e.is_active === true && e.sales_function != null
  ) as Employee[];
  
  if (employees.length === 0) {
    throw new Error('No active sales-eligible employees found');
  }
  
  const employeePayouts: EmployeePayoutResult[] = [];
  let processedCount = 0;
  
  // Process employees in parallel batches of 5
  const BATCH_SIZE = 5;
  for (let i = 0; i < employees.length; i += BATCH_SIZE) {
    const batch = employees.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.all(
      batch.map(async (emp) => {
        const result = calculateMonthlyPayoutFromPrefetch(emp, monthYear, prefetched);
        
        if (result) {
          // Apply clawback carry-forward recoveries (async - DB mutation)
          const clawbackRecovery = await applyClawbackRecoveries(
            emp.id, result.payableThisMonthUsd, monthYear
          );
          result.payableThisMonthUsd = clawbackRecovery.adjustedPayableUsd;
          result.payableThisMonthLocal = convertVPToLocal(
            clawbackRecovery.adjustedPayableUsd,
            emp.compensation_exchange_rate
          );
          
          // Add clawback metric detail if recovery happened
          if (clawbackRecovery.totalRecoveredUsd > 0) {
            result.metricDetails.push({
              componentType: 'clawback',
              metricName: 'Clawback Recovery',
              planId: result.planId,
              planName: result.planName,
              targetBonusUsd: 0,
              allocatedOteUsd: 0,
              targetUsd: 0,
              actualUsd: 0,
              achievementPct: 0,
              multiplier: 0,
              ytdEligibleUsd: -clawbackRecovery.totalRecoveredUsd,
              priorPaidUsd: 0,
              thisMonthUsd: -clawbackRecovery.totalRecoveredUsd,
              bookingUsd: -clawbackRecovery.totalRecoveredUsd,
              collectionUsd: 0,
              yearEndUsd: 0,
              notes: 'Carry-forward clawback deduction',
            });
          }
          
          // Resolve clawbacks for collected deals (async - DB mutation)
          const collReleases = calculateCollectionReleasesFromPrefetch(
            emp.id, emp.employee_id, monthYear, fiscalYear, prefetched
          );
          await resolveClawbacksForCollectedDeals(
            emp.id, collReleases.clawbackReversedDealIds, monthYear, prefetched
          );
        }
        
        return result;
      })
    );
    
    for (const result of batchResults) {
      if (result) {
        employeePayouts.push(result);
      }
    }
    
    processedCount += batch.length;
    onProgress?.(processedCount, employees.length);
  }
  
  // Calculate totals
  const totalPayoutUsd = employeePayouts.reduce((sum, p) => sum + p.totalPayoutUsd, 0);
  const totalVariablePayUsd = employeePayouts.reduce((sum, p) => sum + p.variablePayUsd, 0);
  const totalCommissionsUsd = employeePayouts.reduce((sum, p) => sum + p.commissionsUsd, 0);
  
  // Persist to database
  await persistPayoutResults(payoutRunId, monthYear, fiscalYear, employeePayouts, prefetched);
  
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
  employeePayouts: EmployeePayoutResult[],
  prefetched?: PrefetchedData
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
  
  // Verify deletion succeeded
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
    
    // Commission records per-deal
    for (const c of emp.commissionCalculations) {
      if (!c.qualifies) continue;
      records.push({
        payout_run_id: payoutRunId,
        employee_id: emp.employeeId,
        month_year: monthYear,
        payout_type: c.commissionType,
        plan_id: emp.planId,
        deal_id: c.dealId,
        calculated_amount_usd: c.grossCommission,
        calculated_amount_local: c.grossCommission * emp.commissionMarketRate,
        local_currency: emp.localCurrency,
        exchange_rate_used: emp.commissionMarketRate,
        exchange_rate_type: 'market',
        booking_amount_usd: c.paidAmount,
        booking_amount_local: c.paidAmount * emp.commissionMarketRate,
        collection_amount_usd: c.holdbackAmount,
        collection_amount_local: c.holdbackAmount * emp.commissionMarketRate,
        year_end_amount_usd: c.yearEndHoldback,
        year_end_amount_local: c.yearEndHoldback * emp.commissionMarketRate,
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

    // Deal Team SPIFF records
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
  
  // Delete existing metric details for this run
  await supabase
    .from('payout_metric_details' as any)
    .delete()
    .eq('payout_run_id', payoutRunId);
  
  // Insert metric detail records
  const metricDetailRecords = employeePayouts.flatMap(emp =>
    emp.metricDetails.map(md => ({
      payout_run_id: payoutRunId,
      employee_id: emp.employeeId,
      component_type: md.componentType,
      metric_name: md.metricName,
      plan_id: md.planId,
      plan_name: md.planName,
      target_bonus_usd: md.targetBonusUsd,
      allocated_ote_usd: md.allocatedOteUsd,
      target_usd: md.targetUsd,
      actual_usd: md.actualUsd,
      achievement_pct: md.achievementPct,
      multiplier: md.multiplier,
      ytd_eligible_usd: md.ytdEligibleUsd,
      prior_paid_usd: md.priorPaidUsd,
      this_month_usd: md.thisMonthUsd,
      booking_usd: md.bookingUsd,
      collection_usd: md.collectionUsd,
      year_end_usd: md.yearEndUsd,
      notes: md.notes,
      commission_rate_pct: md.commissionRatePct ?? null,
    }))
  );
  
  if (metricDetailRecords.length > 0) {
    for (let i = 0; i < metricDetailRecords.length; i += 100) {
      const batch = metricDetailRecords.slice(i, i + 100);
      await supabase.from('payout_metric_details' as any).insert(batch);
    }
  }

  // ===== Persist Deal-Level Details (All Component Types) =====
  await supabase
    .from('payout_deal_details' as any)
    .delete()
    .eq('payout_run_id', payoutRunId);

  // Collect all deal IDs to fetch metadata
  const allDealIds = [...new Set([
    ...employeePayouts.flatMap(emp => emp.commissionCalculations.map(c => c.dealId)),
    ...employeePayouts.flatMap(emp => emp.vpAttributions.map(a => a.dealId)),
    ...employeePayouts.flatMap(emp => emp.nrrDealBreakdowns.map(b => b.dealId)),
    ...employeePayouts.flatMap(emp => emp.spiffDealBreakdowns.map(b => b.dealId)),
  ])];

  // Build deal metadata map from prefetched data
  let dealMetaMap = new Map<string, { project_id: string; customer_name: string | null }>();
  if (prefetched) {
    // Use prefetched deals for metadata
    for (const d of prefetched.allDeals) {
      if (allDealIds.includes(d.id)) {
        dealMetaMap.set(d.id, { project_id: d.project_id, customer_name: d.customer_name });
      }
    }
    // Also check commission deals (current month only deals might not be in allDeals range)
    for (const d of prefetched.allCommissionDeals) {
      if (allDealIds.includes(d.id) && !dealMetaMap.has(d.id)) {
        dealMetaMap.set(d.id, { project_id: d.project_id, customer_name: d.customer_name });
      }
    }
  }
  
  // Fetch any remaining missing metadata (shouldn't happen with prefetch, but safety net)
  const missingMetaIds = allDealIds.filter(id => !dealMetaMap.has(id));
  if (missingMetaIds.length > 0) {
    for (let i = 0; i < missingMetaIds.length; i += 200) {
      const batch = missingMetaIds.slice(i, i + 200);
      const { data: dealMeta } = await supabase
        .from('deals')
        .select('id, project_id, customer_name')
        .in('id', batch);
      (dealMeta || []).forEach(d => dealMetaMap.set(d.id, { project_id: d.project_id, customer_name: d.customer_name }));
    }
  }

  const dealDetailRecords: any[] = [];

  for (const emp of employeePayouts) {
    // Commission deal details
    for (const c of emp.commissionCalculations) {
      const meta = dealMetaMap.get(c.dealId);
      dealDetailRecords.push({
        payout_run_id: payoutRunId,
        employee_id: emp.employeeId,
        deal_id: c.dealId,
        project_id: meta?.project_id || null,
        customer_name: meta?.customer_name || null,
        commission_type: c.commissionType,
        component_type: 'commission',
        deal_value_usd: c.tcvUsd,
        gp_margin_pct: c.gpMarginPct ?? null,
        min_gp_margin_pct: c.minGpMarginPct ?? null,
        commission_rate_pct: c.commissionRatePct,
        is_eligible: c.qualifies,
        exclusion_reason: c.exclusionReason || null,
        gross_commission_usd: c.grossCommission,
        booking_usd: c.paidAmount,
        collection_usd: c.holdbackAmount,
        year_end_usd: c.yearEndHoldback,
      });
    }

    // Variable Pay deal details
    for (const attr of emp.vpAttributions) {
      const meta = dealMetaMap.get(attr.dealId);
      dealDetailRecords.push({
        payout_run_id: payoutRunId,
        employee_id: emp.employeeId,
        deal_id: attr.dealId,
        project_id: meta?.project_id || null,
        customer_name: meta?.customer_name || null,
        commission_type: attr.metricName,
        component_type: 'variable_pay',
        deal_value_usd: attr.dealValueUsd,
        gp_margin_pct: null,
        min_gp_margin_pct: null,
        commission_rate_pct: attr.proportionPct,
        is_eligible: true,
        exclusion_reason: null,
        gross_commission_usd: attr.variablePaySplitUsd,
        booking_usd: attr.payoutOnBookingUsd,
        collection_usd: attr.payoutOnCollectionUsd,
        year_end_usd: attr.payoutOnYearEndUsd,
      });
    }

    // NRR deal details with pro-rata payout attribution
    const nrrActuals = emp.nrrResult?.nrrActuals ?? 0;
    const nrrTotalPayout = emp.nrrPayoutUsd;
    for (const nrr of emp.nrrDealBreakdowns) {
      const meta = dealMetaMap.get(nrr.dealId);
      const proRataPct = (nrr.isEligible && nrrActuals > 0) ? (nrr.eligibleValueUsd / nrrActuals) * 100 : 0;
      const dealNrrPayout = (nrr.isEligible && nrrActuals > 0) ? nrrTotalPayout * (nrr.eligibleValueUsd / nrrActuals) : 0;
      dealDetailRecords.push({
        payout_run_id: payoutRunId,
        employee_id: emp.employeeId,
        deal_id: nrr.dealId,
        project_id: meta?.project_id || null,
        customer_name: meta?.customer_name || null,
        commission_type: 'NRR',
        component_type: 'nrr',
        deal_value_usd: nrr.crErUsd + nrr.implUsd,
        gp_margin_pct: nrr.gpMarginPct,
        min_gp_margin_pct: null,
        commission_rate_pct: Math.round(proRataPct * 100) / 100,
        is_eligible: nrr.isEligible,
        exclusion_reason: nrr.exclusionReason,
        gross_commission_usd: Math.round(dealNrrPayout * 100) / 100,
        booking_usd: Math.round(dealNrrPayout * emp.nrrBookingPct * 100) / 100,
        collection_usd: Math.round(dealNrrPayout * emp.nrrCollectionPct * 100) / 100,
        year_end_usd: Math.round(dealNrrPayout * emp.nrrYearEndPct * 100) / 100,
      });
    }

    // SPIFF deal details with payout splits
    for (const spiff of emp.spiffDealBreakdowns) {
      const grossPayout = spiff.spiffPayoutUsd;
      dealDetailRecords.push({
        payout_run_id: payoutRunId,
        employee_id: emp.employeeId,
        deal_id: spiff.dealId,
        project_id: spiff.projectId || null,
        customer_name: spiff.customerName || null,
        commission_type: spiff.spiffName,
        component_type: 'spiff',
        deal_value_usd: spiff.dealArrUsd,
        gp_margin_pct: null,
        min_gp_margin_pct: null,
        commission_rate_pct: spiff.spiffRatePct,
        is_eligible: spiff.isEligible,
        exclusion_reason: spiff.exclusionReason,
        gross_commission_usd: grossPayout,
        booking_usd: Math.round(grossPayout * emp.spiffBookingPct * 100) / 100,
        collection_usd: Math.round(grossPayout * emp.spiffCollectionPct * 100) / 100,
        year_end_usd: Math.round(grossPayout * emp.spiffYearEndPct * 100) / 100,
      });
    }
  }

  if (dealDetailRecords.length > 0) {
    for (let i = 0; i < dealDetailRecords.length; i += 100) {
      const batch = dealDetailRecords.slice(i, i + 100);
      await supabase.from('payout_deal_details' as any).insert(batch);
    }
  }


  // ===== Persist Closing ARR Project-Level Details =====
  await supabase
    .from('closing_arr_payout_details' as any)
    .delete()
    .eq('payout_run_id', payoutRunId);

  const closingArrRecords: any[] = [];
  for (const emp of employeePayouts) {
    for (const d of emp.closingArrDetails) {
      closingArrRecords.push({
        payout_run_id: payoutRunId,
        employee_id: d.employeeId,
        closing_arr_actual_id: d.closingArrActualId,
        pid: d.pid,
        customer_name: d.customerName,
        customer_code: d.customerCode,
        bu: d.bu,
        product: d.product,
        month_year: d.monthYear,
        end_date: d.endDate,
        is_multi_year: d.isMultiYear,
        renewal_years: d.renewalYears,
        closing_arr_usd: d.closingArrUsd,
        multiplier: d.multiplier,
        adjusted_arr_usd: d.adjustedArrUsd,
        is_eligible: d.isEligible,
        exclusion_reason: d.exclusionReason,
        order_category_2: d.orderCategory2,
      });
    }
  }

  if (closingArrRecords.length > 0) {
    for (let i = 0; i < closingArrRecords.length; i += 100) {
      const batch = closingArrRecords.slice(i, i + 100);
      const { error: capdError } = await supabase.from('closing_arr_payout_details' as any).insert(batch);
      if (capdError) {
        console.error('Error persisting closing_arr_payout_details batch:', capdError);
      }
    }
  }
}

// Legacy export for backward compatibility
export const calculateMonthlyPayout = calculateMonthlyPayoutFromPrefetch;
