/**
 * F&F (Full & Final) Settlement Engine
 * 
 * Handles two-tranche settlement for departed employees:
 * - Tranche 1: Year-end releases, VP settlement, clawback deductions
 * - Tranche 2: Collection releases/forfeits after grace period, clawback carry-forward
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

/**
 * Calculate Tranche 1 for a departed employee.
 * 
 * 1. Sum all year_end_amount_usd from monthly_payouts for the fiscal year → "Year-End Release" lines
 * 2. Sum outstanding clawback_ledger entries → "Clawback Deduction" line
 * 3. If clawback exceeds payout, store shortfall as carry-forward
 */
export async function calculateTranche1(
  settlementId: string,
  employeeId: string,
  fiscalYear: number,
  departureDate: string
): Promise<Tranche1Result> {
  const lines: FnFSettlementLine[] = [];
  let totalPositive = 0;

  // 1. Fetch all year-end reserves from monthly_payouts for this employee & fiscal year
  const fyStart = `${fiscalYear}-04-01`;
  const fyEnd = `${fiscalYear + 1}-03-31`;

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
          notes: `Year-end release for ${p.month_year}`,
        });
        totalPositive += amt;
      }
    }
  }

  // 2. Fetch outstanding clawback ledger entries
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

  // 3. Calculate carry-forward
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

  const fyStart = `${fiscalYear}-04-01`;
  const fyEnd = `${fiscalYear + 1}-03-31`;

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
    // Get unique deal IDs
    const dealIds = [...new Set(collectionPayouts.filter(p => p.deal_id).map(p => p.deal_id!))];

    // Fetch collection statuses
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
        // Collected within grace period → release
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
        // Not collected → forfeit
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
