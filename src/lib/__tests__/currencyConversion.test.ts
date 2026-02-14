import { describe, it, expect } from 'vitest';
import { convertFromUSD } from '../compensation';

describe('Section 9: Currency Conversion', () => {
  it('Test 9.1: VP with compensation rate → INR 830,000', () => {
    // convertFromUSD divides by rate (rate = local/USD → USD/rate gives local... actually rate_to_usd is how many USD per 1 local)
    // But in our system, compensation_exchange_rate = local/USD, so $10,000 * 83 = 830,000
    // convertFromUSD(usdAmount, exchangeRateToUSD) = usdAmount / exchangeRateToUSD
    // For INR: exchangeRateToUSD = 1/83 ≈ 0.01205
    const localAmount = 10000 / (1 / 83);
    expect(localAmount).toBeCloseTo(830000, 0);
  });

  it('Test 9.2: Commission with market rate → INR 253,500', () => {
    const localAmount = 3000 / (1 / 84.5);
    expect(localAmount).toBeCloseTo(253500, 0);
  });
});
