import { describe, it, expect } from 'vitest';
import { calculateNRRPayout } from '../nrrCalculation';

describe('Section 5: (CR/ER + Implementation)', () => {
  it('Test 5.1: Farmer NRR with GP margin filter → $1,600', () => {
    const result = calculateNRRPayout(
      [
        { id: 'd1', cr_usd: 80000, er_usd: 0, implementation_usd: 0, gp_margin_percent: 65 },  // eligible
        { id: 'd2', cr_usd: 50000, er_usd: 0, implementation_usd: 0, gp_margin_percent: 55 },  // ineligible
        { id: 'd3', cr_usd: 0, er_usd: 0, implementation_usd: 40000, gp_margin_percent: 35 },  // eligible
      ],
      200000, // crErTargetUsd
      100000, // implTargetUsd
      20,     // nrrOtePct
      20000,  // variableOteUsd
      60,     // crErMinGpMargin
      30      // implMinGpMargin
    );

    expect(result.eligibleCrErUsd).toBe(80000);
    expect(result.eligibleImplUsd).toBe(40000);
    expect(result.nrrActuals).toBe(120000);
    expect(result.achievementPct).toBeCloseTo(40, 0);
    expect(result.payoutUsd).toBeCloseTo(1600, 0);
  });

  it('Test 5.2: Overlay NRR OTE = 0% → $0', () => {
    const result = calculateNRRPayout(
      [{ id: 'd1', cr_usd: 100000, er_usd: 0, implementation_usd: 50000, gp_margin_percent: 70 }],
      200000,
      100000,
      0,      // nrrOtePct = 0
      20000,
      60,
      30
    );

    expect(result.payoutUsd).toBe(0);
  });
});
