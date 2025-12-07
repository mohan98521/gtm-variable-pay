// Bonus split configuration by sales function
// Maps sales_function to percentage allocation for each metric

export interface MetricSplit {
  newSoftwareBookingARR: number; // percentage (0-100)
  closingARR: number; // percentage (0-100)
}

export const BONUS_SPLITS: Record<string, MetricSplit> = {
  "Farmer": { newSoftwareBookingARR: 50, closingARR: 50 },
  "Hunter": { newSoftwareBookingARR: 100, closingARR: 0 },
  "CSM": { newSoftwareBookingARR: 100, closingARR: 0 },
  "IMAL Product SE": { newSoftwareBookingARR: 100, closingARR: 0 },
  "Sales Engineering - Head": { newSoftwareBookingARR: 100, closingARR: 0 },
  "Sales head - Farmer": { newSoftwareBookingARR: 60, closingARR: 40 },
  "Sales Head - Hunter": { newSoftwareBookingARR: 100, closingARR: 0 },
  "APAC Regional SE": { newSoftwareBookingARR: 100, closingARR: 0 },
  "Channel Sales": { newSoftwareBookingARR: 100, closingARR: 0 },
  "Farmer - Retain": { newSoftwareBookingARR: 0, closingARR: 100 },
  "Insurance Product SE": { newSoftwareBookingARR: 100, closingARR: 0 },
  "MEA Regional SE": { newSoftwareBookingARR: 100, closingARR: 0 },
  "Sales Engineering": { newSoftwareBookingARR: 100, closingARR: 0 },
};

// Default split if sales function not found
export const DEFAULT_BONUS_SPLIT: MetricSplit = { 
  newSoftwareBookingARR: 100, 
  closingARR: 0 
};

export function getBonusSplit(salesFunction: string | null | undefined): MetricSplit {
  if (!salesFunction) return DEFAULT_BONUS_SPLIT;
  return BONUS_SPLITS[salesFunction] ?? DEFAULT_BONUS_SPLIT;
}

// Calculate bonus allocation for each metric based on total target bonus
export function calculateBonusAllocation(
  targetBonusUSD: number,
  salesFunction: string | null | undefined
): { newSoftwareBookingARR: number; closingARR: number } {
  const split = getBonusSplit(salesFunction);
  return {
    newSoftwareBookingARR: (targetBonusUSD * split.newSoftwareBookingARR) / 100,
    closingARR: (targetBonusUSD * split.closingARR) / 100,
  };
}

// Achievement percentage calculation
export function calculateAchievementPercent(
  actualValue: number,
  targetValue: number
): number {
  if (targetValue === 0) return 0;
  return (actualValue / targetValue) * 100;
}

// ============= MULTIPLIER CONFIGURATIONS =============

// Role groups for New Software Booking ARR multipliers
const STANDARD_ACCELERATOR_ROLES = ["Farmer", "Hunter"];
const SALES_HEAD_ACCELERATOR_ROLES = ["Sales head - Farmer", "Sales Head - Hunter"];

// New Software Booking ARR Multipliers
export function getNewSoftwareBookingMultiplier(
  achievementPercent: number,
  salesFunction: string
): number {
  // Sales Head roles: 1.0 / 1.6 / 2.0
  if (SALES_HEAD_ACCELERATOR_ROLES.includes(salesFunction)) {
    if (achievementPercent > 120) return 2.0;
    if (achievementPercent > 100) return 1.6;
    return 1.0;
  }
  
  // Farmer and Hunter: 1.0 / 1.4 / 1.6
  if (STANDARD_ACCELERATOR_ROLES.includes(salesFunction)) {
    if (achievementPercent > 120) return 1.6;
    if (achievementPercent > 100) return 1.4;
    return 1.0;
  }
  
  // All other roles: flat 1.0 multiplier
  return 1.0;
}

// Closing ARR Multipliers (applies to roles with Closing ARR allocation)
// Gate threshold at 85% - below this = NO PAYOUT
export function getClosingARRMultiplier(achievementPercent: number): number {
  if (achievementPercent <= 85) return 0; // Gate - no payout
  if (achievementPercent <= 95) return 0.8;
  if (achievementPercent <= 100) return 1.0;
  return 1.2; // >100%
}

// Get the appropriate multiplier based on metric type
export function getPayoutMultiplier(
  achievementPercent: number,
  salesFunction: string,
  metricType: "New Software Booking ARR" | "Closing ARR"
): number {
  if (metricType === "New Software Booking ARR") {
    return getNewSoftwareBookingMultiplier(achievementPercent, salesFunction);
  }
  
  if (metricType === "Closing ARR") {
    return getClosingARRMultiplier(achievementPercent);
  }
  
  return 1.0; // Default fallback
}

// Calculate payout for a single metric
export function calculateMetricPayout(
  achievementPercent: number,
  bonusAllocation: number,
  salesFunction: string,
  metricType: "New Software Booking ARR" | "Closing ARR"
): { multiplier: number; payout: number } {
  const multiplier = getPayoutMultiplier(achievementPercent, salesFunction, metricType);
  
  // Payout = (Achievement % / 100) * Bonus Allocation * Multiplier
  // For Closing ARR with gate: if multiplier is 0, payout is 0
  const payout = multiplier === 0 
    ? 0 
    : (achievementPercent / 100) * bonusAllocation * multiplier;
  
  return { multiplier, payout };
}

// ============= VARIABLE PAY CALCULATION =============

export interface VariablePayCalculation {
  employeeId: string;
  salesFunction: string;
  targetBonusUSD: number;
  newSoftwareBookingARR: {
    targetValue: number;
    actualValue: number;
    achievementPercent: number;
    bonusAllocation: number;
    multiplier: number;
    payout: number;
  };
  closingARR: {
    targetValue: number;
    actualValue: number;
    achievementPercent: number;
    bonusAllocation: number;
    multiplier: number;
    payout: number;
  };
  totalPayout: number;
}

export function calculateVariablePay(
  employeeId: string,
  salesFunction: string,
  targetBonusUSD: number,
  newBookingTarget: number,
  newBookingActual: number,
  closingTarget: number,
  closingActual: number
): VariablePayCalculation {
  const bonusAllocation = calculateBonusAllocation(targetBonusUSD, salesFunction);
  
  const newBookingAchievement = calculateAchievementPercent(newBookingActual, newBookingTarget);
  const closingAchievement = calculateAchievementPercent(closingActual, closingTarget);
  
  const newBookingResult = calculateMetricPayout(
    newBookingAchievement,
    bonusAllocation.newSoftwareBookingARR,
    salesFunction,
    "New Software Booking ARR"
  );
  
  const closingResult = calculateMetricPayout(
    closingAchievement,
    bonusAllocation.closingARR,
    salesFunction,
    "Closing ARR"
  );
  
  return {
    employeeId,
    salesFunction,
    targetBonusUSD,
    newSoftwareBookingARR: {
      targetValue: newBookingTarget,
      actualValue: newBookingActual,
      achievementPercent: newBookingAchievement,
      bonusAllocation: bonusAllocation.newSoftwareBookingARR,
      multiplier: newBookingResult.multiplier,
      payout: newBookingResult.payout,
    },
    closingARR: {
      targetValue: closingTarget,
      actualValue: closingActual,
      achievementPercent: closingAchievement,
      bonusAllocation: bonusAllocation.closingARR,
      multiplier: closingResult.multiplier,
      payout: closingResult.payout,
    },
    totalPayout: newBookingResult.payout + closingResult.payout,
  };
}
