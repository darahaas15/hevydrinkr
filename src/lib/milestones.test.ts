import { describe, it, expect } from 'vitest';
import { drinkMilestoneMessage, getMilestoneBadge } from './milestones';
import { makeFeedItem } from '../../tests/helpers/factories';

describe('drinkMilestoneMessage', () => {
  it('cheers every fifth drink up to 30', () => {
    expect(drinkMilestoneMessage(5)).toBe('5 drinks deep!');
    expect(drinkMilestoneMessage(10)).toBe('Double digits!');
    expect(drinkMilestoneMessage(30)).toBe('Legend status!');
  });

  it('is silent on every other count', () => {
    expect(drinkMilestoneMessage(1)).toBeNull();
    expect(drinkMilestoneMessage(6)).toBeNull();
    expect(drinkMilestoneMessage(35)).toBeNull();
  });
});

describe('getMilestoneBadge', () => {
  it("badges a user's 10th session post, counting only their own posts in date order", () => {
    const mine = Array.from({ length: 10 }, (_, i) =>
      makeFeedItem({ userId: 'me', createdAt: new Date(Date.UTC(2026, 0, i + 1)).toISOString() }),
    );
    const others = [makeFeedItem({ userId: 'someone', createdAt: '2025-12-31T00:00:00.000Z' })];
    const all = [...others, ...mine.slice().reverse()];
    expect(getMilestoneBadge(mine[9], all)).toEqual({ label: '10th Sesh' });
    expect(getMilestoneBadge(mine[8], all)).toBeNull();
  });
});
