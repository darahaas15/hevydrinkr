import { describe, it, expect } from 'vitest';
import {
  parseCost,
  formatCost,
  sumCosts,
  currencySymbol,
  MAX_DRINK_COST,
} from './money';

describe('parseCost', () => {
  it('parses a plain number', () => {
    expect(parseCost('250')).toBe(250);
  });

  it('parses decimals and rounds to 2dp', () => {
    expect(parseCost('12.5')).toBe(12.5);
    expect(parseCost('12.567')).toBe(12.57);
  });

  it('strips currency symbols, spaces, and thousands separators', () => {
    expect(parseCost('₹1,250')).toBe(1250);
    expect(parseCost('$ 40')).toBe(40);
  });

  it('returns null for empty or symbol-only input', () => {
    expect(parseCost('')).toBeNull();
    expect(parseCost('   ')).toBeNull();
    expect(parseCost('₹')).toBeNull();
  });

  it('treats zero as a real recorded price, not "unset"', () => {
    expect(parseCost('0')).toBe(0);
  });

  it('rejects values above the sanity ceiling', () => {
    expect(parseCost(String(MAX_DRINK_COST + 1))).toBeNull();
    expect(parseCost(String(MAX_DRINK_COST))).toBe(MAX_DRINK_COST);
  });

  it('rejects a lone decimal point', () => {
    expect(parseCost('.')).toBeNull();
  });
});

describe('formatCost', () => {
  it('drops decimals for whole amounts', () => {
    expect(formatCost(250, 'INR')).toBe('₹250');
  });

  it('keeps two decimals for fractional amounts', () => {
    expect(formatCost(12.5, 'USD')).toBe('$12.50');
  });

  it('groups thousands', () => {
    expect(formatCost(12500, 'INR')).toBe('₹12,500');
  });

  it('groups thousands for fractional amounts too', () => {
    expect(formatCost(2000.5, 'INR')).toBe('₹2,000.50');
  });

  it('falls back to the rupee symbol for an unknown currency code', () => {
    expect(formatCost(10, 'ZZZ')).toBe('₹10');
  });
});

describe('currencySymbol', () => {
  it('maps known codes', () => {
    expect(currencySymbol('GBP')).toBe('£');
    expect(currencySymbol('AUD')).toBe('A$');
  });
});

describe('sumCosts', () => {
  it('returns null when no drink has a price', () => {
    expect(sumCosts([{ cost: null }, {}, { cost: undefined }])).toBeNull();
  });

  it('sums only the priced drinks', () => {
    expect(sumCosts([{ cost: 250 }, { cost: null }, { cost: 100 }])).toBe(350);
  });

  it('returns 0 (not null) when the only prices recorded are zero', () => {
    expect(sumCosts([{ cost: 0 }])).toBe(0);
  });

  it('avoids float drift', () => {
    expect(sumCosts([{ cost: 0.1 }, { cost: 0.2 }])).toBe(0.3);
  });

  it('ignores non-finite values', () => {
    expect(sumCosts([{ cost: Number.NaN }, { cost: 5 }])).toBe(5);
  });
});
