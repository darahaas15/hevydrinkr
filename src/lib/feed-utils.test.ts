import { describe, it, expect } from 'vitest';
import { discoverableUsers, feedForTab, feedShareText, likeStateFor, searchFeedPosts } from './feed-utils';
import { makeFeedItem, makeUser } from '../../tests/helpers/factories';

const me = 'me';
const friend = 'friend';
const stranger = 'stranger';
const blocked = 'blocked';

const audience = { followingIds: [friend, blocked], blockedUserIds: [blocked], currentUserId: me };

describe('feedForTab', () => {
  const mine = makeFeedItem({ userId: me, createdAt: '2026-03-01T00:00:00.000Z' });
  const friends = makeFeedItem({ userId: friend, createdAt: '2026-03-03T00:00:00.000Z' });
  const strangers = makeFeedItem({ userId: stranger, createdAt: '2026-03-02T00:00:00.000Z' });
  const blockeds = makeFeedItem({ userId: blocked, createdAt: '2026-03-04T00:00:00.000Z' });
  const items = [mine, friends, strangers, blockeds];

  it('Home shows you and the people you follow, newest first, never blocked users', () => {
    expect(feedForTab(items, 'home', audience)).toEqual([friends, mine]);
  });

  it('Discover shows everyone else, never blocked users', () => {
    expect(feedForTab(items, 'discover', audience)).toEqual([strangers]);
  });
});

describe('discoverableUsers', () => {
  it('suggests people who are not you, followed, or blocked', () => {
    const users = [me, friend, stranger, blocked].map((id) => makeUser({ id }));
    expect(discoverableUsers(users, audience).map((u) => u.id)).toEqual([stranger]);
  });
});

describe('searchFeedPosts', () => {
  const items = [
    makeFeedItem({ userId: stranger, userName: 'Bob', caption: 'Friday!', sessionSummary: { venue: 'Toit' } }),
    makeFeedItem({ userId: me, userName: 'Me', caption: 'toit again', sessionSummary: { venue: 'Toit' } }),
  ];

  it('matches name, caption or venue case-insensitively, skipping your own posts', () => {
    expect(searchFeedPosts(items, 'TOIT', me)).toEqual([items[0]]);
    expect(searchFeedPosts(items, 'bob', me)).toEqual([items[0]]);
    expect(searchFeedPosts(items, 'friday', me)).toEqual([items[0]]);
    expect(searchFeedPosts(items, 'nothing', me)).toEqual([]);
  });
});

describe('likeStateFor', () => {
  it('reads the viewer like from the populated likes array', () => {
    const item = makeFeedItem({
      likes: [{ id: 'like-1', userId: me, userName: 'Me', createdAt: '2026-03-01T00:00:00.000Z' }],
      likeCount: 1,
    });
    expect(likeStateFor(item, me)).toEqual({ isLiked: true, likeId: 'like-1' });
    expect(likeStateFor(item, friend)).toEqual({ isLiked: false, likeId: null });
  });

  it('falls back to the cached like id while the likes array is not loaded', () => {
    const item = makeFeedItem({ likes: [], likeCount: 3, currentUserLikeId: 'like-9' });
    expect(likeStateFor(item, me)).toEqual({ isLiked: true, likeId: 'like-9' });
  });
});

describe('feedShareText', () => {
  it('names the poster, drink count and venue', () => {
    const item = makeFeedItem({ userName: 'Alice', sessionSummary: { totalDrinks: 6, venue: 'Toit' } });
    expect(feedShareText(item)).toBe('Alice had 6 drinks at Toit');
  });
});
