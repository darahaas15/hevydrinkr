import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateWeeklyStreak, calculateDailyStreak } from './streaks';
import { makeSession } from '../../../tests/helpers/factories';

// Mid-March: walking ~12 weeks / ~10 days back crosses from double-digit ISO
// weeks (W11) into single-digit ones (W9, W8…) and from day 15 to day 6 — the
// exact lexical-sort hazard the implementation guards against.
const NOW = new Date('2026-03-15T12:00:00.000Z');
const DAY = 86_400_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const weeksAgo = (i: number) =>
  makeSession({ status: 'completed', startedAt: new Date(NOW.getTime() - i * 7 * DAY).toISOString() });
const daysAgo = (i: number) =>
  makeSession({ status: 'completed', startedAt: new Date(NOW.getTime() - i * DAY).toISOString() });

describe('calculateWeeklyStreak', () => {
  it('returns zeros for no sessions', () => {
    expect(calculateWeeklyStreak([])).toEqual({ currentStreak: 0, longestStreak: 0 });
  });

  it('ignores non-completed sessions', () => {
    const active = [weeksAgo(0), weeksAgo(1)].map((s) => ({ ...s, status: 'active' as const }));
    expect(calculateWeeklyStreak(active)).toEqual({ currentStreak: 0, longestStreak: 0 });
  });

  it('counts 12 consecutive weeks ending this week across the W10 boundary', () => {
    const sessions = Array.from({ length: 12 }, (_, i) => weeksAgo(i));
    expect(calculateWeeklyStreak(sessions)).toEqual({ currentStreak: 12, longestStreak: 12 });
  });

  it('reports current=1 when only this week is recent but a longer run sits in the past', () => {
    const sessions = [weeksAgo(0), weeksAgo(8), weeksAgo(9), weeksAgo(10), weeksAgo(11)];
    expect(calculateWeeklyStreak(sessions)).toEqual({ currentStreak: 1, longestStreak: 4 });
  });

  it('reports current=0 when the most recent week is too old to be current', () => {
    const sessions = [weeksAgo(8), weeksAgo(9), weeksAgo(10), weeksAgo(11)];
    expect(calculateWeeklyStreak(sessions)).toEqual({ currentStreak: 0, longestStreak: 4 });
  });
});

describe('calculateDailyStreak', () => {
  it('returns zeros for no completed sessions', () => {
    expect(calculateDailyStreak([])).toEqual({ currentStreak: 0, longestStreak: 0 });
  });

  it('counts 10 consecutive days ending today across the day-10 boundary', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => daysAgo(i));
    expect(calculateDailyStreak(sessions)).toEqual({ currentStreak: 10, longestStreak: 10 });
  });

  it('separates a short current run from a longer past run', () => {
    const sessions = [daysAgo(0), daysAgo(20), daysAgo(21), daysAgo(22), daysAgo(23), daysAgo(24)];
    expect(calculateDailyStreak(sessions)).toEqual({ currentStreak: 1, longestStreak: 5 });
  });

  it('collapses multiple sessions on the same day into one streak day', () => {
    const sessions = [daysAgo(0), daysAgo(0), daysAgo(1), daysAgo(1)];
    expect(calculateDailyStreak(sessions)).toEqual({ currentStreak: 2, longestStreak: 2 });
  });
});
