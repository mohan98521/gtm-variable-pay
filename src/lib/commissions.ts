// Commission calculation utilities for plan-based commission structure

export interface PlanCommission {
  commission_type: string;
  commission_rate_pct: number;
  min_threshold_usd: number | null;
  is_active: boolean;
}

export interface CommissionCalculation {
  dealId: string;
  commissionType: string;
  tcvUsd: number;
  commissionRatePct: number;
  minThresholdUsd: number | null;
  qualifies: boolean;
  grossCommission: number;
  paidAmount: number;      // 75% of gross
  holdbackAmount: number;  // 25% of gross
}

/**
 * Calculate commission for a single deal based on TCV and commission rate.
 * Applies a configurable split between immediate payout and holdback.
 * 
 * @param tcvUsd - Total Contract Value in USD
 * @param commissionRatePct - Commission rate as a percentage (e.g., 4 for 4%)
 * @param minThresholdUsd - Optional minimum threshold the deal must meet
 * @param payoutOnBookingPct - Percentage paid on booking (default 75)
 * @param payoutOnCollectionPct - Percentage held for collection (default 25)
 * @returns Commission breakdown with gross, paid, and holdback amounts
 */
export function calculateDealCommission(
  tcvUsd: number,
  commissionRatePct: number,
  minThresholdUsd: number | null = null,
  payoutOnBookingPct: number = 75,
  payoutOnCollectionPct: number = 25
): { qualifies: boolean; gross: number; paid: number; holdback: number } {
  // Check if deal meets minimum threshold
  const qualifies = minThresholdUsd === null || tcvUsd >= minThresholdUsd;
  
  if (!qualifies || commissionRatePct === 0) {
    return { qualifies, gross: 0, paid: 0, holdback: 0 };
  }
  
  // Calculate gross commission
  const gross = tcvUsd * (commissionRatePct / 100);
  
  // Apply configurable split (defaults to 75/25)
  const paid = gross * (payoutOnBookingPct / 100);
  const holdback = gross * (payoutOnCollectionPct / 100);
  
  return {
    qualifies,
    gross: Math.round(gross * 100) / 100,
    paid: Math.round(paid * 100) / 100,
    holdback: Math.round(holdback * 100) / 100,
  };
}

/**
 * Find the applicable commission rate for a given booking type from a list of plan commissions.
 * Returns null if no matching commission type is found or if it's inactive.
 */
export function getCommissionForType(
  commissions: PlanCommission[],
  bookingType: string
): PlanCommission | null {
  const commission = commissions.find(
    (c) => c.commission_type === bookingType && c.is_active
  );
  return commission ?? null;
}

/**
 * Calculate commission for a deal given the employee's plan commissions.
 */
export function calculateCommissionForDeal(
  dealId: string,
  bookingType: string,
  tcvUsd: number,
  planCommissions: PlanCommission[]
): CommissionCalculation | null {
  const commission = getCommissionForType(planCommissions, bookingType);
  
  if (!commission) {
    return null;
  }
  
  const result = calculateDealCommission(
    tcvUsd,
    commission.commission_rate_pct,
    commission.min_threshold_usd
  );
  
  return {
    dealId,
    commissionType: bookingType,
    tcvUsd,
    commissionRatePct: commission.commission_rate_pct,
    minThresholdUsd: commission.min_threshold_usd,
    qualifies: result.qualifies,
    grossCommission: result.gross,
    paidAmount: result.paid,
    holdbackAmount: result.holdback,
  };
}

/**
 * Calculate total commission across multiple deals.
 */
export function calculateTotalCommission(
  calculations: CommissionCalculation[]
): { totalGross: number; totalPaid: number; totalHoldback: number } {
  return calculations.reduce(
    (acc, calc) => ({
      totalGross: acc.totalGross + calc.grossCommission,
      totalPaid: acc.totalPaid + calc.paidAmount,
      totalHoldback: acc.totalHoldback + calc.holdbackAmount,
    }),
    { totalGross: 0, totalPaid: 0, totalHoldback: 0 }
  );
}
