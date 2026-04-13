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
  const [showNotifBanner, setShowNotifBanner] = useState(false);

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

      // Show notification permission banner if not yet decided
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        setShowNotifBanner(true);
      }
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

  // Supabase Realtime — refresh feed on new posts, likes, comments
  useEffect(() => {
    if (!currentUser?.id) return;
    const channel = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_items' }, (payload) => {
        // Only refresh if someone else posted (our own posts are added optimistically)
        if (payload.new.user_id !== currentUser.id) {
          useFeedStore.getState().fetchFeed(true);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_likes' }, (payload) => {
        // Only refetch for others' likes — our own are applied optimistically
        if (payload.new.user_id !== currentUser.id) {
          useFeedStore.getState().fetchFeed(true);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_comments' }, (payload) => {
        if (payload.new.user_id !== currentUser.id) {
          useFeedStore.getState().fetchFeed(true);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  // Supabase Realtime — update unread badge when new notifications arrive
  useEffect(() => {
    if (!currentUser?.id) return;
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` },
        () => {
          useNotificationStore.getState().fetchNotifications(currentUser.id);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  // Show spinner only on very first load (no cached auth data).
  // With persist, isAuthenticated is hydrated from localStorage instantly.
  if (!isAuthenticated && isLoading) {
    return <SplashScreen />;
  }

  if (!isAuthenticated) return null;

  return (
    <div className="h-dvh flex flex-col" style={{ background: '#09090b' }}>
      <main className={`relative flex-1 overflow-y-auto overflow-x-hidden overscroll-contain ${hideBottomNav ? '' : 'pb-20'}`}>
        <div className="max-w-lg mx-auto w-full">
          {children}
        </div>
      </main>
      {showNotifBanner && currentUser?.id && (
        <div className="fixed top-0 left-0 right-0 z-[60] safe-top" style={{ background: 'linear-gradient(135deg, #14b8a6, #06b6d4)' }}>
          <div className="px-4 py-3 flex items-center gap-3">
            <p className="text-sm font-medium text-black flex-1">Enable notifications to know when friends interact with your posts</p>
            <button
              onClick={() => {
                setShowNotifBanner(false);
                requestWebPushPermission(currentUser.id);
              }}
              className="px-4 py-1.5 rounded-full bg-black/20 text-xs font-semibold text-white shrink-0 active:bg-black/30"
            >
              Enable
            </button>
            <button
              onClick={() => setShowNotifBanner(false)}
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
