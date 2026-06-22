import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  cn,
  generateId,
  formatDuration,
  formatTimeAgo,
  formatNumber,
  calculateStandardDrinks,
  getRelativeDate,
  shuffleArray,
} from './utils';

describe('calculateStandardDrinks', () => {
  it('matches the documented examples (0.789 g/mL, 14 g per standard)', () => {
    expect(calculateStandardDrinks(150, 12)).toBe(1.0);
    expect(calculateStandardDrinks(150, 14)).toBe(1.2);
    expect(calculateStandardDrinks(355, 5)).toBe(1.0);
  });

  it('is zero for zero volume', () => {
    expect(calculateStandardDrinks(0, 40)).toBe(0);
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0m'],
    [45, '45m'],
    [60, '1h'],
    [90, '1h 30m'],
    [125, '2h 5m'],
  ])('formats %i minutes as %s', (mins, expected) => {
    expect(formatDuration(mins)).toBe(expected);
  });
});

describe('formatNumber', () => {
  it('formats sub-thousands with the requested precision', () => {
    expect(formatNumber(500)).toBe('500.0');
    expect(formatNumber(5, 0)).toBe('5');
  });
  it('abbreviates thousands with a k suffix', () => {
    expect(formatNumber(1500)).toBe('1.5k');
    expect(formatNumber(2500, 2)).toBe('2.50k');
  });
});

describe('formatTimeAgo', () => {
  const NOW = new Date('2026-03-15T12:00:00.000Z');
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('buckets recent times', () => {
    const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
    expect(formatTimeAgo(ago(30_000))).toBe('just now');
    expect(formatTimeAgo(ago(5 * 60_000))).toBe('5m ago');
    expect(formatTimeAgo(ago(3 * 3_600_000))).toBe('3h ago');
    expect(formatTimeAgo(ago(2 * 86_400_000))).toBe('2d ago');
  });

  it('falls back to an absolute date beyond a week', () => {
    const tenDaysAgo = new Date(NOW.getTime() - 10 * 86_400_000).toISOString();
    expect(formatTimeAgo(tenDaysAgo)).toBe('Mar 5');
  });
});

describe('small helpers', () => {
  it('cn joins truthy class names only', () => {
    expect(cn('a', false, 'b', null, undefined, 'c')).toBe('a b c');
  });

  it('getRelativeDate subtracts whole days from now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00.000Z'));
    expect(getRelativeDate(3)).toBe('2026-03-12T12:00:00.000Z');
    vi.useRealTimers();
  });

  it('generateId returns distinct non-empty strings', () => {
    const a = generateId();
    const b = generateId();
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it('shuffleArray preserves elements and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffleArray(input);
    expect(out).toHaveLength(5);
    expect([...out].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});
