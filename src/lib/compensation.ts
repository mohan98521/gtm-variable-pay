/**
 * COMPENSATION UTILITIES
 * 
 * NOTE: The hardcoded BONUS_SPLITS and multiplier configurations below are
 * DEPRECATED. New code should use the database-driven calculation engine
 * in src/lib/compensationEngine.ts which fetches configurations from:
 * - comp_plans (plan definitions)
 * - plan_metrics (metric weightages and logic types)
 * - multiplier_grids (achievement-based multipliers)
 * 
 * The legacy functions below are kept for backward compatibility only.
 * They will be removed in a future version.
 */

// ============= DEPRECATED: LEGACY BONUS SPLITS =============
// These are kept for backward compatibility only.
// Use plan_metrics.weightage_percent from database instead.

export interface MetricSplit {
  newSoftwareBookingARR: number; // percentage (0-100)
  closingARR: number; // percentage (0-100)
}

/** @deprecated Use plan_metrics from database instead */
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

/** @deprecated Use plan_metrics from database instead */
export const DEFAULT_BONUS_SPLIT: MetricSplit = { 
  newSoftwareBookingARR: 100, 
  closingARR: 0 
};

/** 
 * @deprecated Use useUserPlanConfiguration hook and plan_metrics instead.
 * This function uses hardcoded values. New implementations should fetch
 * metric weightages from the database via plan_metrics table.
 */
export function getBonusSplit(salesFunction: string | null | undefined): MetricSplit {
  if (!salesFunction) return DEFAULT_BONUS_SPLIT;
  return BONUS_SPLITS[salesFunction] ?? DEFAULT_BONUS_SPLIT;
}

// ============= PRO-RATION UTILITIES =============

export interface ProRationInput {
  effectiveStartDate: Date | string;
  effectiveEndDate: Date | string;
  targetBonusUSD: number;
  fullYearDays?: number; // defaults to 365
}

export interface ProRationResult {
  proRatedTargetBonusUSD: number;
  proRationFactor: number; // 0.0 to 1.0
  daysInPeriod: number;
  fullYearDays: number;
}

/**
 * Calculate pro-rated target bonus based on effective dates.
 * For new joiners: start date = joining date
 * For existing employees: start date = Jan 1st
 * End date = Dec 31st unless earlier departure
 */
export function calculateProRation(input: ProRationInput): ProRationResult {
  const fullYearDays = input.fullYearDays ?? 365;
  
  const startDate = typeof input.effectiveStartDate === 'string' 
    ? new Date(input.effectiveStartDate) 
    : input.effectiveStartDate;
  
  const endDate = typeof input.effectiveEndDate === 'string' 
    ? new Date(input.effectiveEndDate) 
    : input.effectiveEndDate;
  
  // Calculate days in period (inclusive of both start and end dates)
  const timeDiff = endDate.getTime() - startDate.getTime();
  const daysInPeriod = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;
  
  // Calculate pro-ration factor (capped at 1.0)
  const proRationFactor = Math.min(daysInPeriod / fullYearDays, 1.0);
  
  // Calculate pro-rated target bonus
  const proRatedTargetBonusUSD = input.targetBonusUSD * proRationFactor;
  
  return {
    proRatedTargetBonusUSD,
    proRationFactor,
    daysInPeriod: Math.max(0, daysInPeriod),
    fullYearDays,
  };
}

/**
 * Helper to determine effective dates for an employee
 * @param dateOfHire - Employee's hire date (null for existing employees assumed before current year)
 * @param currentYear - The fiscal year to calculate for (defaults to current year)
 * @returns Start and end dates for the compensation period
 */
export function getEffectiveDates(
  dateOfHire: Date | string | null,
  departureDate: Date | string | null = null,
  currentYear: number = new Date().getFullYear()
): { startDate: Date; endDate: Date } {
  const yearStart = new Date(currentYear, 0, 1); // Jan 1st
  const yearEnd = new Date(currentYear, 11, 31); // Dec 31st
  
  let startDate = yearStart;
  let endDate = yearEnd;
  
  // For new joiners, use hire date if it's in the current year
  if (dateOfHire) {
    const hireDate = typeof dateOfHire === 'string' ? new Date(dateOfHire) : dateOfHire;
    if (hireDate.getFullYear() === currentYear && hireDate > yearStart) {
      startDate = hireDate;
    }
  }
  
  // Handle early departure
  if (departureDate) {
    const depDate = typeof departureDate === 'string' ? new Date(departureDate) : departureDate;
    if (depDate.getFullYear() === currentYear && depDate < yearEnd) {
      endDate = depDate;
    }
  }
  
  return { startDate, endDate };
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

// ============= DEPRECATED: LEGACY MULTIPLIER CONFIGURATIONS =============
// These are kept for backward compatibility only.
// Use multiplier_grids table from database instead via compensationEngine.ts

/** @deprecated Role groups - use plan_metrics.logic_type instead */
const STANDARD_ACCELERATOR_ROLES = ["Farmer", "Hunter"];
/** @deprecated Role groups - use plan_metrics.logic_type instead */
const SALES_HEAD_ACCELERATOR_ROLES = ["Sales head - Farmer", "Sales Head - Hunter"];

/**
 * @deprecated Use getMultiplierFromGrid in compensationEngine.ts instead.
 * New Software Booking ARR Multipliers - hardcoded legacy logic.
 */
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

// ============= BLENDED PRO-RATA TARGET BONUS =============

export interface BlendedProRataSegment {
  targetBonusUsd: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface BlendedProRataResult {
  effectiveTargetBonusUsd: number;
  blendedTargetBonusUsd: number;
  isBlended: boolean;
  segmentDetails: Array<{
    targetBonusUsd: number;
    days: number;
    contribution: number;
  }>;
}

/**
 * Calculate blended pro-rata target bonus for mid-year compensation changes.
 *
 * Logic:
 * - If only one segment exists, return its target as-is.
 * - If multiple segments exist:
 *   - Compute blended = sum(segment.target × segment.days / totalDaysInYear)
 *   - If currentMonth falls within the FIRST segment: return first segment's original target
 *   - Otherwise: return the blended target
 *
 * Uses actual calendar days (not months/12) for precision.
 */
export function calculateBlendedProRata(
  segments: BlendedProRataSegment[],
  currentMonth: string, // YYYY-MM
  fiscalYear: number
): BlendedProRataResult {
  if (segments.length === 0) {
    return { effectiveTargetBonusUsd: 0, blendedTargetBonusUsd: 0, isBlended: false, segmentDetails: [] };
  }

  if (segments.length === 1) {
    const seg = segments[0];
    return {
      effectiveTargetBonusUsd: seg.targetBonusUsd,
      blendedTargetBonusUsd: seg.targetBonusUsd,
      isBlended: false,
      segmentDetails: [{ targetBonusUsd: seg.targetBonusUsd, days: 365, contribution: seg.targetBonusUsd }],
    };
  }

  const yearStart = new Date(fiscalYear, 0, 1);
  const yearEnd = new Date(fiscalYear, 11, 31);
  const totalDaysInYear = Math.ceil((yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1; // 365 or 366

  // Sort segments by start date
  const sorted = [...segments].sort((a, b) => a.startDate.localeCompare(b.startDate));

  let blendedTarget = 0;
  const segmentDetails: BlendedProRataResult['segmentDetails'] = [];

  for (const seg of sorted) {
    const segStart = new Date(Math.max(new Date(seg.startDate).getTime(), yearStart.getTime()));
    const segEnd = new Date(Math.min(new Date(seg.endDate).getTime(), yearEnd.getTime()));
    const days = Math.max(0, Math.ceil((segEnd.getTime() - segStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const contribution = seg.targetBonusUsd * days / totalDaysInYear;
    blendedTarget += contribution;
    segmentDetails.push({ targetBonusUsd: seg.targetBonusUsd, days, contribution });
  }

  // Determine if currentMonth falls within the first segment
  const firstSeg = sorted[0];
  const currentMonthDate = new Date(`${currentMonth}-15`); // mid-month for comparison
  const firstSegEnd = new Date(firstSeg.endDate);

  const isInFirstSegment = currentMonthDate <= firstSegEnd;

  return {
    effectiveTargetBonusUsd: isInFirstSegment ? firstSeg.targetBonusUsd : blendedTarget,
    blendedTargetBonusUsd: blendedTarget,
    isBlended: !isInFirstSegment,
    segmentDetails,
  };
}

// ============= CURRENCY CONVERSION =============

export interface CurrencyAmount {
  localCurrency: number;
  usd: number;
  currencyCode: string;
}

export function convertToUSD(
  localAmount: number,
  exchangeRateToUSD: number
): number {
  return localAmount * exchangeRateToUSD;
}

export function convertFromUSD(
  usdAmount: number,
  exchangeRateToUSD: number
): number {
  if (exchangeRateToUSD === 0) return 0;
  return usdAmount / exchangeRateToUSD;
}

// ============= VARIABLE PAY CALCULATION =============

export interface MetricPayoutDetail {
  targetValue: number;
  actualValue: number;
  achievementPercent: number;
  bonusAllocation: number;
  multiplier: number;
  payout: number;
}

export interface VariablePayCalculation {
  employeeId: string;
  salesFunction: string;
  targetBonusUSD: number;
  proRatedTargetBonusUSD: number;
  proRationFactor: number;
  newSoftwareBookingARR: MetricPayoutDetail;
  closingARR: MetricPayoutDetail;
  totalPayout: CurrencyAmount;
  currencyCode: string;
  exchangeRateToUSD: number;
}

export interface VariablePayInput {
  employeeId: string;
  salesFunction: string;
  targetBonusUSD: number;
  effectiveStartDate: Date | string;
  effectiveEndDate: Date | string;
  newBookingTarget: number;
  newBookingActual: number;
  closingTarget: number;
  closingActual: number;
  currencyCode?: string;
  exchangeRateToUSD?: number;
}

export function calculateVariablePay(input: VariablePayInput): VariablePayCalculation;
export function calculateVariablePay(
  employeeId: string,
  salesFunction: string,
  targetBonusUSD: number,
  newBookingTarget: number,
  newBookingActual: number,
  closingTarget: number,
  closingActual: number
): VariablePayCalculation;

export function calculateVariablePay(
  employeeIdOrInput: string | VariablePayInput,
  salesFunction?: string,
  targetBonusUSD?: number,
  newBookingTarget?: number,
  newBookingActual?: number,
  closingTarget?: number,
  closingActual?: number
): VariablePayCalculation {
  // Handle both function signatures
  let input: VariablePayInput;
  
  if (typeof employeeIdOrInput === 'object') {
    input = employeeIdOrInput;
  } else {
    // Legacy signature - use full year
    const currentYear = new Date().getFullYear();
    input = {
      employeeId: employeeIdOrInput,
      salesFunction: salesFunction!,
      targetBonusUSD: targetBonusUSD!,
      effectiveStartDate: new Date(currentYear, 0, 1),
      effectiveEndDate: new Date(currentYear, 11, 31),
      newBookingTarget: newBookingTarget!,
      newBookingActual: newBookingActual!,
      closingTarget: closingTarget!,
      closingActual: closingActual!,
      currencyCode: 'USD',
      exchangeRateToUSD: 1,
    };
  }

  const currencyCode = input.currencyCode ?? 'USD';
  const exchangeRateToUSD = input.exchangeRateToUSD ?? 1;

  // Calculate pro-ration
  const proRation = calculateProRation({
    effectiveStartDate: input.effectiveStartDate,
    effectiveEndDate: input.effectiveEndDate,
    targetBonusUSD: input.targetBonusUSD,
  });

  // Use pro-rated target bonus for allocations
  const bonusAllocation = calculateBonusAllocation(proRation.proRatedTargetBonusUSD, input.salesFunction);
  
  const newBookingAchievement = calculateAchievementPercent(input.newBookingActual, input.newBookingTarget);
  const closingAchievement = calculateAchievementPercent(input.closingActual, input.closingTarget);
  
  const newBookingResult = calculateMetricPayout(
    newBookingAchievement,
    bonusAllocation.newSoftwareBookingARR,
    input.salesFunction,
    "New Software Booking ARR"
  );
  
  const closingResult = calculateMetricPayout(
    closingAchievement,
    bonusAllocation.closingARR,
    input.salesFunction,
    "Closing ARR"
  );
  
  const totalPayoutUSD = newBookingResult.payout + closingResult.payout;
  const totalPayoutLocal = convertFromUSD(totalPayoutUSD, exchangeRateToUSD);

  return {
    employeeId: input.employeeId,
    salesFunction: input.salesFunction,
    targetBonusUSD: input.targetBonusUSD,
    proRatedTargetBonusUSD: proRation.proRatedTargetBonusUSD,
    proRationFactor: proRation.proRationFactor,
    newSoftwareBookingARR: {
      targetValue: input.newBookingTarget,
      actualValue: input.newBookingActual,
      achievementPercent: newBookingAchievement,
      bonusAllocation: bonusAllocation.newSoftwareBookingARR,
      multiplier: newBookingResult.multiplier,
      payout: newBookingResult.payout,
    },
    closingARR: {
      targetValue: input.closingTarget,
      actualValue: input.closingActual,
      achievementPercent: closingAchievement,
      bonusAllocation: bonusAllocation.closingARR,
      multiplier: closingResult.multiplier,
      payout: closingResult.payout,
    },
    totalPayout: {
      localCurrency: totalPayoutLocal,
      usd: totalPayoutUSD,
      currencyCode,
    },
    currencyCode,
    exchangeRateToUSD,
  };
}
