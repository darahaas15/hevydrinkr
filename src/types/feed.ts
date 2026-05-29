import type { PersonalRecord } from './pr';
import type { SessionMood } from './session';

export interface FeedItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  sessionId: string;
  sessionSummary: {
    venue: string;
    totalDrinks: number;
    totalStandardDrinks: number;
    durationMinutes: number;
    topDrink: string;
    topDrinkEmoji: string;
    drinkEmojis: string[];
    drinks: {
      name: string;
      emoji: string;
      category: string;
      abvPercent: number;
      volumeMl: number;
      standardDrinks: number;
      // Populated by newer writes so edits round-trip with the real
      // drink_definitions row and per-drink times. Older rows omit these.
      drinkDefinitionId?: string;
      timestamp?: string;
    }[];
    mood: SessionMood | null;
    prsAchieved: PersonalRecord[];
  };
  photos: string[];
  caption: string;
  // User IDs tagged in this post (a subset of the poster's following).
  // Names/avatars resolve client-side via the auth store, like mentions.
  taggedUserIds: string[];
  likes: FeedLike[];
  // Cached counts derived from `likes`/`comments`. Persisted in localStorage
  // so the feed renders heart count, fill state, and comment count without
  // waiting for the full arrays (which we strip from the cache to fit the
  // localStorage quota). Recomputed via deriveCounts() at every mutation.
  likeCount: number;
  // Row id of the current user's like, or null. Used during the cache-only
  // window (likes: []) to drive heart fill — its mere presence means
  // "current user liked this", because it's set against currentUser.id at
  // write time. Cross-user staleness is acceptable; see spec.
  currentUserLikeId: string | null;
  comments: FeedComment[];
  commentCount: number;
  createdAt: string;
  isBackfilled: boolean;
}

export interface FeedLike {
  id: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface CommentLike {
  id: string;
  userId: string;
  createdAt: string;
}

export interface FeedComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  text: string;
  parentCommentId: string | null;
  likes: CommentLike[];
  replies: FeedComment[];
  createdAt: string;
}
