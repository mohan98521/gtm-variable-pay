/**
 * NRR (Non-Recurring Revenue) Additional Pay Calculation
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

export interface NRRCalculationResult {
  eligibleCrErUsd: number;
  totalCrErUsd: number;
  eligibleImplUsd: number;
  totalImplUsd: number;
  nrrActuals: number;
  nrrTarget: number;
  achievementPct: number;
  payoutUsd: number;
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
    };
  }

  let eligibleCrErUsd = 0;
  let totalCrErUsd = 0;
  let eligibleImplUsd = 0;
  let totalImplUsd = 0;

  for (const deal of deals) {
    const crEr = (deal.cr_usd || 0) + (deal.er_usd || 0);
    const impl = deal.implementation_usd || 0;
    const gpMargin = deal.gp_margin_percent || 0;

    // CR/ER
    if (crEr > 0) {
      totalCrErUsd += crEr;
      if (gpMargin >= crErMinGpMargin) {
        eligibleCrErUsd += crEr;
      }
    }

    // Implementation
    if (impl > 0) {
      totalImplUsd += impl;
      if (gpMargin >= implMinGpMargin) {
        eligibleImplUsd += impl;
      }
    }
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
  };
}
