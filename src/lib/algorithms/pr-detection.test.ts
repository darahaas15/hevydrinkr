import { describe, it, expect } from 'vitest';
import { detectPRs } from './pr-detection';
import type { PersonalRecord } from '@/types/pr';
import { makeSession, makeDrink } from '../../../tests/helpers/factories';

function existingPR(over: Partial<PersonalRecord>): PersonalRecord {
  return {
    id: 'pr-1',
    userId: 'user-1',
    category: 'most_drinks_session',
    value: 0,
    formattedValue: '',
    previousValue: null,
    sessionId: 's-old',
    achievedAt: '2026-01-01T00:00:00.000Z',
    celebrated: true,
    ...over,
  };
}

describe('detectPRs', () => {
  it('creates first-time PRs for a session with no prior records', () => {
    const session = makeSession({
      id: 's-1',
      userId: 'user-1',
      durationMinutes: 90,
      totalStandardDrinks: 4.5,
      drinks: [
        makeDrink({ drinkDefinitionId: 'beer', timestamp: '2026-03-02T20:00:00.000Z' }),
        makeDrink({ drinkDefinitionId: 'wine', timestamp: '2026-03-02T20:30:00.000Z' }),
        makeDrink({ drinkDefinitionId: 'beer', timestamp: '2026-03-02T21:15:00.000Z' }),
      ],
    });
    const prs = detectPRs(session, []);
    const byCat = Object.fromEntries(prs.map((p) => [p.category, p]));

    expect(byCat.most_drinks_session.value).toBe(3);
    expect(byCat.most_standard_drinks.value).toBe(4.5);
    expect(byCat.most_standard_drinks.formattedValue).toBe('4.5 std drinks');
    expect(byCat.longest_session.value).toBe(90);
    expect(byCat.most_unique_drinks.value).toBe(2); // beer, wine
    expect(byCat.fastest_drink.value).toBe(30); // min gap 20:00→20:30
    // all are first-time → previousValue null, not yet celebrated
    expect(prs.every((p) => p.previousValue === null)).toBe(true);
    expect(prs.every((p) => p.celebrated === false)).toBe(true);
    expect(prs.every((p) => p.sessionId === 's-1' && p.userId === 'user-1')).toBe(true);
  });

  it('does not emit fastest_drink for a single-drink session', () => {
    const session = makeSession({ drinks: [makeDrink()] });
    const prs = detectPRs(session, []);
    expect(prs.find((p) => p.category === 'fastest_drink')).toBeUndefined();
  });

  it('skips categories whose value is zero or negative', () => {
    const session = makeSession({ drinks: [], totalStandardDrinks: 0, durationMinutes: 0 });
    const prs = detectPRs(session, []);
    expect(prs).toHaveLength(0);
  });

  it('beats an existing higher-is-better record and records previousValue', () => {
    const session = makeSession({
      totalStandardDrinks: 1,
      durationMinutes: 1,
      drinks: [makeDrink()],
    });
    const prs = detectPRs(session, [existingPR({ category: 'most_drinks_session', value: 0 })]);
    const pr = prs.find((p) => p.category === 'most_drinks_session')!;
    expect(pr.value).toBe(1);
    expect(pr.previousValue).toBe(0);
  });

  it('does not beat an existing record that is already higher', () => {
    const session = makeSession({ drinks: [makeDrink(), makeDrink()] }); // 2 drinks
    const prs = detectPRs(session, [existingPR({ category: 'most_drinks_session', value: 10 })]);
    expect(prs.find((p) => p.category === 'most_drinks_session')).toBeUndefined();
  });

  it('treats fastest_drink as lower-is-better', () => {
    const session = makeSession({
      drinks: [
        makeDrink({ timestamp: '2026-03-02T20:00:00.000Z' }),
        makeDrink({ timestamp: '2026-03-02T20:10:00.000Z' }), // 10-min gap
      ],
    });
    // existing best is a 30-min gap; 10 < 30 → new PR
    const beats = detectPRs(session, [existingPR({ category: 'fastest_drink', value: 30 })]);
    expect(beats.find((p) => p.category === 'fastest_drink')!.value).toBe(10);

    // existing best is a 5-min gap; 10 > 5 → no PR
    const noBeat = detectPRs(session, [existingPR({ category: 'fastest_drink', value: 5 })]);
    expect(noBeat.find((p) => p.category === 'fastest_drink')).toBeUndefined();
  });

  it('only compares against PRs for the same user', () => {
    const session = makeSession({ userId: 'user-1', drinks: [makeDrink()] });
    // a higher record but belonging to a different user must be ignored
    const prs = detectPRs(session, [
      existingPR({ category: 'most_drinks_session', value: 10, userId: 'someone-else' }),
    ]);
    expect(prs.find((p) => p.category === 'most_drinks_session')!.value).toBe(1);
  });
});
