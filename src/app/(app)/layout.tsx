'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/use-auth-store';
import { useFeedStore } from '@/stores/use-feed-store';
import { useNotificationStore } from '@/stores/use-notification-store';
import { useModerationStore } from '@/stores/use-moderation-store';
import { initPushNotifications, requestWebPushPermission } from '@/lib/push-notifications';
import { supabase } from '@/lib/supabase/client';
import { BottomNav } from '@/components/layout/bottom-nav';
import { useUIStore } from '@/stores/use-ui-store';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { SplashScreen } from '@/components/ui/splash-screen';

const CelebrationModal = dynamic(() => import('@/components/effects/celebration-modal').then((m) => m.CelebrationModal), { ssr: false });
const ToastContainer = dynamic(() => import('@/components/ui/toast').then((m) => m.ToastContainer), { ssr: false });

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const currentUser = useAuthStore((s) => s.currentUser);
  const initialize = useAuthStore((s) => s.initialize);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const fetchPreferences = useNotificationStore((s) => s.fetchPreferences);
  const fetchBlockedUsers = useModerationStore((s) => s.fetchBlockedUsers);
  const hideBottomNav = useUIStore((s) => s.hideBottomNav);
  const lockMainScroll = useUIStore((s) => s.lockMainScroll);
  const [notifBannerDismissedUserId, setNotifBannerDismissedUserId] = useState<string | null>(null);

  // Toggle a `keyboard-open` class on <html> when the soft keyboard is
  // visible, so fixed input bars can adjust safe-area padding.
  useKeyboardHeight();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Init push notifications + fetch user data once we have a user
  useEffect(() => {
    if (currentUser?.id) {
      initPushNotifications(currentUser.id);
      fetchNotifications(currentUser.id);
      fetchPreferences(currentUser.id);
      fetchBlockedUsers(currentUser.id);
    }
  }, [currentUser?.id, fetchNotifications, fetchPreferences, fetchBlockedUsers]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  // Listen for service worker navigation messages so deep-links from
  // push notifications go through Next.js router (preserves history stack).
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE' && event.data.path) {
        router.push(event.data.path);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [router]);

  // Online/offline connectivity detection
  useEffect(() => {
    const setOffline = useUIStore.getState().setOffline;
    const addToast = useUIStore.getState().addToast;

    const goOffline = () => {
      setOffline(true);
      addToast('You are offline', 'error');
    };
    const goOnline = () => {
      setOffline(false);
      addToast('Back online', 'success');
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // Supabase Realtime — patch feed state from per-row payloads (no full
  // refetch so concurrent optimistic updates aren't clobbered). Auto-resubscribes
  // on channel error / timeout / close so a Realtime hiccup self-heals.
  useEffect(() => {
    if (!currentUser?.id) return;
    const userId = currentUser.id;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let resubscribeTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const subscribe = () => {
      if (cancelled) return;
      channel = supabase
        .channel(`feed-realtime-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_items' }, (payload) => {
          useFeedStore.getState().applyFeedItemChange(payload as never, userId);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_likes' }, (payload) => {
          useFeedStore.getState().applyLikeChange(payload as never, userId);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_comments' }, (payload) => {
          useFeedStore.getState().applyCommentChange(payload as never, userId);
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (resubscribeTimer) clearTimeout(resubscribeTimer);
            resubscribeTimer = setTimeout(() => {
              if (channel) supabase.removeChannel(channel);
              subscribe();
            }, 3000);
          }
        });
    };

    subscribe();

    return () => {
      cancelled = true;
      if (resubscribeTimer) clearTimeout(resubscribeTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  // Supabase Realtime — update unread badge when new notifications arrive.
  // Same auto-resubscribe pattern as the feed channel.
  useEffect(() => {
    if (!currentUser?.id) return;
    const userId = currentUser.id;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let resubscribeTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const subscribe = () => {
      if (cancelled) return;
      channel = supabase
        .channel(`notifications-realtime-${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          () => {
            useNotificationStore.getState().fetchNotifications(userId, true);
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (resubscribeTimer) clearTimeout(resubscribeTimer);
            resubscribeTimer = setTimeout(() => {
              if (channel) supabase.removeChannel(channel);
              subscribe();
            }, 3000);
          }
        });
    };

    subscribe();

    return () => {
      cancelled = true;
      if (resubscribeTimer) clearTimeout(resubscribeTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  // Bulletproof fallback: refetch on tab/app focus, online, or visibility return.
  // Catches anything Realtime missed — service down, lost socket, backgrounded tab.
  useEffect(() => {
    if (!currentUser?.id) return;
    const userId = currentUser.id;
    const refresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      useFeedStore.getState().fetchFeed(true);
      useNotificationStore.getState().fetchNotifications(userId, true);
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [currentUser?.id]);

  // Backstop poll while tab is visible — covers the case where Realtime is
  // silently broken and the user never switches tabs.
  useEffect(() => {
    if (!currentUser?.id) return;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        useFeedStore.getState().fetchFeed(true);
      }
    }, 300_000);
    return () => clearInterval(id);
  }, [currentUser?.id]);

  // Show spinner only on very first load (no cached auth data).
  // With persist, isAuthenticated is hydrated from localStorage instantly.
  if (!isAuthenticated && isLoading) {
    return <SplashScreen />;
  }

  if (!isAuthenticated) return null;

  const shouldShowNotifBanner = Boolean(
    !hideBottomNav &&
    currentUser?.id &&
    notifBannerDismissedUserId !== currentUser.id &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'default'
  );

  return (
    <div className="h-dvh flex flex-col" style={{ background: '#09090b' }}>
      <main
        className={`relative flex-1 overflow-x-hidden ${
          lockMainScroll ? 'overflow-hidden overscroll-none' : 'overflow-y-auto overscroll-contain'
        } ${hideBottomNav ? '' : 'pb-20'}`}
      >
        <div className="max-w-lg mx-auto w-full">
          {children}
        </div>
      </main>
      {shouldShowNotifBanner && currentUser?.id && (
        <div className="fixed top-0 left-0 right-0 z-[60] safe-top" style={{ background: 'linear-gradient(135deg, #14b8a6, #06b6d4)' }}>
          <div className="px-4 py-3 flex items-center gap-3">
            <p className="text-sm font-medium text-black flex-1">Enable notifications to know when friends interact with your posts</p>
            <button
              onClick={() => {
                setNotifBannerDismissedUserId(currentUser.id);
                requestWebPushPermission(currentUser.id);
              }}
              className="px-4 py-1.5 rounded-full bg-black/20 text-xs font-semibold text-white shrink-0 active:bg-black/30"
            >
              Enable
            </button>
            <button
              onClick={() => setNotifBannerDismissedUserId(currentUser.id)}
              className="text-black/60 text-lg font-bold leading-none px-1"
            >
              &times;
            </button>
          </div>
        </div>
      )}
      <BottomNav />
      <CelebrationModal />
      <ToastContainer />
    </div>
  );
}
