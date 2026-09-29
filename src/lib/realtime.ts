import { supabase } from '@/lib/supabase/client';
import { useFeedStore } from '@/stores/use-feed-store';
import { useNotificationStore } from '@/stores/use-notification-store';

/**
 * The signed-in app's Supabase Realtime channels, shared by the web app shell
 * and the iOS root layout. Each returns a cleanup that tears the channel down.
 *
 * Both auto-resubscribe on channel error / timeout / close, so a Realtime
 * hiccup self-heals.
 */

const RESUBSCRIBE_DELAY_MS = 3000;

function subscribeWithRetry(
  build: () => ReturnType<typeof supabase.channel>,
): () => void {
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let resubscribeTimer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const subscribe = () => {
    if (cancelled) return;
    channel = build().subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (resubscribeTimer) clearTimeout(resubscribeTimer);
        resubscribeTimer = setTimeout(() => {
          if (channel) supabase.removeChannel(channel);
          subscribe();
        }, RESUBSCRIBE_DELAY_MS);
      }
    });
  };

  subscribe();

  return () => {
    cancelled = true;
    if (resubscribeTimer) clearTimeout(resubscribeTimer);
    if (channel) supabase.removeChannel(channel);
  };
}

/**
 * Patches feed state from per-row payloads (no full refetch, so concurrent
 * optimistic updates aren't clobbered).
 */
export function subscribeToFeedRealtime(userId: string): () => void {
  return subscribeWithRetry(() =>
    supabase
      .channel(`feed-realtime-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_items' }, (payload) => {
        useFeedStore.getState().applyFeedItemChange(payload as never, userId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_likes' }, (payload) => {
        useFeedStore.getState().applyLikeChange(payload as never, userId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_comments' }, (payload) => {
        useFeedStore.getState().applyCommentChange(payload as never, userId);
      }),
  );
}

/** Refreshes notifications (and so the unread badge) when a new one arrives. */
export function subscribeToNotificationRealtime(userId: string): () => void {
  return subscribeWithRetry(() =>
    supabase
      .channel(`notifications-realtime-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          useNotificationStore.getState().fetchNotifications(userId, true);
        },
      ),
  );
}

/**
 * The catch-all refresh for anything Realtime missed (service down, lost
 * socket, backgrounded app): run when the app returns to the foreground or
 * comes back online.
 */
export function refreshAfterReturn(userId: string): void {
  useFeedStore.getState().fetchFeed();
  useNotificationStore.getState().fetchNotifications(userId);
}

/** Backstop poll interval for the feed while the app is visible. */
export const FEED_BACKSTOP_POLL_MS = 900_000;
