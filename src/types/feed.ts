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
  likes: FeedLike[];
  comments: FeedComment[];
  createdAt: string;
  // True when the post originated from the "log past session" flow. Drives
  // the "Past session" badge on the feed card. Set at create time; never
  // changed on edit.
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
