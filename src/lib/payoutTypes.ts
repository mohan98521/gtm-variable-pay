/**
 * Shared Payout Type Classification Utility
 * 
 * Ensures consistent categorization of payout types across all reports.
 * All hooks and components should import from this module instead of
 * using ad-hoc string matching.
 */

export const VP_TYPES = ['Variable Pay'] as const;
export const COMMISSION_TYPES = ['Managed Services', 'Implementation', 'CR/ER', 'Perpetual License'] as const;
export const ADDITIONAL_PAY_TYPES = ['NRR Additional Pay', 'SPIFF', 'Deal Team SPIFF'] as const;
export const RELEASE_TYPES = ['Collection Release', 'Year-End Release'] as const;
export const DEDUCTION_TYPES = ['Clawback'] as const;

/** Display name for the NRR Additional Pay payout type (database value stays 'NRR Additional Pay') */
export const NRR_DISPLAY_NAME = '(CR/ER + Implementation)';

export type PayoutCategory = 'vp' | 'commission' | 'additional_pay' | 'release' | 'deduction' | 'unknown';

const VP_SET = new Set<string>(VP_TYPES);
const COMMISSION_SET = new Set<string>(COMMISSION_TYPES);
const ADDITIONAL_PAY_SET = new Set<string>(ADDITIONAL_PAY_TYPES);
const RELEASE_SET = new Set<string>(RELEASE_TYPES);
const DEDUCTION_SET = new Set<string>(DEDUCTION_TYPES);

/**
 * Classify a payout_type string into a category.
 */
export function classifyPayoutType(payoutType: string | null | undefined): PayoutCategory {
  if (!payoutType) return 'unknown';
  if (VP_SET.has(payoutType)) return 'vp';
  if (COMMISSION_SET.has(payoutType)) return 'commission';
  if (ADDITIONAL_PAY_SET.has(payoutType)) return 'additional_pay';
  if (RELEASE_SET.has(payoutType)) return 'release';
  if (DEDUCTION_SET.has(payoutType)) return 'deduction';
  return 'unknown';
}

/**
 * Check helpers for common classification needs
 */
export function isVpType(payoutType: string | null | undefined): boolean {
  return classifyPayoutType(payoutType) === 'vp';
}

export function isCommissionType(payoutType: string | null | undefined): boolean {
  return classifyPayoutType(payoutType) === 'commission';
}

export function isAdditionalPayType(payoutType: string | null | undefined): boolean {
  return classifyPayoutType(payoutType) === 'additional_pay';
}

export function isReleaseType(payoutType: string | null | undefined): boolean {
  return classifyPayoutType(payoutType) === 'release';
}

export function isDeductionType(payoutType: string | null | undefined): boolean {
  return classifyPayoutType(payoutType) === 'deduction';
}

/**
 * For holdback classification: VP-like types include VP + Additional Pay
 * Commission-like types include Commission + Releases
 */
export function isVpLikeForHoldback(payoutType: string | null | undefined): boolean {
  const cat = classifyPayoutType(payoutType);
  return cat === 'vp' || cat === 'additional_pay';
}

export function isCommissionLikeForHoldback(payoutType: string | null | undefined): boolean {
  const cat = classifyPayoutType(payoutType);
  return cat === 'commission' || cat === 'release';
}
