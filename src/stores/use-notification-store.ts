import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase/client';
import { useUIStore } from '@/stores/use-ui-store';
import { safeJSONStorage } from '@/lib/storage/safe-storage';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
  actorId: string | null;
  actorDisplayName: string | null;
  actorAvatarUrl: string | null;
}

export interface NotificationPreferences {
  likesEnabled: boolean;
  commentsEnabled: boolean;
  followsEnabled: boolean;
  tagsEnabled: boolean;
  groupJoinsEnabled: boolean;
  roastsEnabled: boolean;
  newPostsEnabled: boolean;
  sessionRemindersEnabled: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  likesEnabled: true,
  commentsEnabled: true,
  followsEnabled: true,
  tagsEnabled: true,
  groupJoinsEnabled: true,
  roastsEnabled: true,
  newPostsEnabled: true,
  sessionRemindersEnabled: true,
};

const NOTIFICATIONS_STALE_MS = 30_000;
const NOTIFICATIONS_PAGE_SIZE = 50;
const _notificationsLastFetched = new Map<string, number>();
const COMMENT_TYPES = ['comment', 'reply', 'mention'];

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
  actor_id: string | null;
};

// Hydrate raw rows with actor profiles + comment-preview backfill, then
// project into the public Notification shape.
async function hydrateNotificationRows(rows: NotificationRow[]): Promise<Notification[]> {
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const actorMap = new Map<string, { display_name: string; avatar_url: string | null }>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', actorIds);
    for (const p of profiles ?? []) {
      actorMap.set(p.id, p);
    }
  }

  const needsPreview = rows.filter(
    (r) => COMMENT_TYPES.includes(r.type) && r.data?.commentId && !r.data?.commentPreview,
  );
  const commentMap = new Map<string, string>();
  if (needsPreview.length > 0) {
    const commentIds = needsPreview.map((r) => r.data!.commentId as string);
    const { data: comments } = await supabase
      .from('feed_comments')
      .select('id, text')
      .in('id', commentIds);
    for (const c of comments ?? []) {
      commentMap.set(c.id, (c.text ?? '').slice(0, 100));
    }
  }

  return rows.map((row) => {
    const actor = row.actor_id ? actorMap.get(row.actor_id) : null;
    const rowData = { ...(row.data ?? {}) } as Record<string, unknown>;
    if (COMMENT_TYPES.includes(row.type) && rowData.commentId && !rowData.commentPreview) {
      const preview = commentMap.get(rowData.commentId as string);
      if (preview) rowData.commentPreview = preview;
    }
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      data: rowData,
      read: row.read,
      createdAt: row.created_at,
      actorId: row.actor_id ?? null,
      actorDisplayName: actor?.display_name ?? null,
      actorAvatarUrl: actor?.avatar_url ?? null,
    };
  });
}

interface NotificationState {
  notifications: Notification[];
  preferences: NotificationPreferences;
  unreadCount: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;

  fetchNotifications: (userId: string, force?: boolean) => Promise<void>;
  fetchMoreNotifications: (userId: string) => Promise<void>;
  fetchPreferences: (userId: string) => Promise<void>;
  updatePreferences: (userId: string, updates: Partial<NotificationPreferences>) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>()(persist((set, get) => ({
  notifications: [],
  preferences: DEFAULT_PREFS,
  unreadCount: 0,
  loading: false,
  loadingMore: false,
  hasMore: true,

  fetchNotifications: async (userId, force) => {
    if (!userId) return;
    const last = _notificationsLastFetched.get(userId) ?? 0;
    if (!force && Date.now() - last < NOTIFICATIONS_STALE_MS) return;
    _notificationsLastFetched.set(userId, Date.now());
    if (get().notifications.length === 0) set({ loading: true });

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(NOTIFICATIONS_PAGE_SIZE);

    if (error) {
      console.error('Failed to fetch notifications:', error);
      set({ loading: false });
      return;
    }

    const rows = (data ?? []) as NotificationRow[];
    const notifications = await hydrateNotificationRows(rows);

    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      loading: false,
      hasMore: rows.length === NOTIFICATIONS_PAGE_SIZE,
    });
  },

  fetchMoreNotifications: async (userId) => {
    const { notifications, loadingMore, hasMore } = get();
    if (!userId || loadingMore || !hasMore || notifications.length === 0) return;

    set({ loadingMore: true });
    const lastNotification = notifications[notifications.length - 1];

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .lt('created_at', lastNotification.createdAt)
      .limit(NOTIFICATIONS_PAGE_SIZE);

    if (error) {
      console.error('Failed to fetch more notifications:', error);
      set({ loadingMore: false });
      return;
    }

    const rows = (data ?? []) as NotificationRow[];
    const more = await hydrateNotificationRows(rows);
    set((state) => ({
      notifications: [...state.notifications, ...more],
      loadingMore: false,
      hasMore: rows.length === NOTIFICATIONS_PAGE_SIZE,
    }));
  },

  fetchPreferences: async (userId) => {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch notification preferences:', error);
      return;
    }

    if (data) {
      set({
        preferences: {
          likesEnabled: data.likes_enabled,
          commentsEnabled: data.comments_enabled,
          followsEnabled: data.follows_enabled,
          tagsEnabled: data.tags_enabled ?? true,
          groupJoinsEnabled: data.group_joins_enabled,
          roastsEnabled: data.challenges_enabled,
          newPostsEnabled: data.new_posts_enabled ?? true,
          sessionRemindersEnabled: data.session_reminders_enabled,
        },
      });
    }
  },

  updatePreferences: async (userId, updates) => {
    const prev = get().preferences;
    const merged = { ...prev, ...updates };
    set({ preferences: merged });

    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.likesEnabled !== undefined) dbUpdates.likes_enabled = updates.likesEnabled;
    if (updates.commentsEnabled !== undefined) dbUpdates.comments_enabled = updates.commentsEnabled;
    if (updates.followsEnabled !== undefined) dbUpdates.follows_enabled = updates.followsEnabled;
    if (updates.tagsEnabled !== undefined) dbUpdates.tags_enabled = updates.tagsEnabled;
    if (updates.groupJoinsEnabled !== undefined) dbUpdates.group_joins_enabled = updates.groupJoinsEnabled;
    if (updates.roastsEnabled !== undefined) dbUpdates.challenges_enabled = updates.roastsEnabled;
    if (updates.newPostsEnabled !== undefined) dbUpdates.new_posts_enabled = updates.newPostsEnabled;
    if (updates.sessionRemindersEnabled !== undefined) dbUpdates.session_reminders_enabled = updates.sessionRemindersEnabled;

    // Use update (not upsert) to avoid RLS INSERT policy issues
    const { data, error } = await supabase
      .from('notification_preferences')
      .update(dbUpdates)
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error('Failed to update notification preferences:', error);
      set({ preferences: prev });
      useUIStore.getState().addToast('Something went wrong', 'error');
      return;
    }

    // Row doesn't exist yet — seed it with all current preferences
    if (!data || data.length === 0) {
      const { error: insertErr } = await supabase
        .from('notification_preferences')
        .insert({
          user_id: userId,
          likes_enabled: merged.likesEnabled,
          comments_enabled: merged.commentsEnabled,
          follows_enabled: merged.followsEnabled,
          tags_enabled: merged.tagsEnabled,
          group_joins_enabled: merged.groupJoinsEnabled,
          challenges_enabled: merged.roastsEnabled,
          new_posts_enabled: merged.newPostsEnabled,
          session_reminders_enabled: merged.sessionRemindersEnabled,
          updated_at: new Date().toISOString(),
        });

      if (insertErr) {
        console.error('Failed to create notification preferences:', insertErr);
        set({ preferences: prev });
        useUIStore.getState().addToast(`Pref update failed: ${insertErr.message}`, 'error');
      }
    }
  },

  markAsRead: async (notificationId) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Failed to mark notification as read:', error);
    }
  },

  markAllAsRead: async (userId) => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  },
}), {
  name: 'hd-notifications',
  storage: safeJSONStorage(),
  partialize: (s) => ({
    preferences: s.preferences,
    unreadCount: s.unreadCount,
  }),
}));
