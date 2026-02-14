import { describe, it, expect } from 'vitest';
import { calculateBlendedProRata } from '../compensation';

describe('Section 8: Blended Pro-Rata Target', () => {
  it('Test 8.1: Mid-year hike $20K→$24K blended ≈ $22,345', () => {
    const segments = [
      { targetBonusUsd: 20000, startDate: '2025-01-01', endDate: '2025-05-31' },
      { targetBonusUsd: 24000, startDate: '2025-06-01', endDate: '2025-12-31' },
    ];

    // Jan-May: should use original $20,000
    const janResult = calculateBlendedProRata(segments, '2025-03', 2025);
    expect(janResult.effectiveTargetBonusUsd).toBe(20000);
    expect(janResult.isBlended).toBe(false);

    // Jun-Dec: should use blended target
    const junResult = calculateBlendedProRata(segments, '2025-07', 2025);
    expect(junResult.isBlended).toBe(true);
    // Blended = (20000 * 151/365) + (24000 * 214/365) ≈ 22345
    expect(junResult.effectiveTargetBonusUsd).toBeCloseTo(22345, -1); // within ~10
  });

  it('Single assignment → no blending', () => {
    const segments = [
      { targetBonusUsd: 20000, startDate: '2025-01-01', endDate: '2025-12-31' },
    ];
    const result = calculateBlendedProRata(segments, '2025-06', 2025);
    expect(result.isBlended).toBe(false);
    expect(result.effectiveTargetBonusUsd).toBe(20000);
  });
});
