import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  spreadDrinkTimestamps,
  buildSessionSummary,
  isoToLocalInputValue,
  localInputValueToIso,
  validateSessionForm,
  durationMinutesBetween,
  type SessionFormInput,
} from './session-utils';
import { makeSession, makeDrink } from '../../tests/helpers/factories';

describe('spreadDrinkTimestamps', () => {
  it('returns nothing for a non-positive count', () => {
    expect(spreadDrinkTimestamps('2026-03-02T20:00:00.000Z', '2026-03-03T00:00:00.000Z', 0)).toEqual([]);
  });

  it('returns the midpoint for a single drink', () => {
    const out = spreadDrinkTimestamps('2026-03-02T20:00:00.000Z', '2026-03-03T00:00:00.000Z', 1);
    expect(out).toEqual(['2026-03-02T22:00:00.000Z']);
  });

  it('spreads N drinks evenly, pinning the first and last to the bounds', () => {
    const start = '2026-03-02T20:00:00.000Z';
    const end = '2026-03-03T00:00:00.000Z';
    const out = spreadDrinkTimestamps(start, end, 4);
    expect(out).toHaveLength(4);
    expect(out[0]).toBe(start);
    expect(out[3]).toBe(end);
    const gaps = out.slice(1).map((t, i) => new Date(t).getTime() - new Date(out[i]).getTime());
    expect(new Set(gaps).size).toBe(1); // evenly spaced
  });
});

describe('buildSessionSummary', () => {
  it('summarizes drinks and picks the most frequent as the top drink', () => {
    const session = makeSession({
      mood: 'legendary',
      drinks: [
        makeDrink({ drinkName: 'Beer', emoji: '🍺' }),
        makeDrink({ drinkName: 'Beer', emoji: '🍺' }),
        makeDrink({ drinkName: 'Wine', emoji: '🍷' }),
      ],
    });
    const summary = buildSessionSummary(session);
    expect(summary.totalDrinks).toBe(3);
    expect(summary.topDrink).toBe('Beer');
    expect(summary.topDrinkEmoji).toBe('🍺');
    expect(summary.drinkEmojis).toEqual(['🍺', '🍺', '🍷']);
    expect(summary.drinks).toHaveLength(3);
    expect(summary.mood).toBe('legendary');
  });
});

describe('datetime-local round-tripping (TZ=UTC)', () => {
  it('iso → local input value', () => {
    expect(isoToLocalInputValue('2026-03-02T20:05:00.000Z')).toBe('2026-03-02T20:05');
  });

  it('local input value → iso', () => {
    expect(localInputValueToIso('2026-03-02T20:05')).toBe('2026-03-02T20:05:00.000Z');
  });

  it('round-trips both directions', () => {
    const iso = '2026-03-02T20:05:00.000Z';
    expect(localInputValueToIso(isoToLocalInputValue(iso))).toBe(iso);
    const local = '2026-03-02T20:05';
    expect(isoToLocalInputValue(localInputValueToIso(local))).toBe(local);
  });
});

describe('durationMinutesBetween', () => {
  it('rounds the gap to whole minutes', () => {
    expect(durationMinutesBetween('2026-03-02T20:00:00.000Z', '2026-03-02T21:30:00.000Z')).toBe(90);
  });
});

describe('validateSessionForm', () => {
  const NOW = new Date('2026-03-15T12:00:00.000Z');
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const base = (over: Partial<SessionFormInput> = {}): SessionFormInput => ({
    venue: 'The Pub',
    startedAt: new Date(NOW.getTime() - 2 * 3_600_000).toISOString(),
    endedAt: new Date(NOW.getTime() - 1 * 3_600_000).toISOString(),
    drinks: [makeDrink()],
    mood: 'good',
    ...over,
  });

  it('accepts a well-formed session', () => {
    expect(validateSessionForm(base())).toBeNull();
  });

  it('requires a venue', () => {
    expect(validateSessionForm(base({ venue: '   ' }))).toBe('Add a venue');
  });

  it('requires the end to be at least a minute after the start', () => {
    const startedAt = new Date(NOW.getTime() - 3_600_000).toISOString();
    const endedAt = new Date(NOW.getTime() - 3_600_000 + 30_000).toISOString();
    expect(validateSessionForm(base({ startedAt, endedAt }))).toBe(
      'End must be at least 1 minute after start',
    );
  });

  it('rejects a start time in the future', () => {
    const startedAt = new Date(NOW.getTime() + 3_600_000).toISOString();
    const endedAt = new Date(NOW.getTime() + 2 * 3_600_000).toISOString();
    expect(validateSessionForm(base({ startedAt, endedAt }))).toBe('Start time can’t be in the future');
  });

  it('rejects an end time in the future', () => {
    const endedAt = new Date(NOW.getTime() + 3_600_000).toISOString();
    expect(validateSessionForm(base({ endedAt }))).toBe('End time can’t be in the future');
  });

  it('rejects a start older than the 90-day backfill window', () => {
    const startedAt = new Date(NOW.getTime() - 100 * 86_400_000).toISOString();
    const endedAt = new Date(NOW.getTime() - 100 * 86_400_000 + 3_600_000).toISOString();
    expect(validateSessionForm(base({ startedAt, endedAt }))).toBe('Start must be within the last 90 days');
  });

  it('requires at least one drink', () => {
    expect(validateSessionForm(base({ drinks: [] }))).toBe('Add at least one drink');
  });

  it('requires a mood', () => {
    expect(validateSessionForm(base({ mood: null }))).toBe('Pick a mood');
  });
});
