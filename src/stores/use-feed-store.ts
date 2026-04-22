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
import { buildSessionSummary } from '@/lib/session-utils';

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
    caption: string,
    isBackfilled?: boolean,
  ) => Promise<void>;
  deleteFeedItem: (feedItemId: string) => Promise<void>;
  updateFeedItem: (feedItemId: string, updates: {
    caption?: string;
    photos?: string[];
    sessionSummary?: FeedItem['sessionSummary'];
  }) => Promise<void>;
  deleteComment: (feedItemId: string, commentId: string) => Promise<void>;

  // Realtime payload appliers — patch state from a single Postgres change.
  // Skip self-events (optimistic updates already cover those) and avoid full
  // refetch so concurrent optimistic state can't be clobbered.
  refreshFeedItem: (feedItemId: string) => Promise<void>;
  applyFeedItemChange: (payload: RealtimePayload, currentUserId: string) => Promise<void>;
  applyLikeChange: (payload: RealtimePayload, currentUserId: string) => Promise<void>;
  applyCommentChange: (payload: RealtimePayload, currentUserId: string) => Promise<void>;
}

type RealtimePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

interface FeedItemRow {
  id: string;
  user_id: string;
  session_id: string;
  session_summary: FeedItem['sessionSummary'];
  photos: string[];
  caption: string;
  created_at: string;
  is_backfilled?: boolean;
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
    isBackfilled: row.is_backfilled ?? false,
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

  createFeedItemFromSession: async (session, user, caption, isBackfilled = false) => {
    const sessionSummary = buildSessionSummary(session);

    const { data: inserted, error } = await supabase
      .from('feed_items')
      .insert({
        user_id: user.id,
        session_id: session.id,
        session_summary: sessionSummary,
        photos: session.photos ?? [],
        caption,
        is_backfilled: isBackfilled,
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
      isBackfilled,
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
      const ownerHistory = sessionStore.sessionsByUser[item.userId] ?? [];
      useSessionStore.setState({
        sessionsByUser: {
          ...sessionStore.sessionsByUser,
          [item.userId]: ownerHistory.filter((s) => s.id !== item.sessionId),
        },
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

    // If photos changed, sync session_photos rows so the session detail page
    // (which reads from session_photos, not feed_items.photos) stays in sync.
    if (updates.photos !== undefined && item?.sessionId) {
      const sessionId = item.sessionId;
      const newPhotoUrls = updates.photos;

      // Delete all existing session_photos for this session, then reinsert.
      const { error: deletePhotoErr } = await supabase
        .from('session_photos')
        .delete()
        .eq('session_id', sessionId);

      if (deletePhotoErr) {
        console.error('Failed to delete session_photos on edit:', deletePhotoErr);
        useUIStore.getState().addToast('Photos may be out of sync — try again', 'error');
        // Do NOT roll back the feed_items update — partial sync is better than losing the edit.
      } else if (newPhotoUrls.length > 0) {
        const { data: insertedPhotos, error: insertPhotoErr } = await supabase
          .from('session_photos')
          .insert(
            newPhotoUrls.map((url, i) => ({
              id: crypto.randomUUID(),
              session_id: sessionId,
              storage_path: '',
              url,
              sort_order: i,
            })),
          )
          .select('id, url, sort_order');

        if (insertPhotoErr) {
          console.error('Failed to insert session_photos on edit:', insertPhotoErr);
          useUIStore.getState().addToast('Photos may be out of sync — try again', 'error');
        } else {
          // Update local session store so the session detail page sees the new
          // photos without a full refetch.
          const sessionStore = useSessionStore.getState();
          const ownerHistory = sessionStore.sessionsByUser[item.userId] ?? [];
          const sortedPhotos = (insertedPhotos ?? []).sort((a, b) => a.sort_order - b.sort_order);
          useSessionStore.setState({
            sessionsByUser: {
              ...sessionStore.sessionsByUser,
              [item.userId]: ownerHistory.map((sess) => {
                if (sess.id !== sessionId) return sess;
                return {
                  ...sess,
                  photos: sortedPhotos.map((p) => p.url),
                  photoIds: sortedPhotos.map((p) => p.id),
                };
              }),
            },
          });
        }
      } else {
        // Photos cleared — update local session store to reflect empty photos.
        const sessionStore = useSessionStore.getState();
        const ownerHistory = sessionStore.sessionsByUser[item.userId] ?? [];
        useSessionStore.setState({
          sessionsByUser: {
            ...sessionStore.sessionsByUser,
            [item.userId]: ownerHistory.map((sess) => {
              if (sess.id !== sessionId) return sess;
              return { ...sess, photos: [], photoIds: [] };
            }),
          },
        });
      }
    }

    // If session summary changed, sync drink_entries and drink_sessions
    if (updates.sessionSummary && item?.sessionId) {
      const s = updates.sessionSummary;
      const sessionId = item.sessionId;
      // Generate stable IDs once so DB rows and local-state drinks match.
      const fallbackTimestamp = new Date().toISOString();
      const newDrinks = (s.drinks ?? []).map((d) => ({
        id: crypto.randomUUID(),
        drink: d,
        // Prefer real IDs/timestamps from the payload; fall back to sentinels
        // only when the payload predates the extended summary shape.
        drinkDefinitionId: d.drinkDefinitionId ?? 'edited',
        timestamp: d.timestamp ?? fallbackTimestamp,
      }));

      // Phase 1: update session metadata and delete old drink entries in parallel.
      const [sessionUpdateRes, deleteRes] = await Promise.all([
        supabase.from('drink_sessions').update({
          total_standard_drinks: s.totalStandardDrinks,
          duration_minutes: s.durationMinutes,
          venue: s.venue,
        }).eq('id', sessionId),
        supabase.from('drink_entries').delete().eq('session_id', sessionId),
      ]);

      if (sessionUpdateRes.error || deleteRes.error) {
        // Couldn't apply the edit cleanly. Roll back the optimistic feed/userPosts
        // state and leave drink_entries alone (delete may not have run).
        console.error('Failed to apply edit:', sessionUpdateRes.error ?? deleteRes.error);
        set({ items: prevItems, userPosts: prevUserPosts });
        useUIStore.getState().addToast('Something went wrong', 'error');
        return;
      }

      // Phase 2: insert the new drink entries (delete already succeeded).
      if (newDrinks.length > 0) {
        const { error: insertErr } = await supabase.from('drink_entries').insert(
          newDrinks.map(({ id, drink, drinkDefinitionId, timestamp }) => ({
            id,
            session_id: sessionId,
            drink_definition_id: drinkDefinitionId,
            drink_name: drink.name,
            emoji: drink.emoji,
            category: drink.category,
            abv_percent: drink.abvPercent,
            volume_ml: drink.volumeMl,
            standard_drinks: drink.standardDrinks,
            timestamp,
          })),
        );
        if (insertErr) {
          // Drinks were deleted but not re-inserted. The DB session is now
          // empty; surface the failure and roll back local feed state. The
          // session store will reconcile on next focus refetch.
          console.error('Failed to insert edited drinks:', insertErr);
          set({ items: prevItems, userPosts: prevUserPosts });
          useUIStore.getState().addToast('Edit partially failed — refreshing', 'error');
          return;
        }
      }

      // Sync session store with the same IDs we just wrote to the DB so
      // local state and drink_entries.id stay aligned.
      const sessionStore = useSessionStore.getState();
      const ownerHistory = sessionStore.sessionsByUser[item.userId] ?? [];
      const updatedOwnerHistory = ownerHistory.map((sess) => {
        if (sess.id !== sessionId) return sess;
        return {
          ...sess,
          venue: s.venue,
          totalStandardDrinks: s.totalStandardDrinks,
          durationMinutes: s.durationMinutes,
          drinks: newDrinks.map(({ id, drink, drinkDefinitionId, timestamp }) => ({
            id,
            drinkDefinitionId,
            drinkName: drink.name,
            emoji: drink.emoji,
            category: drink.category as DrinkCategory,
            abvPercent: drink.abvPercent,
            volumeMl: drink.volumeMl,
            standardDrinks: drink.standardDrinks,
            timestamp,
            roundId: null,
            notes: '',
          } as DrinkSession['drinks'][0])),
        };
      });
      useSessionStore.setState({
        sessionsByUser: {
          ...sessionStore.sessionsByUser,
          [item.userId]: updatedOwnerHistory,
        },
      });
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

  refreshFeedItem: async (feedItemId) => {
    const { data, error } = await supabase
      .from('feed_items')
      .select(FEED_SELECT)
      .eq('id', feedItemId)
      .single();
    if (error || !data) return;
    const fresh = mapRow(data as unknown as FeedItemRow);
    if (!fresh) return;
    set((state) => {
      const items = state.items.some((i) => i.id === feedItemId)
        ? state.items.map((i) => (i.id === feedItemId ? fresh : i))
        : [fresh, ...state.items];
      const userPosts: Record<string, FeedItem[]> = {};
      for (const [uid, posts] of Object.entries(state.userPosts)) {
        if (uid === fresh.userId) {
          userPosts[uid] = posts.some((i) => i.id === feedItemId)
            ? posts.map((i) => (i.id === feedItemId ? fresh : i))
            : [fresh, ...posts];
        } else {
          userPosts[uid] = posts;
        }
      }
      return { items, userPosts };
    });
  },

  applyFeedItemChange: async (payload, currentUserId) => {
    const id = (payload.new?.id ?? payload.old?.id) as string | undefined;
    if (!id) return;
    if (payload.eventType === 'DELETE') {
      set((state) => removeItemEverywhere(state, id));
      return;
    }
    // Skip self — optimistic update already applied
    const userId = payload.new?.user_id as string | undefined;
    if (userId === currentUserId) return;
    await get().refreshFeedItem(id);
  },

  applyLikeChange: async (payload, currentUserId) => {
    const userId = (payload.new?.user_id ?? payload.old?.user_id) as string | undefined;
    if (userId === currentUserId) return;
    const feedItemId = (payload.new?.feed_item_id ?? payload.old?.feed_item_id) as string | undefined;
    if (!feedItemId) return;
    if (payload.eventType === 'DELETE') {
      const likeId = payload.old?.id as string | undefined;
      if (!likeId) return;
      set((state) => patchItemEverywhere(state, feedItemId, (item) => ({
        ...item,
        likes: item.likes.filter((l) => l.id !== likeId),
      })));
      return;
    }
    // INSERT/UPDATE — payload lacks the joined liker profile, so refresh
    await get().refreshFeedItem(feedItemId);
  },

  applyCommentChange: async (payload, currentUserId) => {
    const userId = (payload.new?.user_id ?? payload.old?.user_id) as string | undefined;
    if (userId === currentUserId) return;
    const feedItemId = (payload.new?.feed_item_id ?? payload.old?.feed_item_id) as string | undefined;
    if (!feedItemId) return;
    if (payload.eventType === 'DELETE') {
      const commentId = payload.old?.id as string | undefined;
      if (!commentId) return;
      set((state) => patchItemEverywhere(state, feedItemId, (item) => ({
        ...item,
        comments: item.comments
          .filter((c) => c.id !== commentId)
          .map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== commentId) })),
      })));
      return;
    }
    // INSERT/UPDATE — payload lacks joined commenter profile, so refresh
    await get().refreshFeedItem(feedItemId);
  },
}), {
  name: 'hd-feed',
  storage: safeJSONStorage(),
  partialize: (s) => ({ items: s.items.slice(0, 50).map(stripFeedPhotos) }),
  onRehydrateStorage: () => (state) => {
    if (state && state.items.length > 0) state.loading = false;
  },
}));
