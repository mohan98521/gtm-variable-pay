/**
 * Deal-Level Variable Pay Attribution: Pro-Rata Allocation
 * 
 * Distributes total variable pay to individual deals proportionally 
 * based on each deal's ARR contribution.
 * 
 * Formula: Deal VP = Total VP × (Deal ARR / Total ARR)
 */

import { PlanMetric } from "@/hooks/usePlanMetrics";
import { getMultiplierFromGrid, calculateAchievementPercent } from "./compensationEngine";

// ============= INTERFACES =============

export interface DealForAttribution {
  id: string;
  new_software_booking_arr_usd: number | null;
  month_year: string;
  project_id: string;
  customer_name: string | null;
}

export interface DealVariablePayAttribution {
  dealId: string;
  projectId: string;
  customerName: string | null;
  employeeId: string;
  metricName: string;
  dealValueUsd: number;
  
  // Pro-rata allocation
  proportionPct: number;           // e.g., 27.78
  variablePaySplitUsd: number;     // e.g., $23,333
  
  // Payout split
  payoutOnBookingUsd: number;
  payoutOnCollectionUsd: number;
  payoutOnYearEndUsd: number;
  
  // Clawback
  clawbackEligibleUsd: number;     // Amount paid on booking that can be clawed back
}

export interface AggregateVariablePayContext {
  totalActualUsd: number;
  targetUsd: number;
  achievementPct: number;
  multiplier: number;
  bonusAllocationUsd: number;
  totalVariablePayUsd: number;
  metricName: string;
  fiscalYear: number;
  calculationMonth: string;        // YYYY-MM-DD format
}

export interface DealAttributionResult {
  attributions: DealVariablePayAttribution[];
  context: AggregateVariablePayContext;
}

// ============= CALCULATION FUNCTIONS =============

/**
 * Calculate aggregate variable pay for a metric
 */
export function calculateAggregateVariablePay(
  totalActualUsd: number,
  targetUsd: number,
  bonusAllocationUsd: number,
  metric: PlanMetric
): { achievementPct: number; multiplier: number; totalVariablePay: number } {
  if (targetUsd === 0) {
    return { achievementPct: 0, multiplier: 0, totalVariablePay: 0 };
  }
  
  const achievementPct = calculateAchievementPercent(totalActualUsd, targetUsd);
  const multiplier = getMultiplierFromGrid(achievementPct, metric);
  
  // Check gate threshold
  const isGated = metric.logic_type === "Gated_Threshold";
  const belowGate = isGated && 
    metric.gate_threshold_percent && 
    achievementPct <= metric.gate_threshold_percent;
  
  const totalVariablePay = belowGate 
    ? 0 
    : (achievementPct / 100) * bonusAllocationUsd * multiplier;
  
  return { achievementPct, multiplier, totalVariablePay };
}

/**
 * Calculate pro-rata variable pay attribution for each deal
 * 
 * @param deals - Array of deals with ARR values
 * @param employeeId - Employee receiving the attribution
 * @param metric - Plan metric configuration (with multiplier grids)
 * @param targetUsd - Employee's annual target for this metric
 * @param bonusAllocationUsd - Bonus allocation for this metric (TVP × weightage)
 * @param fiscalYear - The fiscal year
 * @param calculationMonth - The month being calculated (YYYY-MM-DD)
 */
export function calculateDealVariablePayAttributions(
  deals: DealForAttribution[],
  employeeId: string,
  metric: PlanMetric,
  targetUsd: number,
  bonusAllocationUsd: number,
  fiscalYear: number,
  calculationMonth: string
): DealAttributionResult {
  // Filter out deals with zero or null ARR
  const validDeals = deals.filter(d => 
    d.new_software_booking_arr_usd && d.new_software_booking_arr_usd > 0
  );
  
  // Calculate total actual ARR
  const totalActualUsd = validDeals.reduce(
    (sum, d) => sum + (d.new_software_booking_arr_usd || 0), 
    0
  );
  
  // Handle edge case: no valid deals
  if (totalActualUsd === 0 || validDeals.length === 0) {
    return {
      attributions: [],
      context: {
        totalActualUsd: 0,
        targetUsd,
        achievementPct: 0,
        multiplier: 0,
        bonusAllocationUsd,
        totalVariablePayUsd: 0,
        metricName: metric.metric_name,
        fiscalYear,
        calculationMonth,
      }
    };
  }
  
  // Calculate aggregate variable pay
  const { achievementPct, multiplier, totalVariablePay } = calculateAggregateVariablePay(
    totalActualUsd,
    targetUsd,
    bonusAllocationUsd,
    metric
  );
  
  // Get payout split percentages from metric configuration
  // Note: Fallbacks (70/25/5) match database schema defaults - each plan should have its own splits defined
  const payoutOnBookingPct = metric.payout_on_booking_pct ?? 70;
  const payoutOnCollectionPct = metric.payout_on_collection_pct ?? 25;
  const payoutOnYearEndPct = metric.payout_on_year_end_pct ?? 5;
  
  // Calculate pro-rata attribution for each deal
  const attributions: DealVariablePayAttribution[] = validDeals.map(deal => {
    const dealValueUsd = deal.new_software_booking_arr_usd || 0;
    
    // Pro-rata proportion
    const proportionPct = (dealValueUsd / totalActualUsd) * 100;
    
    // Pro-rata variable pay split
    const variablePaySplitUsd = totalVariablePay * (proportionPct / 100);
    
    // Apply payout split percentages
    const payoutOnBookingUsd = variablePaySplitUsd * (payoutOnBookingPct / 100);
    const payoutOnCollectionUsd = variablePaySplitUsd * (payoutOnCollectionPct / 100);
    const payoutOnYearEndUsd = variablePaySplitUsd * (payoutOnYearEndPct / 100);
    
    // Clawback eligible = amount paid on booking
    const clawbackEligibleUsd = payoutOnBookingUsd;
    
    return {
      dealId: deal.id,
      projectId: deal.project_id,
      customerName: deal.customer_name,
      employeeId,
      metricName: metric.metric_name,
      dealValueUsd,
      proportionPct: Math.round(proportionPct * 100) / 100, // Round to 2 decimals
      variablePaySplitUsd: Math.round(variablePaySplitUsd * 100) / 100,
      payoutOnBookingUsd: Math.round(payoutOnBookingUsd * 100) / 100,
      payoutOnCollectionUsd: Math.round(payoutOnCollectionUsd * 100) / 100,
      payoutOnYearEndUsd: Math.round(payoutOnYearEndUsd * 100) / 100,
      clawbackEligibleUsd: Math.round(clawbackEligibleUsd * 100) / 100,
    };
  });
  
  return {
    attributions,
    context: {
      totalActualUsd,
      targetUsd,
      achievementPct: Math.round(achievementPct * 100) / 100,
      multiplier,
      bonusAllocationUsd,
      totalVariablePayUsd: Math.round(totalVariablePay * 100) / 100,
      metricName: metric.metric_name,
      fiscalYear,
      calculationMonth,
    }
  };
}

/**
 * Aggregate summary for variable pay attributions
 */
export interface VariablePaySummary {
  totalDeals: number;
  totalArrUsd: number;
  targetUsd: number;
  achievementPct: number;
  multiplier: number;
  totalVariablePayUsd: number;
  totalPayoutOnBookingUsd: number;
  totalPayoutOnCollectionUsd: number;
  totalPayoutOnYearEndUsd: number;
  totalClawbackEligibleUsd: number;
}

/**
 * Calculate summary totals from a list of attributions
 */
export function calculateVariablePaySummary(
  attributions: DealVariablePayAttribution[],
  context: AggregateVariablePayContext
): VariablePaySummary {
  return {
    totalDeals: attributions.length,
    totalArrUsd: context.totalActualUsd,
    targetUsd: context.targetUsd,
    achievementPct: context.achievementPct,
    multiplier: context.multiplier,
    totalVariablePayUsd: context.totalVariablePayUsd,
    totalPayoutOnBookingUsd: attributions.reduce((sum, a) => sum + a.payoutOnBookingUsd, 0),
    totalPayoutOnCollectionUsd: attributions.reduce((sum, a) => sum + a.payoutOnCollectionUsd, 0),
    totalPayoutOnYearEndUsd: attributions.reduce((sum, a) => sum + a.payoutOnYearEndUsd, 0),
    totalClawbackEligibleUsd: attributions.reduce((sum, a) => sum + a.clawbackEligibleUsd, 0),
  };
}
