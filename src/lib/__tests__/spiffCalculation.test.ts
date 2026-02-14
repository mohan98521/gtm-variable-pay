import { describe, it, expect } from 'vitest';
import { calculateSpiffPayout } from '../spiffCalculation';

describe('Section 6: SPIFF Calculations', () => {
  it('Test 6.1: Farmer Large Deal SPIFF qualifies → $1,500', () => {
    const result = calculateSpiffPayout(
      {
        id: 's1',
        spiff_name: 'Large Deal SPIFF',
        linked_metric_name: 'New Software Booking ARR',
        spiff_rate_pct: 25,
        min_deal_value_usd: 400000,
        is_active: true,
      },
      [{ id: 'd1', new_software_booking_arr_usd: 500000, project_id: 'p1', customer_name: 'Acme' }],
      [{ metric_name: 'New Software Booking ARR', weightage_percent: 60 }],
      20000, // variableOteUsd
      1000000 // softwareTargetUsd
    );

    // Software Variable OTE = 20000 * 60% = 12000
    // SPIFF = 12000 * (500K/1M) * 25% = 1500
    expect(result.totalSpiffUsd).toBeCloseTo(1500, 0);
  });

  it('Test 6.2: Deal below SPIFF threshold → $0', () => {
    const result = calculateSpiffPayout(
      {
        id: 's1',
        spiff_name: 'Large Deal SPIFF',
        linked_metric_name: 'New Software Booking ARR',
        spiff_rate_pct: 25,
        min_deal_value_usd: 400000,
        is_active: true,
      },
      [{ id: 'd1', new_software_booking_arr_usd: 350000, project_id: 'p1', customer_name: 'Acme' }],
      [{ metric_name: 'New Software Booking ARR', weightage_percent: 60 }],
      20000,
      1000000
    );

    expect(result.totalSpiffUsd).toBe(0);
  });

  it('Test 6.3: Hunter SPIFF no min threshold → $1,000', () => {
    const result = calculateSpiffPayout(
      {
        id: 's1',
        spiff_name: 'Large Deal SPIFF',
        linked_metric_name: 'New Software Booking ARR',
        spiff_rate_pct: 25,
        min_deal_value_usd: null, // no threshold
        is_active: true,
      },
      [{ id: 'd1', new_software_booking_arr_usd: 200000, project_id: 'p1', customer_name: 'Acme' }],
      [{ metric_name: 'New Software Booking ARR', weightage_percent: 100 }],
      20000,
      1000000
    );

    // Software Variable OTE = 20000 * 100% = 20000
    // SPIFF = 20000 * (200K/1M) * 25% = 1000
    expect(result.totalSpiffUsd).toBeCloseTo(1000, 0);
  });
});
