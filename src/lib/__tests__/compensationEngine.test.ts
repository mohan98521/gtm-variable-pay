import { describe, it, expect } from 'vitest';
import {
  calculateMarginalPayout,
  calculateMetricPayoutFromPlan,
  calculateVariablePayFromPlan,
} from '../compensationEngine';
import { PlanMetric } from '@/hooks/usePlanMetrics';

function makeMetric(overrides: Partial<PlanMetric> = {}): PlanMetric {
  return {
    id: 'metric-1',
    plan_id: 'plan-1',
    metric_name: 'New Software Booking ARR',
    weightage_percent: 100,
    logic_type: 'Stepped_Accelerator',
    gate_threshold_percent: null,
    payout_on_booking_pct: 60,
    payout_on_collection_pct: 40,
    payout_on_year_end_pct: 0,
    multiplier_grids: [],
    ...overrides,
  } as PlanMetric;
}

function grid(min: number, max: number, mult: number) {
  return { id: `g-${min}-${max}`, plan_metric_id: 'm', min_pct: min, max_pct: max, multiplier_value: mult };
}

// ============= SECTION 1: Marginal Stepped Accelerator =============

describe('Section 1: Marginal Stepped Accelerator Plans', () => {
  const hunterMetric = makeMetric({
    multiplier_grids: [grid(0, 100, 1.0), grid(100, 120, 1.4), grid(120, 999, 1.6)],
  });

  it('1.1: Hunter 80% → $16,000', () => {
    expect(calculateMarginalPayout(80, 20000, hunterMetric).payout).toBeCloseTo(16000, 0);
  });

  it('1.2: Hunter 110% → $22,800', () => {
    expect(calculateMarginalPayout(110, 20000, hunterMetric).payout).toBeCloseTo(22800, 0);
  });

  it('1.3: Hunter 130% → $28,800', () => {
    expect(calculateMarginalPayout(130, 20000, hunterMetric).payout).toBeCloseTo(28800, 0);
  });

  it('1.4: Farmer dual metric 110% → $15,040', () => {
    const sw = makeMetric({
      weightage_percent: 60,
      multiplier_grids: [grid(0, 100, 1.0), grid(100, 120, 1.4), grid(120, 999, 1.6)],
    });
    const cl = makeMetric({
      weightage_percent: 40,
      logic_type: 'Gated_Threshold',
      gate_threshold_percent: 95,
      multiplier_grids: [grid(0, 95, 0.0), grid(95, 100, 1.0), grid(100, 999, 1.2)],
    });
    const swPayout = calculateMarginalPayout(110, 12000, sw).payout;
    const clPayout = calculateMarginalPayout(110, 8000, cl).payout;
    expect(swPayout).toBeCloseTo(13680, 0);
    expect(clPayout).toBeCloseTo(1360, 0);
    expect(swPayout + clPayout).toBeCloseTo(15040, 0);
  });

  it('1.5: Farmer Closing ARR below gate (90%) → $0', () => {
    const cl = makeMetric({
      logic_type: 'Gated_Threshold',
      gate_threshold_percent: 95,
      multiplier_grids: [grid(0, 95, 0.0), grid(95, 100, 1.0), grid(100, 999, 1.2)],
    });
    expect(calculateMarginalPayout(90, 8000, cl).payout).toBe(0);
  });

  it('1.6: Farmer Retain 97.5% → $375', () => {
    const m = makeMetric({
      logic_type: 'Gated_Threshold',
      gate_threshold_percent: 95,
      multiplier_grids: [grid(0, 95, 0.0), grid(95, 100, 1.0), grid(100, 999, 1.2)],
    });
    expect(calculateMarginalPayout(97.5, 15000, m).payout).toBeCloseTo(375, 0);
  });
});

// ============= SECTION 2: Linear Plans =============

describe('Section 2: Linear Plans', () => {
  it('2.1: SE 120% → $12,000', () => {
    const m = makeMetric({ logic_type: 'Linear', multiplier_grids: [grid(0, 999, 1.0)] });
    const r = calculateMetricPayoutFromPlan(m, 500000, 600000, 10000);
    expect(r.payout).toBeCloseTo(12000, 0);
  });

  it('2.2: Solution Mgr 80% → $6,400', () => {
    const m = makeMetric({ logic_type: 'Linear', multiplier_grids: [grid(0, 999, 1.0)] });
    const r = calculateMetricPayoutFromPlan(m, 400000, 320000, 8000);
    expect(r.payout).toBeCloseTo(6400, 0);
  });
});

// ============= SECTION 3: Sales Head Plans =============

describe('Section 3: Sales Head Plans', () => {
  it('3.1: SH Farmer 125% → $38,280', () => {
    const sw = makeMetric({
      weightage_percent: 60,
      multiplier_grids: [grid(0, 100, 1.0), grid(100, 120, 1.6), grid(120, 999, 2.0)],
    });
    const cl = makeMetric({
      weightage_percent: 40,
      multiplier_grids: [grid(0, 95, 1.0), grid(95, 100, 1.0), grid(100, 999, 1.2)],
    });
    const swP = calculateMarginalPayout(125, 18000, sw).payout;
    const clP = calculateMarginalPayout(105, 12000, cl).payout;
    expect(swP).toBeCloseTo(25560, 0);
    expect(clP).toBeCloseTo(12720, 0);
    expect(swP + clP).toBeCloseTo(38280, 0);
  });

  it('3.2: SH Hunter Stepped_Accelerator 115% → $31,000', () => {
    const m = makeMetric({
      multiplier_grids: [grid(0, 100, 1.0), grid(100, 120, 1.6), grid(120, 999, 2.0)],
    });
    // Tier 1: 0-100% at 1.0x = $25,000, Tier 2: 100-115% at 1.6x = $6,000
    expect(calculateMarginalPayout(115, 25000, m).payout).toBeCloseTo(31000, 0);
  });

  it('3.2b: SH Hunter Stepped_Accelerator 120% → $33,000', () => {
    const m = makeMetric({
      multiplier_grids: [grid(0, 100, 1.0), grid(100, 120, 1.6), grid(120, 999, 2.0)],
    });
    // Tier 1: 0-100% at 1.0x = $25,000, Tier 2: 100-120% at 1.6x = $8,000
    expect(calculateMarginalPayout(120, 25000, m).payout).toBeCloseTo(33000, 0);
  });
});

// ============= SECTION 4: Full VP =============

describe('Section 4: Full Variable Pay', () => {
  it('Hunter 110% full calculation → $22,800', () => {
    const metrics = [makeMetric({
      multiplier_grids: [grid(0, 100, 1.0), grid(100, 120, 1.4)],
    })];
    const r = calculateVariablePayFromPlan({
      userId: 'u1', planId: 'p1', planName: 'Hunter',
      targetBonusUSD: 20000, proRatedTargetBonusUSD: 20000, proRationFactor: 1,
      metrics,
      metricsActuals: [{ metricId: metrics[0].id, metricName: 'New Software Booking ARR', targetValue: 1000000, actualValue: 1100000 }],
    });
    expect(r.totalPayoutUSD).toBeCloseTo(22800, 0);
  });
});

// ============= SECTION 10: Edge Cases =============

describe('Section 10: Edge Cases', () => {
  it('10.1: Zero target → $0', () => {
    const m = makeMetric({ logic_type: 'Linear', multiplier_grids: [] });
    const r = calculateMetricPayoutFromPlan(m, 0, 500000, 10000);
    expect(r.achievementPercent).toBe(0);
    expect(r.payout).toBe(0);
  });
});
