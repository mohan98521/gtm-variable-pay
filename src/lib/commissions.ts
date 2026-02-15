// Commission calculation utilities for plan-based commission structure

export interface PlanCommission {
  commission_type: string;
  commission_rate_pct: number;
  min_threshold_usd: number | null;
  is_active: boolean;
  payout_on_booking_pct?: number;
  payout_on_collection_pct?: number;
  payout_on_year_end_pct?: number;
  min_gp_margin_pct?: number | null;
}

export interface CommissionCalculation {
  dealId: string;
  commissionType: string;
  tcvUsd: number;
  commissionRatePct: number;
  minThresholdUsd: number | null;
  qualifies: boolean;
  grossCommission: number;
  paidAmount: number;        // payout_on_booking_pct of gross
  holdbackAmount: number;    // payout_on_collection_pct of gross
  yearEndHoldback: number;   // payout_on_year_end_pct of gross
  exclusionReason?: string;
  gpMarginPct?: number | null;
  minGpMarginPct?: number | null;
}

/**
 * Calculate commission for a single deal based on TCV and commission rate.
 * Applies a configurable three-way split: booking, collection holdback, and year-end reserve.
 * 
 * @param tcvUsd - Total Contract Value in USD
 * @param commissionRatePct - Commission rate as a percentage (e.g., 4 for 4%)
 * @param minThresholdUsd - Optional minimum threshold the deal must meet
 * @param payoutOnBookingPct - Percentage paid on booking (default 70)
 * @param payoutOnCollectionPct - Percentage held for collection (default 25)
 * @param payoutOnYearEndPct - Percentage reserved for year-end (default 5)
 * @returns Commission breakdown with gross, paid, holdback, and year-end amounts
 */
export function calculateDealCommission(
  tcvUsd: number,
  commissionRatePct: number,
  minThresholdUsd: number | null = null,
  payoutOnBookingPct: number = 0,
  payoutOnCollectionPct: number = 100,
  payoutOnYearEndPct: number = 0
): { qualifies: boolean; gross: number; paid: number; holdback: number; yearEndHoldback: number } {
  // Check if deal meets minimum threshold
  const qualifies = minThresholdUsd === null || tcvUsd >= minThresholdUsd;
  
  if (!qualifies || commissionRatePct === 0) {
    return { qualifies, gross: 0, paid: 0, holdback: 0, yearEndHoldback: 0 };
  }
  
  // Calculate gross commission
  const gross = tcvUsd * (commissionRatePct / 100);
  
  // Apply configurable three-way split - values come from plan configuration
  // Default parameters (70/25/5) match database schema defaults
  const paid = gross * (payoutOnBookingPct / 100);
  const holdback = gross * (payoutOnCollectionPct / 100);
  const yearEndHoldback = gross * (payoutOnYearEndPct / 100);
  
  return {
    qualifies,
    gross: Math.round(gross * 100) / 100,
    paid: Math.round(paid * 100) / 100,
    holdback: Math.round(holdback * 100) / 100,
    yearEndHoldback: Math.round(yearEndHoldback * 100) / 100,
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
    commission.min_threshold_usd,
    commission.payout_on_booking_pct ?? 0,
    commission.payout_on_collection_pct ?? 100,
    commission.payout_on_year_end_pct ?? 0
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
    yearEndHoldback: result.yearEndHoldback,
  };
}

/**
 * Calculate total commission across multiple deals.
 */
export function calculateTotalCommission(
  calculations: CommissionCalculation[]
): { totalGross: number; totalPaid: number; totalHoldback: number; totalYearEndHoldback: number } {
  return calculations.reduce(
    (acc, calc) => ({
      totalGross: acc.totalGross + calc.grossCommission,
      totalPaid: acc.totalPaid + calc.paidAmount,
      totalHoldback: acc.totalHoldback + calc.holdbackAmount,
      totalYearEndHoldback: acc.totalYearEndHoldback + calc.yearEndHoldback,
    }),
    { totalGross: 0, totalPaid: 0, totalHoldback: 0, totalYearEndHoldback: 0 }
  );
}
