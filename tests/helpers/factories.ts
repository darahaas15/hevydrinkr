import type { DrinkEntry, DrinkSession, FeedItem, UserProfile } from '@/types';

// Test fixtures. Every factory returns a fully-valid object with sensible
// defaults; pass overrides for the fields a given test actually cares about.
// `makeFeedItem` deep-merges `sessionSummary` so callers can override just the
// summary fields the algorithm under test reads.

let seq = 0;
const nextId = () => `id-${++seq}`;

export function makeDrink(overrides: Partial<DrinkEntry> = {}): DrinkEntry {
  return {
    id: nextId(),
    drinkDefinitionId: 'def-beer',
    drinkName: 'Beer',
    emoji: '🍺',
    category: 'beer',
    abvPercent: 5,
    volumeMl: 355,
    standardDrinks: 1,
    timestamp: '2026-03-02T20:00:00.000Z',
    roundId: null,
    notes: '',
    ...overrides,
  };
}

export function makeSession(overrides: Partial<DrinkSession> = {}): DrinkSession {
  return {
    id: nextId(),
    userId: 'user-1',
    status: 'completed',
    startedAt: '2026-03-02T20:00:00.000Z',
    endedAt: '2026-03-02T22:00:00.000Z',
    venue: 'The Pub',
    drinks: [],
    rounds: [],
    totalStandardDrinks: 0,
    totalVolumeMl: 0,
    peakBacEstimate: 0,
    durationMinutes: 120,
    isPartyMode: false,
    partyId: null,
    prsAchieved: [],
    mood: 'good',
    notes: '',
    photos: [],
    ...overrides,
  };
}

type SessionSummary = FeedItem['sessionSummary'];

export function makeFeedItem(
  overrides: Partial<Omit<FeedItem, 'sessionSummary'>> & {
    sessionSummary?: Partial<SessionSummary>;
  } = {},
): FeedItem {
  const { sessionSummary, ...rest } = overrides;
  const summary: SessionSummary = {
    venue: 'The Pub',
    totalDrinks: 1,
    totalStandardDrinks: 1,
    durationMinutes: 120,
    topDrink: 'Beer',
    topDrinkEmoji: '🍺',
    drinkEmojis: ['🍺'],
    drinks: [{ name: 'Beer', emoji: '🍺', category: 'beer', abvPercent: 5, volumeMl: 355, standardDrinks: 1 }],
    mood: 'good',
    prsAchieved: [],
    ...sessionSummary,
  };
  return {
    id: nextId(),
    userId: 'user-1',
    userName: 'Alice',
    userAvatar: null,
    sessionId: 'session-1',
    sessionSummary: summary,
    photos: [],
    caption: '',
    taggedUserIds: [],
    likes: [],
    likeCount: 0,
    currentUserLikeId: null,
    comments: [],
    commentCount: 0,
    createdAt: '2026-03-02T20:00:00.000Z',
    isBackfilled: false,
    ...rest,
  };
}

export function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
    bio: '',
    gender: 'other',
    weightKg: 70,
    heightCm: null,
    joinedAt: '2026-01-01T00:00:00.000Z',
    isDemo: false,
    isPrivate: false,
    followers: [],
    following: [],
    ...overrides,
  };
}
