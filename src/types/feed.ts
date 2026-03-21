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
    }[];
    mood: SessionMood | null;
    prsAchieved: PersonalRecord[];
  };
  photos: string[];
  caption: string;
  likes: FeedLike[];
  comments: FeedComment[];
  createdAt: string;
}

export type ReactionEmoji = '🔥' | '🍻' | '💀' | '😂' | '🎉' | '👑';

export interface FeedLike {
  id: string;
  userId: string;
  userName: string;
  emoji: ReactionEmoji;
  createdAt: string;
}

export interface FeedComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  text: string;
  createdAt: string;
}
