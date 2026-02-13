/**
 * Database-Driven Compensation Calculation Engine
 * 
 * This module provides calculation functions that use plan configurations
 * from the database instead of hardcoded values.
 */

import { PlanMetric, MultiplierGrid } from "@/hooks/usePlanMetrics";

// ============= MULTIPLIER LOOKUP FROM DATABASE =============

/**
 * Get multiplier from a grid configuration based on achievement percentage.
 * Handles all three logic types: Stepped_Accelerator, Gated_Threshold, Linear
 */
export function getMultiplierFromGrid(
  achievementPercent: number,
  metric: PlanMetric
): number {
  const grids = metric.multiplier_grids || [];
  
  // Handle Gated_Threshold logic - if below gate, return 0
  if (metric.logic_type === "Gated_Threshold" && metric.gate_threshold_percent) {
    if (achievementPercent <= metric.gate_threshold_percent) {
      return 0; // No payout if below gate threshold
    }
  }
  
  // Handle Linear logic with no grids - no multipliers, direct achievement
  // Only skip multiplier lookup if Linear AND no grids defined
  if (metric.logic_type === "Linear" && grids.length === 0) {
    return 1.0;
  }
  
  // Sort grids by min_pct ascending for Stepped_Accelerator
  const sortedGrids = [...grids].sort((a, b) => a.min_pct - b.min_pct);
  
  // Find the appropriate multiplier tier
  for (const grid of sortedGrids) {
    if (achievementPercent >= grid.min_pct && achievementPercent < grid.max_pct) {
      return grid.multiplier_value;
    }
  }
  
  // If achievement is at or above the highest tier, use the last multiplier
  const lastGrid = sortedGrids[sortedGrids.length - 1];
  if (lastGrid && achievementPercent >= lastGrid.max_pct) {
    return lastGrid.multiplier_value;
  }
  
  // If achievement is below all tiers, use the first multiplier (or 1.0 as fallback)
  if (sortedGrids.length > 0 && achievementPercent < sortedGrids[0].min_pct) {
    return sortedGrids[0].multiplier_value;
  }
  
  return 1.0; // Default fallback
}

// ============= MARGINAL STEPPED ACCELERATOR =============

/**
 * Calculate payout using marginal/incremental tiers.
 * Each tier's multiplier applies ONLY to the achievement slice within that range.
 * 
 * Example: 110% achievement with tiers [0-100% @ 1.0x, 100-120% @ 1.4x]
 *   Tier 1: bonusAllocation × min(100%, 110%) × 1.0 = bonusAllocation × 100% × 1.0
 *   Tier 2: bonusAllocation × (110% - 100%) × 1.4  = bonusAllocation × 10% × 1.4
 *   Total = bonusAllocation × (1.0 + 0.14) = bonusAllocation × 1.14
 */
export function calculateMarginalPayout(
  achievementPercent: number,
  bonusAllocation: number,
  metric: PlanMetric
): { payout: number; weightedMultiplier: number } {
  const grids = metric.multiplier_grids || [];

  // Gate check for Gated_Threshold
  if (metric.logic_type === "Gated_Threshold" && metric.gate_threshold_percent) {
    if (achievementPercent <= metric.gate_threshold_percent) {
      return { payout: 0, weightedMultiplier: 0 };
    }
  }

  // If no grids, fall back to linear (1.0x flat)
  if (grids.length === 0) {
    const payout = (achievementPercent / 100) * bonusAllocation;
    return { payout, weightedMultiplier: 1.0 };
  }

  const sortedGrids = [...grids].sort((a, b) => a.min_pct - b.min_pct);
  let totalPayout = 0;

  for (const grid of sortedGrids) {
    if (achievementPercent <= grid.min_pct) break; // Haven't reached this tier

    // Slice of achievement within this tier
    const sliceStart = grid.min_pct;
    const sliceEnd = Math.min(achievementPercent, grid.max_pct);
    const slicePct = Math.max(0, sliceEnd - sliceStart);

    totalPayout += bonusAllocation * (slicePct / 100) * grid.multiplier_value;
  }

  // If achievement exceeds the highest tier, apply last tier's multiplier to the excess
  const lastGrid = sortedGrids[sortedGrids.length - 1];
  if (achievementPercent > lastGrid.max_pct) {
    const excessPct = achievementPercent - lastGrid.max_pct;
    totalPayout += bonusAllocation * (excessPct / 100) * lastGrid.multiplier_value;
  }

  // Weighted average multiplier for display purposes
  const rawPayout = (achievementPercent / 100) * bonusAllocation;
  const weightedMultiplier = rawPayout > 0 ? totalPayout / rawPayout : 1.0;

  return { payout: totalPayout, weightedMultiplier };
}

// ============= CALCULATION UTILITIES =============

/**
 * Calculate achievement percentage from actual and target values
 */
export function calculateAchievementPercent(
  actualValue: number,
  targetValue: number
): number {
  if (targetValue === 0) return 0;
  return (actualValue / targetValue) * 100;
}

/**
 * Calculate bonus allocation for a single metric based on plan weightage
 */
export function calculateMetricBonusAllocation(
  totalBonusUSD: number,
  metric: PlanMetric
): number {
  return (totalBonusUSD * metric.weightage_percent) / 100;
}

// ============= METRIC PAYOUT CALCULATION =============

export interface MetricPayoutResult {
  metricName: string;
  targetValue: number;
  actualValue: number;
  achievementPercent: number;
  bonusAllocation: number;
  multiplier: number;
  payout: number;
  logicType: string;
  isGated: boolean;
  gateThreshold: number | null;
}

/**
 * Calculate payout for a single metric using plan configuration
 */
export function calculateMetricPayoutFromPlan(
  metric: PlanMetric,
  targetValue: number,
  actualValue: number,
  totalBonusUSD: number
): MetricPayoutResult {
  const achievementPercent = calculateAchievementPercent(actualValue, targetValue);
  const bonusAllocation = calculateMetricBonusAllocation(totalBonusUSD, metric);
  
  // Check if gated and below threshold
  const isGated = metric.logic_type === "Gated_Threshold";
  const belowGate = isGated && 
    metric.gate_threshold_percent && 
    achievementPercent <= metric.gate_threshold_percent;

  let payout: number;
  let multiplier: number;

  if (belowGate) {
    payout = 0;
    multiplier = 0;
  } else if (metric.logic_type === "Stepped_Accelerator" || 
             (metric.logic_type === "Gated_Threshold" && (metric.multiplier_grids?.length ?? 0) > 0)) {
    // Use marginal calculation for Stepped Accelerator and Gated with grids
    const result = calculateMarginalPayout(achievementPercent, bonusAllocation, metric);
    payout = result.payout;
    multiplier = result.weightedMultiplier;
  } else {
    // Linear or no-grid fallback
    multiplier = getMultiplierFromGrid(achievementPercent, metric);
    payout = (achievementPercent / 100) * bonusAllocation * multiplier;
  }

  return {
    metricName: metric.metric_name,
    targetValue,
    actualValue,
    achievementPercent,
    bonusAllocation,
    multiplier,
    payout,
    logicType: metric.logic_type,
    isGated,
    gateThreshold: metric.gate_threshold_percent,
  };
}

// ============= FULL VARIABLE PAY CALCULATION =============

export interface MetricActual {
  metricId: string;
  metricName: string;
  targetValue: number;
  actualValue: number;
}

export interface VariablePayResult {
  userId: string;
  planId: string;
  planName: string;
  targetBonusUSD: number;
  proRatedTargetBonusUSD: number;
  proRationFactor: number;
  metricPayouts: MetricPayoutResult[];
  totalPayoutUSD: number;
  totalPayoutLocal: number;
  currencyCode: string;
  exchangeRateToUSD: number;
}

export interface VariablePayFromPlanInput {
  userId: string;
  planId: string;
  planName: string;
  targetBonusUSD: number;
  proRatedTargetBonusUSD: number;
  proRationFactor: number;
  metrics: PlanMetric[];
  metricsActuals: MetricActual[];
  currencyCode?: string;
  exchangeRateToUSD?: number;
}

/**
 * Calculate complete variable pay using plan configuration from database
 */
export function calculateVariablePayFromPlan(
  input: VariablePayFromPlanInput
): VariablePayResult {
  const currencyCode = input.currencyCode ?? 'USD';
  const exchangeRateToUSD = input.exchangeRateToUSD ?? 1;
  
  // Calculate payout for each metric
  const metricPayouts: MetricPayoutResult[] = input.metrics.map(metric => {
    // Find actual values for this metric
    const actual = input.metricsActuals.find(
      a => a.metricId === metric.id || a.metricName === metric.metric_name
    );
    
    const targetValue = actual?.targetValue ?? 0;
    const actualValue = actual?.actualValue ?? 0;
    
    return calculateMetricPayoutFromPlan(
      metric,
      targetValue,
      actualValue,
      input.proRatedTargetBonusUSD
    );
  });
  
  // Sum all metric payouts
  const totalPayoutUSD = metricPayouts.reduce((sum, m) => sum + m.payout, 0);
  
  // Convert to local currency
  const totalPayoutLocal = exchangeRateToUSD > 0 
    ? totalPayoutUSD / exchangeRateToUSD 
    : 0;
  
  return {
    userId: input.userId,
    planId: input.planId,
    planName: input.planName,
    targetBonusUSD: input.targetBonusUSD,
    proRatedTargetBonusUSD: input.proRatedTargetBonusUSD,
    proRationFactor: input.proRationFactor,
    metricPayouts,
    totalPayoutUSD,
    totalPayoutLocal,
    currencyCode,
    exchangeRateToUSD,
  };
}

// ============= PROJECTION CALCULATIONS =============

export interface PayoutProjection {
  achievementLevel: number; // e.g., 100, 120, 150
  label: string;
  estimatedPayout: number;
  averageMultiplier: number;
}

/**
 * Generate payout projections for different achievement levels
 * Uses the actual plan configuration to calculate realistic projections
 */
export function generatePayoutProjections(
  metrics: PlanMetric[],
  proRatedTargetBonusUSD: number,
  achievementLevels: number[] = [100, 120, 150]
): PayoutProjection[] {
  return achievementLevels.map(level => {
    let totalPayout = 0;
    let totalWeight = 0;
    let weightedMultiplierSum = 0;
    
    metrics.forEach(metric => {
      const bonusAllocation = (proRatedTargetBonusUSD * metric.weightage_percent) / 100;
      
      // Check gate threshold
      const isGated = metric.logic_type === "Gated_Threshold";
      const belowGate = isGated && 
        metric.gate_threshold_percent && 
        level <= metric.gate_threshold_percent;
      
      let payout: number;
      let multiplier: number;

      if (belowGate) {
        payout = 0;
        multiplier = 0;
      } else if (metric.logic_type === "Stepped_Accelerator" || 
                 (metric.logic_type === "Gated_Threshold" && (metric.multiplier_grids?.length ?? 0) > 0)) {
        const result = calculateMarginalPayout(level, bonusAllocation, metric);
        payout = result.payout;
        multiplier = result.weightedMultiplier;
      } else {
        multiplier = getMultiplierFromGrid(level, metric);
        payout = (level / 100) * bonusAllocation * multiplier;
      }
      
      totalPayout += payout;
      totalWeight += metric.weightage_percent;
      weightedMultiplierSum += multiplier * metric.weightage_percent;
    });
    
    const averageMultiplier = totalWeight > 0 
      ? weightedMultiplierSum / totalWeight 
      : 1;
    
    return {
      achievementLevel: level,
      label: `${level}%`,
      estimatedPayout: totalPayout,
      averageMultiplier,
    };
  });
}
