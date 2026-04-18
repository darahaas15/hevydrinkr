import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  FeedItem,
  FeedLike,
  FeedComment,
  CommentLike,
  DrinkSession,
  DrinkCategory,
  UserProfile,
} from '@/types';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from './use-auth-store';
import { useSessionStore } from './use-session-store';
import { useUIStore } from '@/stores/use-ui-store';
import { safeJSONStorage } from '@/lib/storage/safe-storage';

// Photo data URLs are huge — Supabase is the source of truth, refetch on load.
const stripFeedPhotos = (item: FeedItem): FeedItem => ({ ...item, photos: [] });

const FEED_STALE_MS = 30_000;
const FEED_PAGE_SIZE = 15;
let _feedLastFetched = 0;
const _userPostsLastFetched = new Map<string, number>();

const FEED_SELECT = `
  *,
  profile:profiles!feed_items_user_id_fkey(display_name, avatar_url),
  feed_likes(id, user_id, created_at, liker:profiles!feed_likes_user_id_fkey(display_name)),
  feed_comments(id, user_id, text, parent_comment_id, created_at, commenter:profiles!feed_comments_user_id_fkey(display_name, avatar_url), comment_likes(id, user_id, created_at))
`;

interface FeedState {
  items: FeedItem[];
  // All posts per user, keyed by userId. Populated on demand via fetchUserPosts
  // so profile pages and per-user calculations can see ALL of a user's posts,
  // not just the slice that lands in the paginated `items` feed view.
  userPosts: Record<string, FeedItem[]>;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;

  fetchFeed: (force?: boolean) => Promise<void>;
  fetchMoreFeed: () => Promise<void>;
  fetchSinglePost: (postId: string) => Promise<FeedItem | null>;
  fetchUserPosts: (userId: string, force?: boolean) => Promise<void>;
  addLike: (feedItemId: string, like: FeedLike) => Promise<void>;
  removeLike: (feedItemId: string, likeId: string) => Promise<void>;
  addComment: (feedItemId: string, comment: FeedComment, parentCommentId?: string | null) => Promise<void>;
  getFeedForUser: (userId: string) => FeedItem[];
  likeComment: (feedItemId: string, commentId: string) => Promise<void>;
  unlikeComment: (feedItemId: string, commentId: string, likeId: string) => Promise<void>;
  createFeedItemFromSession: (
    session: DrinkSession,
    user: UserProfile,
    caption: string
  ) => Promise<void>;
  deleteFeedItem: (feedItemId: string) => Promise<void>;
  updateFeedItem: (feedItemId: string, updates: {
    caption?: string;
    photos?: string[];
    sessionSummary?: FeedItem['sessionSummary'];
  }) => Promise<void>;
  deleteComment: (feedItemId: string, commentId: string) => Promise<void>;
}

interface FeedItemRow {
  id: string;
  user_id: string;
  session_id: string;
  session_summary: FeedItem['sessionSummary'];
  photos: string[];
  caption: string;
  created_at: string;
  profile: { display_name: string; avatar_url: string | null };
  feed_likes: Array<{
    id: string;
    user_id: string;
    created_at: string;
    liker: { display_name: string };
  }>;
  feed_comments: Array<{
    id: string;
    user_id: string;
    text: string;
    parent_comment_id: string | null;
    created_at: string;
    commenter: { display_name: string; avatar_url: string | null };
    comment_likes: Array<{ id: string; user_id: string; created_at: string }>;
  }>;
}

function threadComments(
  raw: FeedItemRow['feed_comments']
): FeedComment[] {
  // Pass 1: flat map all comments
  const map = new Map<string, FeedComment>();
  for (const c of raw) {
    map.set(c.id, {
      id: c.id,
      userId: c.user_id,
      userName: c.commenter.display_name,
      userAvatar: c.commenter.avatar_url,
      text: c.text,
      parentCommentId: c.parent_comment_id,
      likes: (c.comment_likes ?? []).map((l) => ({
        id: l.id,
        userId: l.user_id,
        createdAt: l.created_at,
      })),
      replies: [],
      createdAt: c.created_at,
    });
  }
  // Pass 2: group replies under parents, keep top-level only
  const topLevel: FeedComment[] = [];
  for (const comment of map.values()) {
    if (comment.parentCommentId) {
      const parent = map.get(comment.parentCommentId);
      if (parent) {
        parent.replies.push(comment);
      }
    } else {
      topLevel.push(comment);
    }
  }
  // Sort replies chronologically
  for (const c of topLevel) {
    c.replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  return topLevel;
}

/** Recursively find a comment in the tree (top-level or nested reply). */
function findComment(comments: FeedComment[], commentId: string): FeedComment | undefined {
  for (const c of comments) {
    if (c.id === commentId) return c;
    const found = findComment(c.replies, commentId);
    if (found) return found;
  }
  return undefined;
}

/** Return a new comments array with a mapper applied to the target comment. */
function mapComment(comments: FeedComment[], commentId: string, fn: (c: FeedComment) => FeedComment): FeedComment[] {
  return comments.map((c) => {
    if (c.id === commentId) return fn(c);
    if (c.replies.length > 0) {
      return { ...c, replies: mapComment(c.replies, commentId, fn) };
    }
    return c;
  });
}

function mapRow(row: FeedItemRow): FeedItem | null {
  // Defend against corrupt rows: if session_summary is missing, the item
  // is unrenderable (every consumer reads sessionSummary.totalDrinks etc.)
  // and would crash the page. Drop it instead.
  if (!row.session_summary) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.profile.display_name,
    userAvatar: row.profile.avatar_url,
    sessionId: row.session_id,
    sessionSummary: row.session_summary,
    photos: row.photos ?? [],
    caption: row.caption,
    likes: (row.feed_likes ?? []).map((l) => ({
      id: l.id,
      userId: l.user_id,
      userName: l.liker.display_name,
      createdAt: l.created_at,
    })),
    comments: threadComments(row.feed_comments ?? []),
    createdAt: row.created_at,
  };
}

function mapRows(rows: FeedItemRow[]): FeedItem[] {
  return rows.map(mapRow).filter((x): x is FeedItem => x !== null);
}

// Apply a transform to a feed item across both `items` and any cached
// per-user post list it appears in. Keeps the two stores consistent so a
// like/comment/edit reflects in profile views as well as the feed.
function patchItemEverywhere(
  state: { items: FeedItem[]; userPosts: Record<string, FeedItem[]> },
  feedItemId: string,
  fn: (item: FeedItem) => FeedItem,
): { items: FeedItem[]; userPosts: Record<string, FeedItem[]> } {
  const items = state.items.map((i) => (i.id === feedItemId ? fn(i) : i));
  const userPosts: Record<string, FeedItem[]> = {};
  for (const [uid, posts] of Object.entries(state.userPosts)) {
    userPosts[uid] = posts.map((i) => (i.id === feedItemId ? fn(i) : i));
  }
  return { items, userPosts };
}

// Remove an item from both stores by id.
function removeItemEverywhere(
  state: { items: FeedItem[]; userPosts: Record<string, FeedItem[]> },
  feedItemId: string,
): { items: FeedItem[]; userPosts: Record<string, FeedItem[]> } {
  const items = state.items.filter((i) => i.id !== feedItemId);
  const userPosts: Record<string, FeedItem[]> = {};
  for (const [uid, posts] of Object.entries(state.userPosts)) {
    userPosts[uid] = posts.filter((i) => i.id !== feedItemId);
  }
  return { items, userPosts };
}

export const useFeedStore = create<FeedState>()(persist((set, get) => ({
  items: [],
  userPosts: {},
  loading: true,
  loadingMore: false,
  hasMore: true,
  error: null,

  fetchFeed: async (force) => {
    if (!force && Date.now() - _feedLastFetched < FEED_STALE_MS) return;
    _feedLastFetched = Date.now();
    // Only show loading skeleton on initial load, not refetches
    if (get().items.length === 0) set({ loading: true });
    set({ error: null });

    const { data, error } = await supabase
      .from('feed_items')
      .select(FEED_SELECT)
      .order('created_at', { ascending: false })
      .limit(FEED_PAGE_SIZE);

    if (error) {
      set({ loading: false, error: error.message });
      return;
    }

    const rows = data as unknown as FeedItemRow[];
    const items = mapRows(rows);
    set({ items, loading: false, hasMore: rows.length === FEED_PAGE_SIZE });
  },

  fetchMoreFeed: async () => {
    const { items, loadingMore, hasMore } = get();
    if (loadingMore || !hasMore || items.length === 0) return;

    set({ loadingMore: true });
    const lastItem = items[items.length - 1];

    const { data, error } = await supabase
      .from('feed_items')
      .select(FEED_SELECT)
      .order('created_at', { ascending: false })
      .lt('created_at', lastItem.createdAt)
      .limit(FEED_PAGE_SIZE);

    if (error) {
      set({ loadingMore: false });
      return;
    }

    const rows = data as unknown as FeedItemRow[];
    const newItems = mapRows(rows);
    set((state) => ({
      items: [...state.items, ...newItems],
      loadingMore: false,
      hasMore: rows.length === FEED_PAGE_SIZE,
    }));
  },

  fetchUserPosts: async (userId: string, force?: boolean) => {
    if (!userId) return;
    const last = _userPostsLastFetched.get(userId) ?? 0;
    if (!force && Date.now() - last < FEED_STALE_MS) return;
    _userPostsLastFetched.set(userId, Date.now());

    const { data, error } = await supabase
      .from('feed_items')
      .select(FEED_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return;

    const posts = mapRows(data as unknown as FeedItemRow[]);
    set((state) => ({ userPosts: { ...state.userPosts, [userId]: posts } }));
  },

  fetchSinglePost: async (postId: string) => {
    // Return from cache if already present
    const cached = get().items.find((i) => i.id === postId);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('feed_items')
      .select(FEED_SELECT)
      .eq('id', postId)
      .single();

    if (error || !data) return null;

    const item = mapRow(data as unknown as FeedItemRow);
    if (!item) return null;
    // Merge into store so subsequent reads find it
    set((state) => {
      const items = state.items.some((i) => i.id === postId)
        ? state.items
        : [item, ...state.items];
      const existing = state.userPosts[item.userId];
      const userPosts = existing && !existing.some((i) => i.id === postId)
        ? { ...state.userPosts, [item.userId]: [item, ...existing] }
        : state.userPosts;
      return { items, userPosts };
    });
    return item;
  },

  createFeedItemFromSession: async (session, user, caption) => {
    const drinkCounts: Record<string, { count: number; emoji: string }> = {};
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

    const sessionSummary: FeedItem['sessionSummary'] = {
      venue: session.venue,
      totalDrinks: session.drinks.length,
      totalStandardDrinks: session.totalStandardDrinks,
      durationMinutes: session.durationMinutes,
      topDrink,
      topDrinkEmoji,
      drinkEmojis,
      drinks: session.drinks.map((d) => ({
        name: d.drinkName,
        emoji: d.emoji,
        category: d.category,
        abvPercent: d.abvPercent,
        volumeMl: d.volumeMl,
        standardDrinks: d.standardDrinks,
      })),
      mood: session.mood,
      prsAchieved: session.prsAchieved,
    };

    const { data: inserted, error } = await supabase
      .from('feed_items')
      .insert({
        user_id: user.id,
        session_id: session.id,
        session_summary: sessionSummary,
        photos: session.photos ?? [],
        caption,
      })
      .select()
      .single();

    if (error) {
      set({ error: error.message });
      useUIStore.getState().addToast('Something went wrong', 'error');
      return;
    }

    const feedItem: FeedItem = {
      id: inserted.id,
      userId: user.id,
      userName: user.displayName,
      userAvatar: user.avatarUrl,
      sessionId: session.id,
      sessionSummary,
      photos: session.photos ?? [],
      caption,
      likes: [],
      comments: [],
      createdAt: inserted.created_at,
    };

    set((state) => {
      const existing = state.userPosts[user.id];
      return {
        items: [feedItem, ...state.items],
        userPosts: existing
          ? { ...state.userPosts, [user.id]: [feedItem, ...existing] }
          : state.userPosts,
      };
    });
  },

  addLike: async (feedItemId, like) => {
    // Optimistic update
    set((state) => patchItemEverywhere(state, feedItemId, (item) => ({
      ...item,
      likes: [...item.likes, like],
    })));

    const { data: inserted, error } = await supabase
      .from('feed_likes')
      .upsert({
        feed_item_id: feedItemId,
        user_id: like.userId,
      }, { onConflict: 'feed_item_id,user_id' })
      .select()
      .single();

    if (error) {
      // Roll back optimistic update
      set((state) => ({
        ...patchItemEverywhere(state, feedItemId, (item) => ({
          ...item,
          likes: item.likes.filter((l) => l.id !== like.id),
        })),
        error: error.message,
      }));
      return;
    }

    // Replace the temp like id with the real DB id
    set((state) => patchItemEverywhere(state, feedItemId, (item) => ({
      ...item,
      likes: item.likes.map((l) => (l.id === like.id ? { ...l, id: inserted.id } : l)),
    })));
  },

  removeLike: async (feedItemId, likeId) => {
    const prevItems = get().items;
    const prevUserPosts = get().userPosts;
    // Optimistic update
    set((state) => patchItemEverywhere(state, feedItemId, (item) => ({
      ...item,
      likes: item.likes.filter((l) => l.id !== likeId),
    })));

    const { error } = await supabase
      .from('feed_likes')
      .delete()
      .eq('id', likeId);

    if (error) {
      // Roll back
      set({ items: prevItems, userPosts: prevUserPosts, error: error.message });
    }
  },

  addComment: async (feedItemId, comment, parentCommentId) => {
    const insertComment = (item: FeedItem): FeedItem => {
      if (parentCommentId) {
        return {
          ...item,
          comments: mapComment(item.comments, parentCommentId, (parent) => ({
            ...parent,
            replies: [...parent.replies, comment],
          })),
        };
      }
      return { ...item, comments: [...item.comments, comment] };
    };
    const removeComment = (item: FeedItem): FeedItem => {
      if (parentCommentId) {
        return {
          ...item,
          comments: mapComment(item.comments, parentCommentId, (parent) => ({
            ...parent,
            replies: parent.replies.filter((r) => r.id !== comment.id),
          })),
        };
      }
      return { ...item, comments: item.comments.filter((c) => c.id !== comment.id) };
    };

    // Optimistic update
    set((state) => patchItemEverywhere(state, feedItemId, insertComment));

    const { data: inserted, error } = await supabase
      .from('feed_comments')
      .insert({
        feed_item_id: feedItemId,
        user_id: comment.userId,
        text: comment.text,
        parent_comment_id: parentCommentId ?? null,
      })
      .select()
      .single();

    if (error) {
      // Roll back optimistic update
      set((state) => ({
        ...patchItemEverywhere(state, feedItemId, removeComment),
        error: error.message,
      }));
      useUIStore.getState().addToast('Something went wrong', 'error');
      return;
    }

    // Replace the temp comment id with the real DB id
    set((state) => patchItemEverywhere(state, feedItemId, (item) => ({
      ...item,
      comments: mapComment(item.comments, comment.id, (c) => ({ ...c, id: inserted.id })),
    })));
  },

  getFeedForUser: (userId) =>
    get().items.filter((item) => item.userId === userId),

  deleteFeedItem: async (feedItemId) => {
    const prevItems = get().items;
    const prevUserPosts = get().userPosts;
    const item = prevItems.find((i) => i.id === feedItemId);
    const currentUserId = useAuthStore.getState().currentUser?.id;
    if (!item || item.userId !== currentUserId) return;
    set((state) => removeItemEverywhere(state, feedItemId));

    // Delete the feed item
    const { error } = await supabase
      .from('feed_items')
      .delete()
      .eq('id', feedItemId);

    if (error) {
      console.error('Failed to delete feed item:', error);
      set({ items: prevItems, userPosts: prevUserPosts });
      useUIStore.getState().addToast('Something went wrong', 'error');
      return;
    }

    // Also delete the linked session (cascades to drink_entries, session_photos, rounds)
    if (item?.sessionId) {
      await supabase
        .from('drink_sessions')
        .delete()
        .eq('id', item.sessionId);

      // Remove from session store's local state so profile stats update immediately
      const sessionStore = useSessionStore.getState();
      useSessionStore.setState({
        sessionHistory: sessionStore.sessionHistory.filter((s) => s.id !== item.sessionId),
      });
    }
  },

  updateFeedItem: async (feedItemId, updates) => {
    const prevItems = get().items;
    const prevUserPosts = get().userPosts;
    const item = prevItems.find((i) => i.id === feedItemId);
    const currentUserId = useAuthStore.getState().currentUser?.id;
    if (!item || item.userId !== currentUserId) return;

    set((state) => patchItemEverywhere(state, feedItemId, (i) => ({ ...i, ...updates })));

    const dbUpdates: Record<string, unknown> = {};
    if (updates.caption !== undefined) dbUpdates.caption = updates.caption;
    if (updates.photos !== undefined) dbUpdates.photos = updates.photos;
    if (updates.sessionSummary !== undefined) dbUpdates.session_summary = updates.sessionSummary;

    const { data: updated, error } = await supabase
      .from('feed_items')
      .update(dbUpdates)
      .eq('id', feedItemId)
      .select('id')
      .maybeSingle();

    if (error || !updated) {
      console.error('Failed to update feed item:', error ?? 'No rows updated (RLS policy may be missing)');
      set({ items: prevItems, userPosts: prevUserPosts });
      useUIStore.getState().addToast('Something went wrong', 'error');
      return;
    }

    // If session summary changed, sync drink_entries and drink_sessions
    if (updates.sessionSummary && item?.sessionId) {
      const s = updates.sessionSummary;

      // Update session totals + replace drink entries in parallel
      const sessionUpdate = supabase.from('drink_sessions').update({
        total_standard_drinks: s.totalStandardDrinks,
        duration_minutes: s.durationMinutes,
        venue: s.venue,
      }).eq('id', item.sessionId);

      const drinkReplace = supabase.from('drink_entries').delete().eq('session_id', item.sessionId)
        .then(() => {
          if (s.drinks && s.drinks.length > 0) {
            return supabase.from('drink_entries').insert(
              s.drinks.map((d) => ({
                id: crypto.randomUUID(),
                session_id: item.sessionId,
                drink_definition_id: 'edited',
                drink_name: d.name,
                emoji: d.emoji,
                category: d.category,
                abv_percent: d.abvPercent,
                volume_ml: d.volumeMl,
                standard_drinks: d.standardDrinks,
                timestamp: new Date().toISOString(),
              }))
            );
          }
        });

      await Promise.all([sessionUpdate, drinkReplace]);

      // Update session store so profile stats reflect changes
      const sessionStore = useSessionStore.getState();
      const updatedHistory = sessionStore.sessionHistory.map((sess) => {
        if (sess.id !== item.sessionId) return sess;
        return {
          ...sess,
          venue: s.venue,
          totalStandardDrinks: s.totalStandardDrinks,
          durationMinutes: s.durationMinutes,
          drinks: (s.drinks || []).map((d, i) => ({
            id: crypto.randomUUID(),
            drinkDefinitionId: 'edited',
            drinkName: d.name,
            emoji: d.emoji,
            category: d.category as DrinkCategory,
            abvPercent: d.abvPercent,
            volumeMl: d.volumeMl,
            standardDrinks: d.standardDrinks,
            timestamp: new Date().toISOString(),
            roundId: null,
            notes: '',
          } as DrinkSession['drinks'][0])),
        };
      });
      useSessionStore.setState({ sessionHistory: updatedHistory });
    }
  },

  deleteComment: async (feedItemId, commentId) => {
    const prevItems = get().items;
    const prevUserPosts = get().userPosts;
    const currentUserId = useAuthStore.getState().currentUser?.id;
    const feedItem = prevItems.find((i) => i.id === feedItemId);
    const comment = feedItem ? findComment(feedItem.comments, commentId) : undefined;
    if (!comment || comment.userId !== currentUserId) return;

    set((state) => patchItemEverywhere(state, feedItemId, (item) => {
      // Try removing from top-level first
      const filtered = item.comments.filter((c) => c.id !== commentId);
      if (filtered.length < item.comments.length) {
        return { ...item, comments: filtered };
      }
      // Otherwise remove from a parent's replies
      return {
        ...item,
        comments: item.comments.map((c) => ({
          ...c,
          replies: c.replies.filter((r) => r.id !== commentId),
        })),
      };
    }));

    const { error } = await supabase
      .from('feed_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Failed to delete comment:', error);
      set({ items: prevItems, userPosts: prevUserPosts });
      useUIStore.getState().addToast('Something went wrong', 'error');
    }
  },

  likeComment: async (feedItemId, commentId) => {
    const userId = useAuthStore.getState().currentUser?.id;
    if (!userId) return;

    const tempId = crypto.randomUUID();
    const optimisticLike: CommentLike = { id: tempId, userId, createdAt: new Date().toISOString() };

    // Optimistic update
    set((state) => patchItemEverywhere(state, feedItemId, (item) => ({
      ...item,
      comments: mapComment(item.comments, commentId, (c) => ({ ...c, likes: [...c.likes, optimisticLike] })),
    })));

    const { data: inserted, error } = await supabase
      .from('comment_likes')
      .insert({ comment_id: commentId, user_id: userId })
      .select()
      .single();

    if (error) {
      // Roll back
      set((state) => patchItemEverywhere(state, feedItemId, (item) => ({
        ...item,
        comments: mapComment(item.comments, commentId, (c) => ({ ...c, likes: c.likes.filter((l) => l.id !== tempId) })),
      })));
      return;
    }

    // Replace temp id with real id
    set((state) => patchItemEverywhere(state, feedItemId, (item) => ({
      ...item,
      comments: mapComment(item.comments, commentId, (c) => ({
        ...c,
        likes: c.likes.map((l) => (l.id === tempId ? { ...l, id: inserted.id } : l)),
      })),
    })));
  },

  unlikeComment: async (feedItemId, commentId, likeId) => {
    const prevItems = get().items;
    const prevUserPosts = get().userPosts;

    // Optimistic update
    set((state) => patchItemEverywhere(state, feedItemId, (item) => ({
      ...item,
      comments: mapComment(item.comments, commentId, (c) => ({ ...c, likes: c.likes.filter((l) => l.id !== likeId) })),
    })));

    const { error } = await supabase.from('comment_likes').delete().eq('id', likeId);
    if (error) {
      set({ items: prevItems, userPosts: prevUserPosts });
    }
  },
}), {
  name: 'hd-feed',
  storage: safeJSONStorage(),
  partialize: (s) => ({ items: s.items.slice(0, 50).map(stripFeedPhotos) }),
  onRehydrateStorage: () => (state) => {
    if (state && state.items.length > 0) state.loading = false;
  },
}));
