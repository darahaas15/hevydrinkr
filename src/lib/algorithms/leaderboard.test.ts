import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildLeaderboard } from './leaderboard';
import { makeFeedItem, makeUser } from '../../../tests/helpers/factories';

const NOW = new Date('2026-03-15T12:00:00.000Z');
const DAY = 86_400_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const alice = makeUser({ id: 'a', displayName: 'Alice' });
const bob = makeUser({ id: 'b', displayName: 'Bob' });
const users = [alice, bob];

describe('buildLeaderboard', () => {
  it('sums total standard drinks per user and ranks descending', () => {
    const posts = [
      makeFeedItem({ userId: 'a', sessionSummary: { totalStandardDrinks: 3 } }),
      makeFeedItem({ userId: 'a', sessionSummary: { totalStandardDrinks: 2 } }),
      makeFeedItem({ userId: 'b', sessionSummary: { totalStandardDrinks: 4 } }),
    ];
    const board = buildLeaderboard(posts, users, 'total_standard_drinks', 'all-time');
    expect(board.map((e) => [e.userId, e.value, e.rank])).toEqual([
      ['a', 5, 1],
      ['b', 4, 2],
    ]);
    expect(board[0].formattedValue).toBe('5.0 drinks');
  });

  it('counts sessions for total_sessions', () => {
    const posts = [
      makeFeedItem({ userId: 'a' }),
      makeFeedItem({ userId: 'a' }),
      makeFeedItem({ userId: 'b' }),
    ];
    const board = buildLeaderboard(posts, users, 'total_sessions', 'all-time');
    expect(board.find((e) => e.userId === 'a')!.value).toBe(2);
    expect(board.find((e) => e.userId === 'a')!.formattedValue).toBe('2 sessions');
  });

  it('takes the max duration for longest_session and formats h/m', () => {
    const posts = [
      makeFeedItem({ userId: 'a', sessionSummary: { durationMinutes: 45 } }),
      makeFeedItem({ userId: 'a', sessionSummary: { durationMinutes: 125 } }),
    ];
    const board = buildLeaderboard(posts, users, 'longest_session', 'all-time');
    const a = board.find((e) => e.userId === 'a')!;
    expect(a.value).toBe(125);
    expect(a.formattedValue).toBe('2h 5m');
  });

  it('counts distinct drink names across a user for most_diverse', () => {
    const posts = [
      makeFeedItem({
        userId: 'a',
        sessionSummary: {
          drinks: [
            { name: 'Beer', emoji: '🍺', category: 'beer', abvPercent: 5, volumeMl: 355, standardDrinks: 1 },
            { name: 'Wine', emoji: '🍷', category: 'wine', abvPercent: 12, volumeMl: 150, standardDrinks: 1 },
          ],
        },
      }),
      makeFeedItem({
        userId: 'a',
        sessionSummary: {
          drinks: [
            { name: 'Beer', emoji: '🍺', category: 'beer', abvPercent: 5, volumeMl: 355, standardDrinks: 1 },
            { name: 'Gin', emoji: '🍸', category: 'gin', abvPercent: 40, volumeMl: 30, standardDrinks: 1 },
          ],
        },
      }),
    ];
    const board = buildLeaderboard(posts, users, 'most_diverse', 'all-time');
    const a = board.find((e) => e.userId === 'a')!;
    expect(a.value).toBe(3); // Beer, Wine, Gin
    expect(a.formattedValue).toBe('3 types');
  });

  it('takes the single largest session for single_session', () => {
    const posts = [
      makeFeedItem({ userId: 'a', sessionSummary: { totalDrinks: 6 } }),
      makeFeedItem({ userId: 'a', sessionSummary: { totalDrinks: 9 } }),
    ];
    const board = buildLeaderboard(posts, users, 'single_session', 'all-time');
    expect(board.find((e) => e.userId === 'a')!.value).toBe(9);
  });

  it('filters out posts older than the timeframe window', () => {
    const posts = [
      makeFeedItem({ userId: 'a', createdAt: NOW.toISOString(), sessionSummary: { totalStandardDrinks: 3 } }),
      // 10 days ago — inside month, outside week
      makeFeedItem({
        userId: 'a',
        createdAt: new Date(NOW.getTime() - 10 * DAY).toISOString(),
        sessionSummary: { totalStandardDrinks: 100 },
      }),
    ];
    const week = buildLeaderboard(posts, users, 'total_standard_drinks', 'week');
    const month = buildLeaderboard(posts, users, 'total_standard_drinks', 'month');
    expect(week.find((e) => e.userId === 'a')!.value).toBe(3);
    expect(month.find((e) => e.userId === 'a')!.value).toBe(103);
  });

  it('gives tied users the same rank', () => {
    const posts = [
      makeFeedItem({ userId: 'a', sessionSummary: { totalStandardDrinks: 5 } }),
      makeFeedItem({ userId: 'b', sessionSummary: { totalStandardDrinks: 5 } }),
    ];
    const board = buildLeaderboard(posts, users, 'total_standard_drinks', 'all-time');
    expect(board[0].rank).toBe(1);
    expect(board[1].rank).toBe(1);
  });

  it('includes users with no posts at value 0', () => {
    const posts = [makeFeedItem({ userId: 'a', sessionSummary: { totalStandardDrinks: 5 } })];
    const board = buildLeaderboard(posts, users, 'total_standard_drinks', 'all-time');
    const b = board.find((e) => e.userId === 'b')!;
    expect(b.value).toBe(0);
    expect(b.rank).toBe(2);
  });

  describe('total_spend', () => {
    it('sums recorded session cost and formats in the given currency', () => {
      const posts = [
        makeFeedItem({ userId: 'a', sessionSummary: { totalCost: 1200 } }),
        makeFeedItem({ userId: 'a', sessionSummary: { totalCost: 800.5 } }),
        makeFeedItem({ userId: 'b', sessionSummary: { totalCost: 1500 } }),
      ];
      const board = buildLeaderboard(posts, users, 'total_spend', 'all-time', 'INR');
      const a = board.find((e) => e.userId === 'a')!;
      expect(a.value).toBe(2000.5);
      expect(a.formattedValue).toBe('₹2,000.50');
      expect(a.rank).toBe(1);
    });

    it('defaults to the app default currency when none is passed', () => {
      const posts = [makeFeedItem({ userId: 'a', sessionSummary: { totalCost: 500 } })];
      const board = buildLeaderboard(posts, users, 'total_spend', 'all-time');
      expect(board.find((e) => e.userId === 'a')!.formattedValue).toBe('₹500');
    });

    it('treats posts without cost as 0 rather than dropping the user', () => {
      const posts = [
        makeFeedItem({ userId: 'a', sessionSummary: { totalCost: 300 } }),
        // Predates cost tracking: no totalCost key at all.
        makeFeedItem({ userId: 'a' }),
      ];
      const board = buildLeaderboard(posts, users, 'total_spend', 'all-time');
      expect(board.find((e) => e.userId === 'a')!.value).toBe(300);
      expect(board.find((e) => e.userId === 'b')!.value).toBe(0);
    });

    it('avoids float drift when summing', () => {
      const posts = [
        makeFeedItem({ userId: 'a', sessionSummary: { totalCost: 0.1 } }),
        makeFeedItem({ userId: 'a', sessionSummary: { totalCost: 0.2 } }),
      ];
      const board = buildLeaderboard(posts, users, 'total_spend', 'all-time');
      expect(board.find((e) => e.userId === 'a')!.value).toBe(0.3);
    });
  });
});
