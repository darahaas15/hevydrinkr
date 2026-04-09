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
}

export interface NotificationPreferences {
  likesEnabled: boolean;
  commentsEnabled: boolean;
  followsEnabled: boolean;
  groupJoinsEnabled: boolean;
  challengesEnabled: boolean;
  sessionRemindersEnabled: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  likesEnabled: true,
  commentsEnabled: true,
  followsEnabled: true,
  groupJoinsEnabled: true,
  challengesEnabled: true,
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

    const notifications: Notification[] = (data ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      data: row.data ?? {},
      read: row.read,
      createdAt: row.created_at,
    }));

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
          challengesEnabled: data.challenges_enabled,
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
    if (updates.challengesEnabled !== undefined) dbUpdates.challenges_enabled = updates.challengesEnabled;
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
