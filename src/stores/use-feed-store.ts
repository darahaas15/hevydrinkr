import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  FeedItem,
  FeedLike,
  FeedComment,
  DrinkSession,
  UserProfile,
} from '@/types';
import { generateId } from '@/lib/utils';

interface FeedState {
  items: FeedItem[];

  addFeedItem: (item: FeedItem) => void;
  addLike: (feedItemId: string, like: FeedLike) => void;
  removeLike: (feedItemId: string, likeId: string) => void;
  addComment: (feedItemId: string, comment: FeedComment) => void;
  getFeedForUser: (userId: string) => FeedItem[];
  createFeedItemFromSession: (
    session: DrinkSession,
    user: UserProfile,
    caption: string
  ) => void;
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set, get) => ({
      items: [],

      addFeedItem: (item) =>
        set((state) => ({
          items: [item, ...state.items],
        })),

      addLike: (feedItemId, like) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === feedItemId
              ? { ...item, likes: [...item.likes, like] }
              : item
          ),
        })),

      removeLike: (feedItemId, likeId) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === feedItemId
              ? {
                  ...item,
                  likes: item.likes.filter((l) => l.id !== likeId),
                }
              : item
          ),
        })),

      addComment: (feedItemId, comment) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === feedItemId
              ? { ...item, comments: [...item.comments, comment] }
              : item
          ),
        })),

      getFeedForUser: (userId) =>
        get().items.filter((item) => item.userId === userId),

      createFeedItemFromSession: (session, user, caption) => {
        const drinkCounts: Record<string, { count: number; emoji: string }> =
          {};
        const drinkEmojis: string[] = [];

        for (const drink of session.drinks) {
          drinkEmojis.push(drink.emoji);
          if (drinkCounts[drink.drinkName]) {
            drinkCounts[drink.drinkName].count++;
          } else {
            drinkCounts[drink.drinkName] = { count: 1, emoji: drink.emoji };
          }
        }

        let topDrink = '';
        let topDrinkEmoji = '';
        let maxCount = 0;

        for (const [name, data] of Object.entries(drinkCounts)) {
          if (data.count > maxCount) {
            maxCount = data.count;
            topDrink = name;
            topDrinkEmoji = data.emoji;
          }
        }

        const feedItem: FeedItem = {
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
            topDrink,
            topDrinkEmoji,
            drinkEmojis,
            mood: session.mood,
            prsAchieved: session.prsAchieved,
          },
          photos: session.photos || [],
          caption,
          likes: [],
          comments: [],
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          items: [feedItem, ...state.items],
        }));
      },
    }),
    {
      name: 'hevydrinkr-feed',
    }
  )
);
