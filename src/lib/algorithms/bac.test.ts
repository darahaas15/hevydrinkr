import { describe, it, expect } from 'vitest';
import { calculateBac, getSafetyColor } from './bac';
import { BAC_COLORS, BAC_LEGAL_LIMIT } from '@/lib/constants';
import type { DrinkEntry } from '@/types';

// Fixed clock so every BAC assertion is deterministic. All drink timestamps in
// these tests are expressed as offsets from this instant.
const NOW = new Date('2026-05-30T22:00:00.000Z').getTime();
const HOUR = 3_600_000;

function drink(overrides: Partial<DrinkEntry> = {}): DrinkEntry {
  return {
    id: 'd1',
    drinkDefinitionId: 'def-beer',
    drinkName: 'Beer',
    emoji: '🍺',
    category: 'beer',
    abvPercent: 5,
    volumeMl: 355,
    standardDrinks: 1,
    timestamp: new Date(NOW).toISOString(),
    roundId: null,
    notes: '',
    ...overrides,
  };
}

// One 355mL @ 5% beer fully absorbed (≥30 min ago) for a 70kg male:
//   alcoholGrams = 355 * 0.05 * 0.789                = 14.00475 g
//   fullBac      = 14.00475 / (70000 * 0.68) * 100   = 0.0294218
//   minus elimination 0.015/hr over hoursSinceFirst
const MALE = { weightKg: 70, gender: 'male' };

describe('calculateBac', () => {
  it('returns all-zero with no drinks', () => {
    const r = calculateBac([], MALE, NOW);
    expect(r.currentBac).toBe(0);
    expect(r.peakBac).toBe(0);
    expect(r.safetyLevel).toBe('sober');
    expect(r.hoursUntilSober).toBe(0);
    expect(r.hoursUntilDriveSafe).toBe(0);
  });

  it('is zero at the instant the drink is logged (no absorption yet)', () => {
    const r = calculateBac([drink({ timestamp: new Date(NOW).toISOString() })], MALE, NOW);
    expect(r.currentBac).toBe(0);
  });

  it('applies the Widmark formula once fully absorbed (30 min in)', () => {
    const r = calculateBac(
      [drink({ timestamp: new Date(NOW - 0.5 * HOUR).toISOString() })],
      MALE,
      NOW,
    );
    // absorbed 0.0294218 minus 0.015 * 0.5h elimination = 0.0219218
    expect(r.currentBac).toBeCloseTo(0.021922, 5);
    expect(r.safetyLevel).toBe('sober');
  });

  it('absorbs linearly across the 30-minute window', () => {
    const r = calculateBac(
      [drink({ timestamp: new Date(NOW - 0.25 * HOUR).toISOString() })],
      MALE,
      NOW,
    );
    // half-absorbed: 0.0294218 * 0.5 - 0.015 * 0.25 = 0.0109609
    expect(r.currentBac).toBeCloseTo(0.010961, 5);
  });

  it('eliminates at 0.015/hr, and peak exceeds current after the peak passes', () => {
    const r = calculateBac(
      [drink({ timestamp: new Date(NOW - 1 * HOUR).toISOString() })],
      MALE,
      NOW,
    );
    // current @1h: 0.0294218 - 0.015 = 0.0144218
    expect(r.currentBac).toBeCloseTo(0.014422, 5);
    // peak @ (drink + 0.5h): 0.0294218 - 0.0075 = 0.0219218
    expect(r.peakBac).toBeCloseTo(0.021922, 5);
    expect(r.peakBac).toBeGreaterThan(r.currentBac);
  });

  it('uses a lower distribution ratio for women → higher BAC than men', () => {
    const ts = new Date(NOW - 0.5 * HOUR).toISOString();
    const male = calculateBac([drink({ timestamp: ts })], { weightKg: 70, gender: 'male' }, NOW);
    const female = calculateBac([drink({ timestamp: ts })], { weightKg: 70, gender: 'female' }, NOW);
    expect(female.currentBac).toBeGreaterThan(male.currentBac);
    // female r=0.55: 14.00475/(70000*0.55)*100 - 0.0075 = 0.028876
    expect(female.currentBac).toBeCloseTo(0.028876, 5);
  });

  it('falls back to r=0.615 for unrecognized gender', () => {
    const ts = new Date(NOW - 0.5 * HOUR).toISOString();
    const unknown = calculateBac([drink({ timestamp: ts })], { weightKg: 70, gender: 'xyz' }, NOW);
    const other = calculateBac([drink({ timestamp: ts })], { weightKg: 70, gender: 'other' }, NOW);
    expect(unknown.currentBac).toBeCloseTo(other.currentBac, 10);
  });

  it('falls back to 70kg for non-positive or non-finite weight', () => {
    const ts = new Date(NOW - 0.5 * HOUR).toISOString();
    const ref = calculateBac([drink({ timestamp: ts })], { weightKg: 70, gender: 'male' }, NOW);
    for (const bad of [0, -5, NaN]) {
      const r = calculateBac([drink({ timestamp: ts })], { weightKg: bad, gender: 'male' }, NOW);
      expect(r.currentBac).toBeCloseTo(ref.currentBac, 10);
    }
  });

  it('ignores drinks timestamped in the future', () => {
    const r = calculateBac(
      [drink({ timestamp: new Date(NOW + 2 * HOUR).toISOString() })],
      MALE,
      NOW,
    );
    expect(r.currentBac).toBe(0);
    expect(r.peakBac).toBe(0);
  });

  it('climbs into an impaired safety level with enough drinks', () => {
    const ts = new Date(NOW - 0.5 * HOUR).toISOString();
    const drinks = Array.from({ length: 8 }, (_, i) =>
      drink({ id: `d${i}`, timestamp: ts }),
    );
    const r = calculateBac(drinks, MALE, NOW);
    expect(r.currentBac).toBeGreaterThan(BAC_LEGAL_LIMIT);
    expect(r.safetyLevel).not.toBe('sober');
    // above the legal limit → there is a positive wait before it's safe to drive
    expect(r.hoursUntilDriveSafe).toBeGreaterThan(0);
    // hoursUntilSober is currentBac / 0.015
    expect(r.hoursUntilSober).toBeCloseTo(r.currentBac / 0.015, 6);
  });

  it('reports no drive-safe wait when under the legal limit', () => {
    const r = calculateBac(
      [drink({ timestamp: new Date(NOW - 0.5 * HOUR).toISOString() })],
      MALE,
      NOW,
    );
    expect(r.currentBac).toBeLessThan(BAC_LEGAL_LIMIT);
    expect(r.hoursUntilDriveSafe).toBe(0);
  });
});

describe('getSafetyColor', () => {
  it('maps every safety level to its constant color', () => {
    expect(getSafetyColor('sober')).toBe(BAC_COLORS.SOBER);
    expect(getSafetyColor('buzzed')).toBe(BAC_COLORS.BUZZED);
    expect(getSafetyColor('tipsy')).toBe(BAC_COLORS.TIPSY);
    expect(getSafetyColor('drunk')).toBe(BAC_COLORS.DRUNK);
    expect(getSafetyColor('wasted')).toBe(BAC_COLORS.WASTED);
  });
});
