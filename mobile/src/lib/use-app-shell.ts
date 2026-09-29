import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '@/stores/use-auth-store';
import { useFeedStore } from '@/stores/use-feed-store';
import { useNotificationStore } from '@/stores/use-notification-store';
import { useModerationStore } from '@/stores/use-moderation-store';
import {
  FEED_BACKSTOP_POLL_MS,
  refreshAfterReturn,
  subscribeToFeedRealtime,
  subscribeToNotificationRealtime,
} from '@/lib/realtime';

/**
 * The signed-in app's background work, mirroring the web app shell
 * (src/app/(app)/layout.tsx): first-load fetches, the shared Realtime channels,
 * a refresh when the app returns to the foreground, and a slow backstop poll.
 */
export function useAppShell() {
  const userId = useAuthStore((s) => s.currentUser?.id);

  useEffect(() => {
    if (!userId) return;
    useNotificationStore.getState().fetchNotifications(userId);
    useNotificationStore.getState().fetchPreferences(userId);
    useModerationStore.getState().fetchBlockedUsers(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const unsubscribeFeed = subscribeToFeedRealtime(userId);
    const unsubscribeNotifications = subscribeToNotificationRealtime(userId);
    return () => {
      unsubscribeFeed();
      unsubscribeNotifications();
    };
  }, [userId]);

  // Coming back from the background catches anything Realtime missed while
  // iOS had the app suspended.
  useEffect(() => {
    if (!userId) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshAfterReturn(userId);
    });
    return () => subscription.remove();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const id = setInterval(() => {
      if (AppState.currentState === 'active') useFeedStore.getState().fetchFeed();
    }, FEED_BACKSTOP_POLL_MS);
    return () => clearInterval(id);
  }, [userId]);
}
