import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '@/stores/use-auth-store';
import { useSessionStore } from '@/stores/use-session-store';
import { useProfileStore } from '@/stores/use-profile-store';
import { useFeedStore } from '@/stores/use-feed-store';

/**
 * Loads what the Sesh tab reads: your session history (recents, venue
 * suggestions), personal records (PR detection on ending) and your posts (the
 * "vs your avg" pace). Refetches when the app returns to the foreground, as
 * the web page does on window focus. Returns whether history is still loading.
 */
export function useSessionHistory(): boolean {
  const userId = useAuthStore((s) => s.currentUser?.id);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    useSessionStore.getState().fetchSessions(userId).finally(() => setLoading(false));
    useProfileStore.getState().fetchPRs(userId);
    useFeedStore.getState().fetchUserPosts(userId);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      useSessionStore.getState().fetchSessions(userId, true);
      useProfileStore.getState().fetchPRs(userId, true);
      useFeedStore.getState().fetchUserPosts(userId, true);
    });
    return () => subscription.remove();
  }, [userId]);

  return loading;
}
