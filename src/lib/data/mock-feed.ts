import type { FeedItem, FeedLike, FeedComment } from '@/types';
import { MOCK_SESSIONS } from './mock-sessions';
import { MOCK_USERS } from './mock-users';
import { generateId } from '@/lib/utils';

const CAPTIONS = [
  'Epic night at {venue}!',
  'Casual drinks with the crew',
  'This one got wild',
  'Wine night was exactly what I needed',
  "Who's ready for round 2?",
  '{venue} never disappoints',
  'Started slow, ended legendary',
  'Tuesday drinks hit different',
  'Best night out in a while',
  'We might have gone too hard',
  'Recovery mode activated',
  'Lost count after drink 4',
  "When did we leave {venue}?",
  'No regrets. Maybe a few.',
];

const COMMENT_TEXTS = [
  "You're a legend",
  'How are you alive??',
  'Save some for the rest of us',
  "Next time I'm coming",
  'The margaritas were fire',
  'Absolute scenes',
  "I'm jealous",
  'Teach me your ways',
  'Lightweight lol',
  'We need a rematch',
  'RIP tomorrow morning',
  'I was there, can confirm',
  'Best night ever',
  'You owe me a drink',
];

function getUserById(userId: string) {
  return MOCK_USERS.find((u) => u.id === userId)!;
}

/** Deterministic but varied pick based on a seed index. */
function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function makeLikes(seed: number, count: number): FeedLike[] {
  const likes: FeedLike[] = [];
  const usedUserIds = new Set<string>();
  for (let i = 0; i < count; i++) {
    const user = pick(MOCK_USERS, seed + i * 3);
    if (usedUserIds.has(user.id)) continue;
    usedUserIds.add(user.id);
    likes.push({
      id: generateId(),
      userId: user.id,
      userName: user.displayName,
      createdAt: new Date(Date.now() - (seed + i) * 3600000).toISOString(),
    });
  }
  return likes;
}

function makeComments(
  seed: number,
  count: number,
  excludeUserId: string,
): FeedComment[] {
  const comments: FeedComment[] = [];
  const available = MOCK_USERS.filter((u) => u.id !== excludeUserId);
  for (let i = 0; i < count; i++) {
    const user = pick(available, seed + i * 5);
    comments.push({
      id: generateId(),
      userId: user.id,
      userName: user.displayName,
      userAvatar: user.avatarUrl,
      text: pick(COMMENT_TEXTS, seed + i * 11),
      parentCommentId: null,
      likes: [],
      replies: [],
      createdAt: new Date(Date.now() - (seed + i) * 1800000).toISOString(),
    });
  }
  return comments;
}

function topDrinkFromSession(
  session: typeof MOCK_SESSIONS[number],
): { name: string; emoji: string } {
  const freq: Record<string, { count: number; name: string; emoji: string }> = {};
  for (const drink of session.drinks) {
    if (!freq[drink.drinkDefinitionId]) {
      freq[drink.drinkDefinitionId] = { count: 0, name: drink.drinkName, emoji: drink.emoji };
    }
    freq[drink.drinkDefinitionId].count++;
  }
  let best = { name: session.drinks[0].drinkName, emoji: session.drinks[0].emoji, count: 0 };
  for (const v of Object.values(freq)) {
    if (v.count > best.count) best = v;
  }
  return { name: best.name, emoji: best.emoji };
}

// ── Build feed ──────────────────────────────────────────────

const DEMO_USER_ID = 'demo-user-001';

// Include sessions from non-demo users + a few demo user sessions
const feedSessions = MOCK_SESSIONS.filter((s) => {
  if (s.userId !== DEMO_USER_ID) return true;
  // Include only a few of the demo user sessions in the feed
  // (the first 3 so they appear but don't dominate)
  const demoSessions = MOCK_SESSIONS.filter((ms) => ms.userId === DEMO_USER_ID);
  const idx = demoSessions.indexOf(s);
  return idx >= 0 && idx < 3;
});

export const MOCK_FEED: FeedItem[] = feedSessions
  .map((session, i) => {
    const user = getUserById(session.userId);
    const top = topDrinkFromSession(session);
    const caption = pick(CAPTIONS, i * 13).replace('{venue}', session.venue);
    const likeCount = (i * 3 + 2) % 6; // 0-5
    const commentCount = (i * 5 + 1) % 4; // 0-3
    const likes = makeLikes(i * 17, likeCount);
    const comments = makeComments(i * 23, commentCount, user.id);

    const item: FeedItem = {
      id: generateId(),
      userId: user.id,
      userName: user.displayName,
      userAvatar: user.avatarUrl,
      sessionId: session.id,
      sessionSummary: {
        venue: session.venue,
        totalDrinks: session.drinks.length,
        totalStandardDrinks: session.totalStandardDrinks,
        durationMinutes: session.durationMinutes,
        topDrink: top.name,
        topDrinkEmoji: top.emoji,
        drinkEmojis: session.drinks.map((d) => d.emoji),
        drinks: session.drinks.map((d) => ({
          name: d.drinkName, emoji: d.emoji, category: d.category,
          abvPercent: d.abvPercent, volumeMl: d.volumeMl, standardDrinks: d.standardDrinks,
        })),
        mood: session.mood,
        prsAchieved: session.prsAchieved,
      },
      photos: [],
      caption,
      taggedUserIds: [],
      likes,
      likeCount: likes.length,
      currentUserLikeId: null,
      comments,
      commentCount: comments.reduce((sum, c) => sum + 1 + c.replies.length, 0),
      createdAt: session.endedAt ?? session.startedAt,
      isBackfilled: false,
    };
    return item;
  })
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
