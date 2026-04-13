import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase/client';

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
  groupJoinsEnabled: boolean;
  roastsEnabled: boolean;
  sessionRemindersEnabled: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  likesEnabled: true,
  commentsEnabled: true,
  followsEnabled: true,
  groupJoinsEnabled: true,
  roastsEnabled: true,
  sessionRemindersEnabled: true,
};

interface NotificationState {
  notifications: Notification[];
  preferences: NotificationPreferences;
  unreadCount: number;
  loading: boolean;

  fetchNotifications: (userId: string) => Promise<void>;
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

  fetchNotifications: async (userId) => {
    set({ loading: true });

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Failed to fetch notifications:', error);
      set({ loading: false });
      return;
    }

    // Batch-fetch actor profiles
    const actorIds = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
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

    const notifications: Notification[] = (data ?? []).map((row) => {
      const actor = row.actor_id ? actorMap.get(row.actor_id) : null;
      return {
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        data: row.data ?? {},
        read: row.read,
        createdAt: row.created_at,
        actorId: row.actor_id ?? null,
        actorDisplayName: actor?.display_name ?? null,
        actorAvatarUrl: actor?.avatar_url ?? null,
      };
    });

    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      loading: false,
    });
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
          groupJoinsEnabled: data.group_joins_enabled,
          roastsEnabled: data.challenges_enabled,
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
    if (updates.groupJoinsEnabled !== undefined) dbUpdates.group_joins_enabled = updates.groupJoinsEnabled;
    if (updates.roastsEnabled !== undefined) dbUpdates.challenges_enabled = updates.roastsEnabled;
    if (updates.sessionRemindersEnabled !== undefined) dbUpdates.session_reminders_enabled = updates.sessionRemindersEnabled;

    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: userId, ...dbUpdates }, { onConflict: 'user_id' });

    if (error) {
      console.error('Failed to update notification preferences:', error);
      set({ preferences: prev });
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
  partialize: (s) => ({
    preferences: s.preferences,
    unreadCount: s.unreadCount,
  }),
}));
