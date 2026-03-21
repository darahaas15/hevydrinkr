import { create } from 'zustand';
import type {
  FeedItem,
  FeedLike,
  FeedComment,
  CommentLike,
  DrinkSession,
  DrinkCategory,
  UserProfile,
  ReactionEmoji,
} from '@/types';
import { supabase } from '@/lib/supabase/client';
import { useSessionStore } from './use-session-store';

interface FeedState {
  items: FeedItem[];
  loading: boolean;
  error: string | null;

  fetchFeed: () => Promise<void>;
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
    emoji: string;
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

function mapRow(row: FeedItemRow): FeedItem {
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
      emoji: l.emoji as ReactionEmoji,
      createdAt: l.created_at,
    })),
    comments: threadComments(row.feed_comments ?? []),
    createdAt: row.created_at,
  };
}

export const useFeedStore = create<FeedState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,

  fetchFeed: async () => {
    set({ loading: true, error: null });

    const { data, error } = await supabase
      .from('feed_items')
      .select(
        `
        *,
        profile:profiles!feed_items_user_id_fkey(display_name, avatar_url),
        feed_likes(id, user_id, emoji, created_at, liker:profiles!feed_likes_user_id_fkey(display_name)),
        feed_comments(id, user_id, text, parent_comment_id, created_at, commenter:profiles!feed_comments_user_id_fkey(display_name, avatar_url), comment_likes(id, user_id, created_at))
      `
      )
      .order('created_at', { ascending: false });

    if (error) {
      set({ loading: false, error: error.message });
      return;
    }

    const items = (data as unknown as FeedItemRow[]).map(mapRow);
    set({ items, loading: false });
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

    set((state) => ({
      items: [feedItem, ...state.items],
    }));
  },

  addLike: async (feedItemId, like) => {
    // Optimistic update
    set((state) => ({
      items: state.items.map((item) =>
        item.id === feedItemId
          ? { ...item, likes: [...item.likes, like] }
          : item
      ),
    }));

    const { data: inserted, error } = await supabase
      .from('feed_likes')
      .insert({
        feed_item_id: feedItemId,
        user_id: like.userId,
        emoji: like.emoji,
      })
      .select()
      .single();

    if (error) {
      // Roll back optimistic update
      set((state) => ({
        items: state.items.map((item) =>
          item.id === feedItemId
            ? {
                ...item,
                likes: item.likes.filter((l) => l.id !== like.id),
              }
            : item
        ),
        error: error.message,
      }));
      return;
    }

    // Replace the temp like id with the real DB id
    set((state) => ({
      items: state.items.map((item) =>
        item.id === feedItemId
          ? {
              ...item,
              likes: item.likes.map((l) =>
                l.id === like.id ? { ...l, id: inserted.id } : l
              ),
            }
          : item
      ),
    }));
  },

  removeLike: async (feedItemId, likeId) => {
    const prev = get().items;
    // Optimistic update
    set((state) => ({
      items: state.items.map((item) =>
        item.id === feedItemId
          ? {
              ...item,
              likes: item.likes.filter((l) => l.id !== likeId),
            }
          : item
      ),
    }));

    const { error } = await supabase
      .from('feed_likes')
      .delete()
      .eq('id', likeId);

    if (error) {
      // Roll back
      set({ items: prev, error: error.message });
    }
  },

  addComment: async (feedItemId, comment, parentCommentId) => {
    // Optimistic update
    set((state) => ({
      items: state.items.map((item) => {
        if (item.id !== feedItemId) return item;
        if (parentCommentId) {
          // Push reply into parent's replies[]
          return {
            ...item,
            comments: mapComment(item.comments, parentCommentId, (parent) => ({
              ...parent,
              replies: [...parent.replies, comment],
            })),
          };
        }
        return { ...item, comments: [...item.comments, comment] };
      }),
    }));

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
        items: state.items.map((item) => {
          if (item.id !== feedItemId) return item;
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
        }),
        error: error.message,
      }));
      return;
    }

    // Replace the temp comment id with the real DB id
    set((state) => ({
      items: state.items.map((item) => {
        if (item.id !== feedItemId) return item;
        return {
          ...item,
          comments: mapComment(item.comments, comment.id, (c) => ({ ...c, id: inserted.id })),
        };
      }),
    }));
  },

  getFeedForUser: (userId) =>
    get().items.filter((item) => item.userId === userId),

  deleteFeedItem: async (feedItemId) => {
    const prev = get().items;
    const item = prev.find((i) => i.id === feedItemId);
    // Auth check: only the post owner can delete
    const { data: { session } } = await supabase.auth.getSession();
    if (!item || item.userId !== session?.user?.id) return;
    set((state) => ({
      items: state.items.filter((i) => i.id !== feedItemId),
    }));

    // Delete the feed item
    const { error } = await supabase
      .from('feed_items')
      .delete()
      .eq('id', feedItemId);

    if (error) {
      console.error('Failed to delete feed item:', error);
      set({ items: prev });
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
    const prev = get().items;
    const item = prev.find((i) => i.id === feedItemId);
    // Auth check: only the post owner can edit
    const { data: { session } } = await supabase.auth.getSession();
    if (!item || item.userId !== session?.user?.id) return;

    set((state) => ({
      items: state.items.map((i) =>
        i.id === feedItemId ? { ...i, ...updates } : i
      ),
    }));

    const dbUpdates: Record<string, unknown> = {};
    if (updates.caption !== undefined) dbUpdates.caption = updates.caption;
    if (updates.photos !== undefined) dbUpdates.photos = updates.photos;
    if (updates.sessionSummary !== undefined) dbUpdates.session_summary = updates.sessionSummary;

    const { error } = await supabase
      .from('feed_items')
      .update(dbUpdates)
      .eq('id', feedItemId);

    if (error) {
      console.error('Failed to update feed item:', error);
      set({ items: prev });
      return;
    }

    // If session summary changed, sync drink_entries and drink_sessions
    if (updates.sessionSummary && item?.sessionId) {
      const s = updates.sessionSummary;

      // Update session totals
      await supabase.from('drink_sessions').update({
        total_standard_drinks: s.totalStandardDrinks,
        duration_minutes: s.durationMinutes,
        venue: s.venue,
      }).eq('id', item.sessionId);

      // Replace all drink entries: delete old, insert new
      await supabase.from('drink_entries').delete().eq('session_id', item.sessionId);
      if (s.drinks && s.drinks.length > 0) {
        await supabase.from('drink_entries').insert(
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
    const prev = get().items;
    // Auth check: only comment author can delete
    const { data: { session } } = await supabase.auth.getSession();
    const feedItem = prev.find((i) => i.id === feedItemId);
    const comment = feedItem ? findComment(feedItem.comments, commentId) : undefined;
    if (!comment || comment.userId !== session?.user?.id) return;

    set((state) => ({
      items: state.items.map((item) => {
        if (item.id !== feedItemId) return item;
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
      }),
    }));

    const { error } = await supabase
      .from('feed_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Failed to delete comment:', error);
      set({ items: prev });
    }
  },

  likeComment: async (feedItemId, commentId) => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    const tempId = crypto.randomUUID();
    const optimisticLike: CommentLike = { id: tempId, userId, createdAt: new Date().toISOString() };

    // Optimistic update
    set((state) => ({
      items: state.items.map((item) =>
        item.id === feedItemId
          ? { ...item, comments: mapComment(item.comments, commentId, (c) => ({ ...c, likes: [...c.likes, optimisticLike] })) }
          : item
      ),
    }));

    const { data: inserted, error } = await supabase
      .from('comment_likes')
      .insert({ comment_id: commentId, user_id: userId })
      .select()
      .single();

    if (error) {
      // Roll back
      set((state) => ({
        items: state.items.map((item) =>
          item.id === feedItemId
            ? { ...item, comments: mapComment(item.comments, commentId, (c) => ({ ...c, likes: c.likes.filter((l) => l.id !== tempId) })) }
            : item
        ),
      }));
      return;
    }

    // Replace temp id with real id
    set((state) => ({
      items: state.items.map((item) =>
        item.id === feedItemId
          ? { ...item, comments: mapComment(item.comments, commentId, (c) => ({ ...c, likes: c.likes.map((l) => l.id === tempId ? { ...l, id: inserted.id } : l) })) }
          : item
      ),
    }));
  },

  unlikeComment: async (feedItemId, commentId, likeId) => {
    const prev = get().items;

    // Optimistic update
    set((state) => ({
      items: state.items.map((item) =>
        item.id === feedItemId
          ? { ...item, comments: mapComment(item.comments, commentId, (c) => ({ ...c, likes: c.likes.filter((l) => l.id !== likeId) })) }
          : item
      ),
    }));

    const { error } = await supabase.from('comment_likes').delete().eq('id', likeId);
    if (error) {
      set({ items: prev });
    }
  },
}));
