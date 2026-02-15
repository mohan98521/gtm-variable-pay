/**
 * SPIFF Calculation Engine
 * 
 * Calculates SPIFF payouts for deals that meet minimum value thresholds.
 * Each SPIFF is linked to a plan metric, and the payout is calculated as:
 * 
 * Software Variable OTE = Total Variable OTE * (linked metric weightage / 100)
 * Deal SPIFF = Software Variable OTE * (Deal ARR / Software Target) * SPIFF Rate %
 */

export interface SpiffConfig {
  id: string;
  spiff_name: string;
  linked_metric_name: string;
  spiff_rate_pct: number;
  min_deal_value_usd: number | null;
  is_active: boolean;
}

export interface SpiffDeal {
  id: string;
  new_software_booking_arr_usd: number | null;
  project_id: string;
  customer_name: string | null;
}

export interface SpiffMetric {
  metric_name: string;
  weightage_percent: number;
}

export interface SpiffDealBreakdown {
  dealId: string;
  projectId: string;
  customerName: string | null;
  dealArrUsd: number;
  spiffPayoutUsd: number;
  spiffName: string;
  spiffRatePct: number;
  isEligible: boolean;
  exclusionReason: string | null;
}

export interface SpiffCalculationResult {
  totalSpiffUsd: number;
  dealBreakdowns: SpiffDealBreakdown[];
  softwareVariableOteUsd: number;
  linkedMetricWeightage: number;
}

/**
 * Calculate SPIFF payouts for a single SPIFF configuration
 */
export function calculateSpiffPayout(
  spiff: SpiffConfig,
  deals: SpiffDeal[],
  planMetrics: SpiffMetric[],
  variableOteUsd: number,
  softwareTargetUsd: number
): SpiffCalculationResult {
  if (!spiff.is_active || softwareTargetUsd === 0) {
    return {
      totalSpiffUsd: 0,
      dealBreakdowns: [],
      softwareVariableOteUsd: 0,
      linkedMetricWeightage: 0,
    };
  }

  // Find the linked metric's weightage
  const linkedMetric = planMetrics.find(
    m => m.metric_name === spiff.linked_metric_name
  );
  const linkedWeightage = linkedMetric?.weightage_percent ?? 0;

  if (linkedWeightage === 0) {
    return {
      totalSpiffUsd: 0,
      dealBreakdowns: [],
      softwareVariableOteUsd: 0,
      linkedMetricWeightage: 0,
    };
  }

  // Software Variable OTE = Total Variable OTE * linked metric weightage
  const softwareVariableOteUsd = variableOteUsd * (linkedWeightage / 100);

  const dealBreakdowns: SpiffDealBreakdown[] = [];
  let totalSpiffUsd = 0;

  for (const deal of deals) {
    const dealArr = deal.new_software_booking_arr_usd || 0;

    if (dealArr <= 0) continue;

    // Check minimum deal value threshold
    if (spiff.min_deal_value_usd && dealArr < spiff.min_deal_value_usd) {
      dealBreakdowns.push({
        dealId: deal.id,
        projectId: deal.project_id,
        customerName: deal.customer_name,
        dealArrUsd: dealArr,
        spiffPayoutUsd: 0,
        spiffName: spiff.spiff_name,
        spiffRatePct: spiff.spiff_rate_pct,
        isEligible: false,
        exclusionReason: `Deal ARR $${dealArr.toLocaleString()} below minimum $${spiff.min_deal_value_usd.toLocaleString()}`,
      });
      continue;
    }

    // Deal SPIFF = Software Variable OTE * (Deal ARR / Software Target) * SPIFF Rate %
    const spiffPayoutUsd = softwareVariableOteUsd * (dealArr / softwareTargetUsd) * (spiff.spiff_rate_pct / 100);
    const roundedPayout = Math.round(spiffPayoutUsd * 100) / 100;

    totalSpiffUsd += roundedPayout;
    dealBreakdowns.push({
      dealId: deal.id,
      projectId: deal.project_id,
      customerName: deal.customer_name,
      dealArrUsd: dealArr,
      spiffPayoutUsd: roundedPayout,
      spiffName: spiff.spiff_name,
      spiffRatePct: spiff.spiff_rate_pct,
      isEligible: true,
      exclusionReason: null,
    });
  }

  return {
    totalSpiffUsd: Math.round(totalSpiffUsd * 100) / 100,
    dealBreakdowns,
    softwareVariableOteUsd: Math.round(softwareVariableOteUsd * 100) / 100,
    linkedMetricWeightage: linkedWeightage,
  };
}

/**
 * Calculate all SPIFFs for an employee
 */
export interface SpiffAggregateResult {
  totalSpiffUsd: number;
  breakdowns: SpiffDealBreakdown[];
  /** The linked metric's performance target */
  softwareTargetUsd: number;
  /** Sum of deal ARR values that passed the SPIFF threshold */
  eligibleActualsUsd: number;
  /** Variable OTE allocated to the linked metric (variableOTE × weightage) */
  softwareVariableOteUsd: number;
  /** The SPIFF rate applied */
  spiffRatePct: number;
}

export function calculateAllSpiffs(
  spiffs: SpiffConfig[],
  deals: SpiffDeal[],
  planMetrics: SpiffMetric[],
  variableOteUsd: number,
  targetsByMetric: Record<string, number>
): SpiffAggregateResult {
  let totalSpiffUsd = 0;
  const breakdowns: SpiffDealBreakdown[] = [];
  let softwareTargetUsd = 0;
  let eligibleActualsUsd = 0;
  let softwareVariableOteUsd = 0;
  let spiffRatePct = 0;

  for (const spiff of spiffs) {
    if (!spiff.is_active) continue;

    const target = targetsByMetric[spiff.linked_metric_name] ?? 0;
    const result = calculateSpiffPayout(spiff, deals, planMetrics, variableOteUsd, target);

    totalSpiffUsd += result.totalSpiffUsd;
    breakdowns.push(...result.dealBreakdowns);

    // Capture aggregate metadata from the last active SPIFF
    softwareTargetUsd = target;
    softwareVariableOteUsd = result.softwareVariableOteUsd;
    spiffRatePct = spiff.spiff_rate_pct;
    eligibleActualsUsd += result.dealBreakdowns
      .filter(b => b.isEligible)
      .reduce((sum, b) => sum + b.dealArrUsd, 0);
  }

  return {
    totalSpiffUsd: Math.round(totalSpiffUsd * 100) / 100,
    breakdowns,
    softwareTargetUsd,
    eligibleActualsUsd: Math.round(eligibleActualsUsd * 100) / 100,
    softwareVariableOteUsd: Math.round(softwareVariableOteUsd * 100) / 100,
    spiffRatePct,
  };
}
