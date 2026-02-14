/**
 * Audit Logger Utility
 * 
 * Programmatic audit logging for payout calculations with rate tracking.
 * Used to complement database triggers with calculation-specific events.
 */

import { supabase } from "@/integrations/supabase/client";

export type AuditCategory = 'run_lifecycle' | 'calculation' | 'rate_usage' | 'adjustment' | 'fnf_settlement';

export type AuditAction = 
  | 'run_calculated'
  | 'payout_calculated'
  | 'rate_used_compensation'
  | 'rate_used_market'
  | 'rate_mismatch'
  | 'clawback_applied'
  | 'fnf_tranche_calculated'
  | 'fnf_status_changed';

interface BaseAuditEntry {
  payoutRunId?: string;
  employeeId?: string;
  monthYear?: string;
  reason?: string;
}

interface RateUsageEntry extends BaseAuditEntry {
  rateType: 'compensation' | 'market';
  rate: number;
  currency: string;
}

interface RateMismatchEntry extends BaseAuditEntry {
  compensationRate: number;
  marketRate: number;
  variancePct: number;
  currency: string;
}

interface PayoutCalculationEntry extends BaseAuditEntry {
  amountUsd: number;
  amountLocal: number;
  localCurrency: string;
  compensationRate: number;
  marketRate: number;
  metadata?: Record<string, unknown>;
}

interface ClawbackEntry extends BaseAuditEntry {
  dealId: string;
  amountUsd: number;
  amountLocal: number;
  localCurrency: string;
}

interface FnFAuditEntry {
  settlementId: string;
  employeeId?: string;
  tranche?: number;
  action: 'fnf_tranche_calculated' | 'fnf_status_changed';
  oldStatus?: string;
  newStatus?: string;
  totalUsd?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Log F&F settlement events (tranche calculation, status changes)
 */
export async function logFnfEvent(entry: FnFAuditEntry): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('payout_audit_log').insert([{
      action: entry.action,
      entity_type: 'fnf_settlement',
      audit_category: 'fnf_settlement',
      employee_id: entry.employeeId || null,
      amount_usd: entry.totalUsd || null,
      reason: entry.action === 'fnf_status_changed'
        ? `Tranche ${entry.tranche} status: ${entry.oldStatus} → ${entry.newStatus}`
        : `Tranche ${entry.tranche} calculated, total $${(entry.totalUsd || 0).toFixed(2)}`,
      changed_by: userData?.user?.id || null,
      metadata: {
        settlement_id: entry.settlementId,
        tranche: entry.tranche,
        ...(entry.oldStatus ? { old_status: entry.oldStatus, new_status: entry.newStatus } : {}),
        ...(entry.metadata || {}),
      },
    }]);
  } catch (error) {
    console.error('Failed to log F&F event:', error);
  }
}

/**
 * Log rate usage during calculation
 */
export async function logRateUsage(entry: RateUsageEntry): Promise<void> {
  try {
    await supabase.from('payout_audit_log').insert([{
      payout_run_id: entry.payoutRunId,
      employee_id: entry.employeeId,
      action: entry.rateType === 'compensation' ? 'rate_used_compensation' : 'rate_used_market',
      entity_type: 'rate',
      audit_category: 'rate_usage',
      rate_type: entry.rateType,
      compensation_rate: entry.rateType === 'compensation' ? entry.rate : null,
      market_rate: entry.rateType === 'market' ? entry.rate : null,
      local_currency: entry.currency,
      month_year: entry.monthYear,
      metadata: { currency: entry.currency, rate: entry.rate },
    }]);
  } catch (error) {
    console.error('Failed to log rate usage:', error);
  }
}

/**
 * Log rate mismatch detection (variance > 10%)
 */
export async function logRateMismatch(entry: RateMismatchEntry): Promise<void> {
  try {
    await supabase.from('payout_audit_log').insert([{
      payout_run_id: entry.payoutRunId,
      employee_id: entry.employeeId,
      action: 'rate_mismatch',
      entity_type: 'rate',
      audit_category: 'rate_usage',
      compensation_rate: entry.compensationRate,
      market_rate: entry.marketRate,
      rate_variance_pct: entry.variancePct,
      is_rate_mismatch: true,
      local_currency: entry.currency,
      month_year: entry.monthYear,
      reason: `Rate variance of ${entry.variancePct.toFixed(2)}% detected between compensation (${entry.compensationRate}) and market (${entry.marketRate}) rates`,
    }]);
  } catch (error) {
    console.error('Failed to log rate mismatch:', error);
  }
}

/**
 * Log individual employee payout calculation
 */
export async function logPayoutCalculation(entry: PayoutCalculationEntry): Promise<void> {
  try {
    await supabase.from('payout_audit_log').insert([{
      payout_run_id: entry.payoutRunId,
      employee_id: entry.employeeId,
      action: 'payout_calculated',
      entity_type: 'payout',
      audit_category: 'calculation',
      amount_usd: entry.amountUsd,
      amount_local: entry.amountLocal,
      local_currency: entry.localCurrency,
      compensation_rate: entry.compensationRate,
      market_rate: entry.marketRate,
      month_year: entry.monthYear,
      metadata: entry.metadata as unknown as Record<string, never>,
    }]);
  } catch (error) {
    console.error('Failed to log payout calculation:', error);
  }
}

/**
 * Log clawback execution
 */
export async function logClawbackExecution(entry: ClawbackEntry): Promise<void> {
  try {
    await supabase.from('payout_audit_log').insert({
      payout_run_id: entry.payoutRunId,
      employee_id: entry.employeeId,
      action: 'clawback_applied',
      entity_type: 'clawback',
      audit_category: 'calculation',
      amount_usd: entry.amountUsd,
      amount_local: entry.amountLocal,
      local_currency: entry.localCurrency,
      month_year: entry.monthYear,
      reason: entry.reason,
      new_values: { deal_id: entry.dealId },
    });
  } catch (error) {
    console.error('Failed to log clawback execution:', error);
  }
}

/**
 * Log run calculation completion
 */
export async function logRunCalculated(
  runId: string,
  monthYear: string,
  totals: {
    totalEmployees: number;
    totalPayoutUsd: number;
    totalVariablePayUsd: number;
    totalCommissionsUsd: number;
  }
): Promise<void> {
  try {
    await supabase.from('payout_audit_log').insert([{
      payout_run_id: runId,
      action: 'run_calculated',
      entity_type: 'payout_run',
      audit_category: 'run_lifecycle',
      amount_usd: totals.totalPayoutUsd,
      month_year: monthYear,
      metadata: totals,
    }]);
  } catch (error) {
    console.error('Failed to log run calculation:', error);
  }
}

/**
 * Calculate rate variance percentage
 */
export function calculateRateVariance(compensationRate: number, marketRate: number): number {
  if (marketRate === 0) return 0;
  return Math.abs((compensationRate - marketRate) / marketRate) * 100;
}

/**
 * Check if rate variance exceeds threshold (10%)
 */
export function isRateMismatch(compensationRate: number, marketRate: number): boolean {
  return calculateRateVariance(compensationRate, marketRate) > 10;
}
