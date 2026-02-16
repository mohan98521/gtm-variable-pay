/**
 * (CR/ER + Implementation) Pay Calculation
 * 
 * Calculates additional compensation based on CR/ER and Implementation deals
 * that meet gross profit margin thresholds.
 * 
 * Formula: Payout = Variable OTE * NRR OTE % * (Eligible NRR Actuals / NRR Target)
 */

export interface NRRDeal {
  id: string;
  cr_usd: number | null;
  er_usd: number | null;
  implementation_usd: number | null;
  gp_margin_percent: number | null;
}

export interface NRRDealBreakdown {
  dealId: string;
  crErUsd: number;
  implUsd: number;
  gpMarginPct: number | null;
  isEligible: boolean;
  exclusionReason: string | null;
  /** The deal value that counted toward NRR actuals (0 if excluded) */
  eligibleValueUsd: number;
}

export interface NRRCalculationResult {
  eligibleCrErUsd: number;
  totalCrErUsd: number;
  eligibleImplUsd: number;
  totalImplUsd: number;
  nrrActuals: number;
  nrrTarget: number;
  achievementPct: number;
  payoutUsd: number;
  dealBreakdowns: NRRDealBreakdown[];
}

/**
 * Calculate NRR Additional Pay
 */
export function calculateNRRPayout(
  deals: NRRDeal[],
  crErTargetUsd: number,
  implTargetUsd: number,
  nrrOtePct: number,
  variableOteUsd: number,
  crErMinGpMargin: number,
  implMinGpMargin: number
): NRRCalculationResult {
  const nrrTarget = crErTargetUsd + implTargetUsd;
  
  if (nrrTarget === 0 || nrrOtePct === 0) {
    return {
      eligibleCrErUsd: 0,
      totalCrErUsd: 0,
      eligibleImplUsd: 0,
      totalImplUsd: 0,
      nrrActuals: 0,
      nrrTarget,
      achievementPct: 0,
      payoutUsd: 0,
      dealBreakdowns: [],
    };
  }

  let eligibleCrErUsd = 0;
  let totalCrErUsd = 0;
  let eligibleImplUsd = 0;
  let totalImplUsd = 0;
  const dealBreakdowns: NRRDealBreakdown[] = [];

  for (const deal of deals) {
    const crEr = (deal.cr_usd || 0) + (deal.er_usd || 0);
    const impl = deal.implementation_usd || 0;
    const gpMargin = deal.gp_margin_percent;

    // Skip deals with no NRR-relevant values
    if (crEr <= 0 && impl <= 0) continue;

    let isEligible = true;
    let exclusionReason: string | null = null;
    let eligibleValue = 0;

    // CR/ER eligibility
    if (crEr > 0) {
      totalCrErUsd += crEr;
      if (gpMargin != null && gpMargin >= crErMinGpMargin) {
        eligibleCrErUsd += crEr;
        eligibleValue += crEr;
      } else {
        isEligible = false;
        exclusionReason = `GP margin ${gpMargin ?? 'N/A'}% below CR/ER minimum ${crErMinGpMargin}%`;
      }
    }

    // Implementation eligibility
    if (impl > 0) {
      totalImplUsd += impl;
      if (gpMargin != null && gpMargin >= implMinGpMargin) {
        eligibleImplUsd += impl;
        eligibleValue += impl;
      } else {
        // If CR/ER was eligible but impl is not, mark partially
        if (isEligible && crEr <= 0) {
          isEligible = false;
        }
        const implReason = `GP margin ${gpMargin ?? 'N/A'}% below Implementation minimum ${implMinGpMargin}%`;
        exclusionReason = exclusionReason ? `${exclusionReason}; ${implReason}` : implReason;
      }
    }

    // A deal is "eligible" if any part contributed
    if (eligibleValue > 0) {
      isEligible = true;
    }

    dealBreakdowns.push({
      dealId: deal.id,
      crErUsd: crEr,
      implUsd: impl,
      gpMarginPct: gpMargin,
      isEligible: eligibleValue > 0,
      exclusionReason: eligibleValue > 0 ? null : exclusionReason,
      eligibleValueUsd: eligibleValue,
    });
  }

  const nrrActuals = eligibleCrErUsd + eligibleImplUsd;
  const achievementPct = nrrTarget > 0 ? (nrrActuals / nrrTarget) * 100 : 0;
  const payoutUsd = variableOteUsd * (nrrOtePct / 100) * (achievementPct / 100);

  return {
    eligibleCrErUsd,
    totalCrErUsd,
    eligibleImplUsd,
    totalImplUsd,
    nrrActuals,
    nrrTarget,
    achievementPct: Math.round(achievementPct * 100) / 100,
    payoutUsd: Math.round(payoutUsd * 100) / 100,
    dealBreakdowns,
  };
}
