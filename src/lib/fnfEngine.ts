/**
 * F&F (Full & Final) Settlement Engine
 * 
 * Handles two-tranche settlement for departed employees:
 * - Tranche 1: Year-end releases, pro-rated VP/NRR/SPIFF settlement, clawback deductions
 * - Tranche 2: Collection releases/forfeits after grace period, clawback carry-forward
 * 
 * NOTE: Year-end release query captures ALL payout types (Variable Pay, NRR Additional Pay,
 * SPIFF, commissions) since it filters on year_end_amount_usd > 0 without filtering by
 * payout_type. Commission year-end reserves are therefore already included.
 */

import { supabase } from "@/integrations/supabase/client";

export interface FnFSettlementLine {
  settlement_id: string;
  tranche: number;
  line_type: string;
  payout_type: string | null;
  amount_usd: number;
  amount_local: number;
  local_currency: string;
  exchange_rate_used: number;
  deal_id: string | null;
  source_payout_id: string | null;
  notes: string;
}

export interface Tranche1Result {
  lines: FnFSettlementLine[];
  totalUsd: number;
  clawbackCarryforwardUsd: number;
}

export interface Tranche2Result {
  lines: FnFSettlementLine[];
  totalUsd: number;
}

// ============= HELPERS =============

function ensureFullDate(monthYear: string): string {
  return monthYear.length === 7 ? monthYear + '-01' : monthYear;
}

/**
 * Calculate days-based pro-ration factor for a calendar year.
 * Factor = days from Jan 1 to departureDate / 365
 */
function calculateProRationFactor(fiscalYear: number, departureDate: string): number {
  const yearStart = new Date(`${fiscalYear}-01-01`);
  const departure = new Date(departureDate);
  const daysDiff = Math.floor((departure.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.min(Math.max(daysDiff / 365, 0), 1);
}

/**
 * Sum prior finalized payouts for a given payout_type in the fiscal year.
 */
async function sumPriorPayouts(
  employeeId: string,
  fiscalYear: number,
  payoutType: string
): Promise<number> {
  const { data } = await supabase
    .from('monthly_payouts')
    .select('calculated_amount_usd')
    .eq('employee_id', employeeId)
    .eq('payout_type', payoutType)
    .gte('month_year', `${fiscalYear}-01-01`)
    .lte('month_year', `${fiscalYear}-12-31`)
    .not('payout_run_id', 'is', null);

  return (data || []).reduce((sum, p) => sum + (p.calculated_amount_usd || 0), 0);
}

// ============= VP SETTLEMENT =============

/**
 * Calculate pro-rated Variable Pay settlement for Tranche 1.
 * Uses the same logic as payoutEngine: YTD achievement × multiplier × bonus allocation,
 * pro-rated by days worked, minus prior finalized VP payouts.
 */
async function calculateVpSettlement(
  settlementId: string,
  employeeId: string,
  fiscalYear: number,
  departureDate: string
): Promise<FnFSettlementLine | null> {
  // 1. Fetch employee data
  const { data: employee } = await supabase
    .from('employees')
    .select('id, employee_id, tvp_usd, local_currency, compensation_exchange_rate')
    .eq('id', employeeId)
    .single();

  if (!employee || !employee.tvp_usd) return null;

  // 2. Fetch plan assignment
  const { data: assignment } = await supabase
    .from('user_targets')
    .select('plan_id, target_bonus_usd')
    .eq('user_id', employeeId)
    .lte('effective_start_date', `${fiscalYear}-12-31`)
    .gte('effective_end_date', `${fiscalYear}-01-01`)
    .maybeSingle();

  if (!assignment?.plan_id) return null;

  // 3. Fetch plan metrics
  const { data: metrics } = await supabase
    .from('plan_metrics')
    .select('*')
    .eq('plan_id', assignment.plan_id);

  if (!metrics || metrics.length === 0) return null;

  const targetBonusUsd = assignment.target_bonus_usd || employee.tvp_usd || 0;

  // 4. Calculate YTD Variable Pay across all metrics
  let ytdVpUsd = 0;
  const empId = employee.employee_id;

  for (const metric of metrics) {
    const { data: perfTarget } = await supabase
      .from('performance_targets')
      .select('target_value_usd')
      .eq('employee_id', empId)
      .eq('effective_year', fiscalYear)
      .eq('metric_type', metric.metric_name)
      .maybeSingle();

    const targetUsd = perfTarget?.target_value_usd ?? 0;
    if (targetUsd === 0) continue;

    const bonusAllocationUsd = (targetBonusUsd * (metric.weightage_percent || 0)) / 100;

    // Fetch actuals
    const isClosingArr = metric.metric_name.toLowerCase().includes('closing arr');
    let totalActualUsd = 0;

    if (isClosingArr) {
      const { data: closingArr } = await supabase
        .from('closing_arr_actuals')
        .select('month_year, closing_arr')
        .or(`sales_rep_employee_id.eq.${empId},sales_head_employee_id.eq.${empId}`)
        .gte('month_year', `${fiscalYear}-01-01`)
        .lte('month_year', departureDate)
        .gt('end_date', `${fiscalYear}-12-31`);

      const byMonth = new Map<string, number>();
      (closingArr || []).forEach((a: any) => {
        const mk = a.month_year?.substring(0, 7) || '';
        byMonth.set(mk, (byMonth.get(mk) || 0) + (a.closing_arr || 0));
      });
      const sorted = Array.from(byMonth.keys()).sort();
      totalActualUsd = sorted.length > 0 ? byMonth.get(sorted[sorted.length - 1]) || 0 : 0;
    } else {
      const { data: deals } = await supabase
        .from('deals')
        .select('new_software_booking_arr_usd')
        .or(`sales_rep_employee_id.eq.${empId},sales_head_employee_id.eq.${empId},sales_engineering_employee_id.eq.${empId},product_specialist_employee_id.eq.${empId},solution_manager_employee_id.eq.${empId}`)
        .gte('month_year', `${fiscalYear}-01-01`)
        .lte('month_year', departureDate);

      totalActualUsd = (deals || []).reduce((s, d) => s + (d.new_software_booking_arr_usd || 0), 0);
    }

    if (totalActualUsd === 0) continue;

    // Calculate achievement and multiplier
    const achievementPct = (totalActualUsd / targetUsd) * 100;

    // Fetch multiplier grid
    const { data: grids } = await supabase
      .from('multiplier_grids')
      .select('min_pct, max_pct, multiplier_value')
      .eq('plan_metric_id', metric.id)
      .order('min_pct');

    let multiplier = 1.0;
    if (grids && grids.length > 0) {
      // Marginal stepped calculation
      multiplier = 0;
      let remainingPct = achievementPct;
      let prevBoundary = 0;

      for (const tier of grids) {
        if (remainingPct <= 0) break;
        const tierWidth = tier.max_pct - prevBoundary;
        const applicablePct = Math.min(remainingPct, tierWidth);
        multiplier += (applicablePct / achievementPct) * tier.multiplier_value;
        remainingPct -= tierWidth;
        prevBoundary = tier.max_pct;
      }
      if (multiplier === 0) multiplier = 1.0;
    }

    // Check gate logic
    const logicType = (metric as any).logic_type || 'Linear';
    if (logicType === 'Gated_Threshold') {
      const gatePct = grids?.[0]?.min_pct ?? 0;
      if (achievementPct < gatePct) continue; // gated out
    }

    ytdVpUsd += bonusAllocationUsd * (achievementPct / 100) * multiplier;
  }

  // 5. Pro-rate by days worked
  const proRationFactor = calculateProRationFactor(fiscalYear, departureDate);
  const proRatedVpUsd = ytdVpUsd * proRationFactor;

  // 6. Subtract prior finalized VP payouts
  const priorVpPaid = await sumPriorPayouts(employeeId, fiscalYear, 'Variable Pay');
  const vpSettlement = Math.max(0, proRatedVpUsd - priorVpPaid);

  if (vpSettlement <= 0) return null;

  const rate = employee.compensation_exchange_rate || 1;

  return {
    settlement_id: settlementId,
    tranche: 1,
    line_type: 'vp_settlement',
    payout_type: 'Variable Pay',
    amount_usd: Math.round(vpSettlement * 100) / 100,
    amount_local: Math.round(vpSettlement * rate * 100) / 100,
    local_currency: employee.local_currency || 'USD',
    exchange_rate_used: rate,
    deal_id: null,
    source_payout_id: null,
    notes: `Pro-rated VP settlement (${(proRationFactor * 100).toFixed(1)}% of year, YTD VP $${ytdVpUsd.toFixed(2)}, prior paid $${priorVpPaid.toFixed(2)})`,
  };
}

// ============= NRR SETTLEMENT =============

/**
 * Calculate pro-rated NRR Additional Pay settlement for Tranche 1.
 */
async function calculateNrrSettlement(
  settlementId: string,
  employeeId: string,
  fiscalYear: number,
  departureDate: string
): Promise<FnFSettlementLine | null> {
  // Fetch NRR payouts already finalized
  const priorNrrPaid = await sumPriorPayouts(employeeId, fiscalYear, 'NRR Additional Pay');

  // Get employee data
  const { data: employee } = await supabase
    .from('employees')
    .select('id, employee_id, tvp_usd, local_currency, compensation_exchange_rate')
    .eq('id', employeeId)
    .single();

  if (!employee) return null;

  // Get plan with NRR config
  const { data: assignment } = await supabase
    .from('user_targets')
    .select('plan_id')
    .eq('user_id', employeeId)
    .lte('effective_start_date', `${fiscalYear}-12-31`)
    .gte('effective_end_date', `${fiscalYear}-01-01`)
    .maybeSingle();

  if (!assignment?.plan_id) return null;

  const { data: plan } = await supabase
    .from('comp_plans')
    .select('nrr_ote_percent')
    .eq('id', assignment.plan_id)
    .single();

  if (!plan || !plan.nrr_ote_percent || plan.nrr_ote_percent <= 0) return null;

  // NRR payout = TVP × NRR OTE % × (NRR Actuals / NRR Target)
  // NRR actuals come from CR/ER + Implementation deals
  const empId = employee.employee_id;

  const { data: deals } = await supabase
    .from('deals')
    .select('cr_usd, er_usd, implementation_usd')
    .or(`sales_rep_employee_id.eq.${empId},sales_head_employee_id.eq.${empId}`)
    .gte('month_year', `${fiscalYear}-01-01`)
    .lte('month_year', departureDate);

  const nrrActuals = (deals || []).reduce(
    (sum, d) => sum + (d.cr_usd || 0) + (d.er_usd || 0) + (d.implementation_usd || 0),
    0
  );

  if (nrrActuals <= 0) return null;

  // Fetch NRR target (sum of CR/ER + Implementation targets)
  const { data: targets } = await supabase
    .from('performance_targets')
    .select('target_value_usd, metric_type')
    .eq('employee_id', empId)
    .eq('effective_year', fiscalYear)
    .in('metric_type', ['CR/ER', 'Implementation']);

  const nrrTarget = (targets || []).reduce((s, t) => s + (t.target_value_usd || 0), 0);
  if (nrrTarget <= 0) return null;

  const tvpUsd = employee.tvp_usd || 0;
  const nrrPayout = tvpUsd * (plan.nrr_ote_percent / 100) * (nrrActuals / nrrTarget);

  const proRationFactor = calculateProRationFactor(fiscalYear, departureDate);
  const proRatedNrr = nrrPayout * proRationFactor;
  const nrrSettlement = Math.max(0, proRatedNrr - priorNrrPaid);

  if (nrrSettlement <= 0) return null;

  const rate = employee.compensation_exchange_rate || 1;

  return {
    settlement_id: settlementId,
    tranche: 1,
    line_type: 'nrr_settlement',
    payout_type: 'NRR Additional Pay',
    amount_usd: Math.round(nrrSettlement * 100) / 100,
    amount_local: Math.round(nrrSettlement * rate * 100) / 100,
    local_currency: employee.local_currency || 'USD',
    exchange_rate_used: rate,
    deal_id: null,
    source_payout_id: null,
    notes: `Pro-rated NRR settlement (${(proRationFactor * 100).toFixed(1)}% of year, prior paid $${priorNrrPaid.toFixed(2)})`,
  };
}

// ============= SPIFF SETTLEMENT =============

/**
 * Calculate pro-rated SPIFF settlement for Tranche 1.
 */
async function calculateSpiffSettlement(
  settlementId: string,
  employeeId: string,
  fiscalYear: number,
  departureDate: string
): Promise<FnFSettlementLine | null> {
  const priorSpiffPaid = await sumPriorPayouts(employeeId, fiscalYear, 'SPIFF');

  const { data: employee } = await supabase
    .from('employees')
    .select('id, employee_id, tvp_usd, local_currency, compensation_exchange_rate')
    .eq('id', employeeId)
    .single();

  if (!employee) return null;

  // Check if plan has SPIFFs
  const { data: assignment } = await supabase
    .from('user_targets')
    .select('plan_id')
    .eq('user_id', employeeId)
    .lte('effective_start_date', `${fiscalYear}-12-31`)
    .gte('effective_end_date', `${fiscalYear}-01-01`)
    .maybeSingle();

  if (!assignment?.plan_id) return null;

  const { data: spiffs } = await supabase
    .from('plan_spiffs' as any)
    .select('*')
    .eq('plan_id', assignment.plan_id)
    .eq('is_active', true);

  if (!spiffs || spiffs.length === 0) return null;

  // For each SPIFF, calculate YTD amount based on qualifying deals
  const empId = employee.employee_id;
  let totalSpiffUsd = 0;

  for (const spiff of spiffs as any[]) {
    const minThreshold = spiff.min_deal_value_usd || 0;

    const { data: deals } = await supabase
      .from('deals')
      .select('new_software_booking_arr_usd')
      .or(`sales_rep_employee_id.eq.${empId},sales_head_employee_id.eq.${empId}`)
      .gte('month_year', `${fiscalYear}-01-01`)
      .lte('month_year', departureDate)
      .gte('new_software_booking_arr_usd', minThreshold);

    const qualifyingDealsCount = (deals || []).length;
    if (qualifyingDealsCount > 0) {
      // SPIFF payout derived from Software Variable OTE
      // linked metric weightage × TVP × spiff multiplier/amount
      const spiffAmount = spiff.spiff_amount_usd || 0;
      totalSpiffUsd += qualifyingDealsCount * spiffAmount;
    }
  }

  if (totalSpiffUsd <= 0) return null;

  const proRationFactor = calculateProRationFactor(fiscalYear, departureDate);
  const proRatedSpiff = totalSpiffUsd * proRationFactor;
  const spiffSettlement = Math.max(0, proRatedSpiff - priorSpiffPaid);

  if (spiffSettlement <= 0) return null;

  const rate = employee.compensation_exchange_rate || 1;

  return {
    settlement_id: settlementId,
    tranche: 1,
    line_type: 'spiff_settlement',
    payout_type: 'SPIFF',
    amount_usd: Math.round(spiffSettlement * 100) / 100,
    amount_local: Math.round(spiffSettlement * rate * 100) / 100,
    local_currency: employee.local_currency || 'USD',
    exchange_rate_used: rate,
    deal_id: null,
    source_payout_id: null,
    notes: `Pro-rated SPIFF settlement (${(proRationFactor * 100).toFixed(1)}% of year, prior paid $${priorSpiffPaid.toFixed(2)})`,
  };
}

// ============= TRANCHE CALCULATIONS =============

/**
 * Calculate Tranche 1 for a departed employee.
 * 
 * 1. Sum all year_end_amount_usd from monthly_payouts → "Year-End Release" lines
 *    (covers ALL payout types: Variable Pay, NRR Additional Pay, SPIFF, and commissions)
 * 2. Calculate pro-rated VP settlement (earned but unsettled VP)
 * 3. Calculate pro-rated NRR settlement
 * 4. Calculate pro-rated SPIFF settlement
 * 5. Sum outstanding clawback_ledger entries → "Clawback Deduction" line
 * 6. If clawback exceeds payout, store shortfall as carry-forward
 */
export async function calculateTranche1(
  settlementId: string,
  employeeId: string,
  fiscalYear: number,
  departureDate: string
): Promise<Tranche1Result> {
  const lines: FnFSettlementLine[] = [];
  let totalPositive = 0;

  // Calendar year range (Jan-Dec)
  const fyStart = `${fiscalYear}-01-01`;
  const fyEnd = `${fiscalYear}-12-31`;

  // 1. Year-end reserves release (captures ALL payout types including commissions, NRR, SPIFFs)
  const { data: yearEndPayouts } = await supabase
    .from('monthly_payouts')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('month_year', fyStart)
    .lte('month_year', fyEnd)
    .gt('year_end_amount_usd', 0);

  if (yearEndPayouts && yearEndPayouts.length > 0) {
    for (const p of yearEndPayouts) {
      const amt = Number(p.year_end_amount_usd) || 0;
      if (amt > 0) {
        lines.push({
          settlement_id: settlementId,
          tranche: 1,
          line_type: 'year_end_release',
          payout_type: p.payout_type,
          amount_usd: amt,
          amount_local: Number(p.year_end_amount_local) || 0,
          local_currency: p.local_currency || 'USD',
          exchange_rate_used: Number(p.exchange_rate_used) || 1,
          deal_id: p.deal_id,
          source_payout_id: p.id,
          notes: `Year-end release for ${p.month_year} (${p.payout_type})`,
        });
        totalPositive += amt;
      }
    }
  }

  // 2. Pro-rated VP settlement
  const vpLine = await calculateVpSettlement(settlementId, employeeId, fiscalYear, departureDate);
  if (vpLine) {
    lines.push(vpLine);
    totalPositive += vpLine.amount_usd;
  }

  // 3. Pro-rated NRR settlement
  const nrrLine = await calculateNrrSettlement(settlementId, employeeId, fiscalYear, departureDate);
  if (nrrLine) {
    lines.push(nrrLine);
    totalPositive += nrrLine.amount_usd;
  }

  // 4. Pro-rated SPIFF settlement
  const spiffLine = await calculateSpiffSettlement(settlementId, employeeId, fiscalYear, departureDate);
  if (spiffLine) {
    lines.push(spiffLine);
    totalPositive += spiffLine.amount_usd;
  }

  // 5. Outstanding clawback ledger entries
  const { data: clawbacks } = await supabase
    .from('clawback_ledger')
    .select('*')
    .eq('employee_id', employeeId)
    .in('status', ['pending', 'partial']);

  let totalClawback = 0;
  if (clawbacks && clawbacks.length > 0) {
    for (const cb of clawbacks) {
      const remaining = Number(cb.remaining_amount_usd) ?? (Number(cb.original_amount_usd) - Number(cb.recovered_amount_usd));
      if (remaining > 0) {
        totalClawback += remaining;
        lines.push({
          settlement_id: settlementId,
          tranche: 1,
          line_type: 'clawback_deduction',
          payout_type: null,
          amount_usd: -remaining,
          amount_local: 0,
          local_currency: 'USD',
          exchange_rate_used: 1,
          deal_id: cb.deal_id,
          source_payout_id: null,
          notes: `Clawback deduction for deal ${cb.deal_id}`,
        });
      }
    }
  }

  // 6. Calculate carry-forward
  const netPayout = totalPositive - totalClawback;
  let clawbackCarryforward = 0;

  if (netPayout < 0) {
    clawbackCarryforward = Math.abs(netPayout);
    lines.push({
      settlement_id: settlementId,
      tranche: 1,
      line_type: 'clawback_carryforward',
      payout_type: null,
      amount_usd: 0,
      amount_local: 0,
      local_currency: 'USD',
      exchange_rate_used: 1,
      deal_id: null,
      source_payout_id: null,
      notes: `Clawback carry-forward of $${clawbackCarryforward.toFixed(2)} to Tranche 2`,
    });
  }

  const totalUsd = Math.max(netPayout, 0);

  return { lines, totalUsd, clawbackCarryforwardUsd: clawbackCarryforward };
}

/**
 * Calculate Tranche 2 for a departed employee.
 * 
 * 1. Check collection holdbacks from monthly_payouts
 * 2. For each deal: if collected within grace period → release; else → forfeit
 * 3. Deduct clawback carry-forward from Tranche 1
 */
export async function calculateTranche2(
  settlementId: string,
  employeeId: string,
  fiscalYear: number,
  departureDate: string,
  graceDays: number,
  clawbackCarryforwardUsd: number
): Promise<Tranche2Result> {
  const lines: FnFSettlementLine[] = [];
  let totalReleased = 0;

  // Calendar year range (Jan-Dec)
  const fyStart = `${fiscalYear}-01-01`;
  const fyEnd = `${fiscalYear}-12-31`;

  // Compute grace deadline
  const departure = new Date(departureDate);
  const graceDeadline = new Date(departure);
  graceDeadline.setDate(graceDeadline.getDate() + graceDays);
  const graceDeadlineStr = graceDeadline.toISOString().split('T')[0];

  // 1. Fetch collection holdbacks
  const { data: collectionPayouts } = await supabase
    .from('monthly_payouts')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('month_year', fyStart)
    .lte('month_year', fyEnd)
    .gt('collection_amount_usd', 0);

  if (collectionPayouts && collectionPayouts.length > 0) {
    const dealIds = [...new Set(collectionPayouts.filter(p => p.deal_id).map(p => p.deal_id!))];

    const { data: collections } = await supabase
      .from('deal_collections')
      .select('*')
      .in('deal_id', dealIds);

    const collectionMap = new Map((collections || []).map(c => [c.deal_id, c]));

    for (const p of collectionPayouts) {
      if (!p.deal_id) continue;

      const collection = collectionMap.get(p.deal_id);
      const collectionAmt = Number(p.collection_amount_usd) || 0;
      const collectionAmtLocal = Number(p.collection_amount_local) || 0;

      if (
        collection &&
        collection.is_collected === true &&
        collection.collection_date &&
        collection.collection_date <= graceDeadlineStr
      ) {
        lines.push({
          settlement_id: settlementId,
          tranche: 2,
          line_type: 'collection_release',
          payout_type: p.payout_type,
          amount_usd: collectionAmt,
          amount_local: collectionAmtLocal,
          local_currency: p.local_currency || 'USD',
          exchange_rate_used: Number(p.exchange_rate_used) || 1,
          deal_id: p.deal_id,
          source_payout_id: p.id,
          notes: `Collection released - collected on ${collection.collection_date}`,
        });
        totalReleased += collectionAmt;
      } else {
        lines.push({
          settlement_id: settlementId,
          tranche: 2,
          line_type: 'collection_forfeit',
          payout_type: p.payout_type,
          amount_usd: 0,
          amount_local: 0,
          local_currency: p.local_currency || 'USD',
          exchange_rate_used: Number(p.exchange_rate_used) || 1,
          deal_id: p.deal_id,
          source_payout_id: p.id,
          notes: `Collection forfeited - not collected within ${graceDays} days of departure`,
        });
      }
    }
  }

  // 2. Deduct clawback carry-forward
  if (clawbackCarryforwardUsd > 0 && totalReleased > 0) {
    const deduction = Math.min(clawbackCarryforwardUsd, totalReleased);
    lines.push({
      settlement_id: settlementId,
      tranche: 2,
      line_type: 'clawback_deduction',
      payout_type: null,
      amount_usd: -deduction,
      amount_local: 0,
      local_currency: 'USD',
      exchange_rate_used: 1,
      deal_id: null,
      source_payout_id: null,
      notes: `Clawback carry-forward deduction from Tranche 1 ($${clawbackCarryforwardUsd.toFixed(2)} outstanding, $${deduction.toFixed(2)} recovered)`,
    });
    totalReleased -= deduction;

    const writtenOff = clawbackCarryforwardUsd - deduction;
    if (writtenOff > 0) {
      lines.push({
        settlement_id: settlementId,
        tranche: 2,
        line_type: 'clawback_writeoff',
        payout_type: null,
        amount_usd: 0,
        amount_local: 0,
        local_currency: 'USD',
        exchange_rate_used: 1,
        deal_id: null,
        source_payout_id: null,
        notes: `Unrecovered clawback written off: $${writtenOff.toFixed(2)}`,
      });
    }
  }

  return { lines, totalUsd: Math.max(totalReleased, 0) };
}

/**
 * Persist tranche lines to the database.
 */
export async function saveTrancheLines(lines: FnFSettlementLine[]): Promise<void> {
  if (lines.length === 0) return;

  const { error } = await supabase
    .from('fnf_settlement_lines' as any)
    .insert(lines);

  if (error) throw new Error(`Failed to save settlement lines: ${error.message}`);
}

/**
 * Delete existing lines for a tranche before recalculation.
 */
export async function clearTrancheLines(settlementId: string, tranche: number): Promise<void> {
  const { error } = await supabase
    .from('fnf_settlement_lines' as any)
    .delete()
    .eq('settlement_id', settlementId)
    .eq('tranche', tranche);

  if (error) throw new Error(`Failed to clear settlement lines: ${error.message}`);
}
