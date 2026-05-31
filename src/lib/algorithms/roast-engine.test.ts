import { describe, it, expect } from 'vitest';
import { computeWeeklyAwards, type MemberWeekData } from './roast-engine';
import { makeFeedItem } from '../../../tests/helpers/factories';

const WEEK = '2026-W11';

type SummaryOver = Partial<import('@/types/feed').FeedItem['sessionSummary']>;

function post(userId: string, createdAt: string, summary: SummaryOver = {}) {
  return makeFeedItem({ userId, createdAt, sessionSummary: summary });
}

function member(userId: string, posts: MemberWeekData['posts']): MemberWeekData {
  return { userId, userName: userId.toUpperCase(), userAvatar: null, posts };
}

function countByUser(awards: { userId: string }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of awards) m.set(a.userId, (m.get(a.userId) ?? 0) + 1);
  return m;
}

describe('computeWeeklyAwards', () => {
  it('gives a Ghost to a member with zero sessions', () => {
    const members = [member('a', [post('a', '2026-03-10T20:00:00.000Z')]), member('b', [])];
    const { awards, summary } = computeWeeklyAwards(members, WEEK);
    expect(awards).toHaveLength(1);
    expect(awards[0].awardType).toBe('ghost');
    expect(awards[0].userId).toBe('b');
    expect(summary.memberCount).toBe(2);
    expect(summary.participatingMemberCount).toBe(1);
  });

  it('needs at least two active members for comparative awards', () => {
    const members = [member('a', [post('a', '2026-03-10T20:00:00.000Z', { totalStandardDrinks: 9 })])];
    const { awards } = computeWeeklyAwards(members, WEEK);
    expect(awards.find((x) => x.awardType === 'freight_train')).toBeUndefined();
  });

  it('assigns Freight Train to the biggest drinker and Lightweight to the smallest', () => {
    const members = [
      member('a', [post('a', '2026-03-10T20:00:00.000Z', { totalStandardDrinks: 20, totalDrinks: 2 })]),
      member('b', [post('b', '2026-03-10T20:00:00.000Z', { totalStandardDrinks: 1, totalDrinks: 1 })]),
    ];
    const { awards } = computeWeeklyAwards(members, WEEK);
    expect(awards.find((x) => x.awardType === 'freight_train')!.userId).toBe('a');
    expect(awards.find((x) => x.awardType === 'lightweight')!.userId).toBe('b');
  });

  it('caps any single member at two awards even when they qualify for more', () => {
    const drink = (name: string, category: string) => ({
      name, emoji: '🍸', category, abvPercent: 10, volumeMl: 200, standardDrinks: 5,
    });
    const heavy = member('a', [
      post('a', '2026-03-09T23:30:00.000Z', { totalStandardDrinks: 5, totalDrinks: 5, durationMinutes: 120, drinks: [drink('Beer', 'beer')] }),
      post('a', '2026-03-10T20:00:00.000Z', { totalStandardDrinks: 5, totalDrinks: 5, durationMinutes: 120, drinks: [drink('Wine', 'wine')] }),
      post('a', '2026-03-11T20:00:00.000Z', { totalStandardDrinks: 5, totalDrinks: 5, durationMinutes: 120, drinks: [drink('Whiskey', 'whiskey')] }),
      post('a', '2026-03-12T20:00:00.000Z', { totalStandardDrinks: 5, totalDrinks: 5, durationMinutes: 120, drinks: [drink('Gin', 'gin')] }),
    ]);
    const light = member('b', [post('b', '2026-03-13T20:00:00.000Z', { totalStandardDrinks: 1, totalDrinks: 1, durationMinutes: 30 })]);

    const { awards } = computeWeeklyAwards([heavy, light], WEEK);
    const counts = countByUser(awards);
    expect(counts.get('a')).toBe(2);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
    expect(awards.some((x) => x.userId === 'a' && x.awardType === 'freight_train')).toBe(true);
  });

  it('is fully deterministic (seeded roast lines, no randomness)', () => {
    const members = [
      member('a', [post('a', '2026-03-10T20:00:00.000Z', { totalStandardDrinks: 20 })]),
      member('b', [post('b', '2026-03-10T20:00:00.000Z', { totalStandardDrinks: 1 })]),
    ];
    expect(computeWeeklyAwards(members, WEEK)).toEqual(computeWeeklyAwards(members, WEEK));
  });
});
