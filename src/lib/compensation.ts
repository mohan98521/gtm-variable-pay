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

// Placeholder for multiplier logic - will be expanded based on user input
export interface MultiplierConfig {
  salesFunction: string;
  metricType: string;
  gateThresholdPercent?: number; // Below this = 0 payout (for Farmers)
  acceleratorTiers?: Array<{
    minPercent: number;
    maxPercent: number;
    multiplier: number;
  }>;
}

// Will be populated after user provides multiplier/threshold data
export const MULTIPLIER_CONFIGS: MultiplierConfig[] = [];

// Calculate payout multiplier based on achievement (placeholder - to be expanded)
export function getPayoutMultiplier(
  achievementPercent: number,
  salesFunction: string,
  metricType: string
): number {
  // Default linear calculation (1:1 payout ratio)
  // This will be enhanced with gate thresholds and accelerators
  return achievementPercent / 100;
}

// Calculate total variable pay for an employee
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
  
  const newBookingMultiplier = getPayoutMultiplier(newBookingAchievement, salesFunction, "New Software Booking ARR");
  const closingMultiplier = getPayoutMultiplier(closingAchievement, salesFunction, "Closing ARR");
  
  const newBookingPayout = bonusAllocation.newSoftwareBookingARR * newBookingMultiplier;
  const closingPayout = bonusAllocation.closingARR * closingMultiplier;
  
  return {
    employeeId,
    salesFunction,
    targetBonusUSD,
    newSoftwareBookingARR: {
      targetValue: newBookingTarget,
      actualValue: newBookingActual,
      achievementPercent: newBookingAchievement,
      bonusAllocation: bonusAllocation.newSoftwareBookingARR,
      multiplier: newBookingMultiplier,
      payout: newBookingPayout,
    },
    closingARR: {
      targetValue: closingTarget,
      actualValue: closingActual,
      achievementPercent: closingAchievement,
      bonusAllocation: bonusAllocation.closingARR,
      multiplier: closingMultiplier,
      payout: closingPayout,
    },
    totalPayout: newBookingPayout + closingPayout,
  };
}
