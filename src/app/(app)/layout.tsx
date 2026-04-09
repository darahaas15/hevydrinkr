'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/use-auth-store';
import { useFeedStore } from '@/stores/use-feed-store';
import { useNotificationStore } from '@/stores/use-notification-store';
import { useModerationStore } from '@/stores/use-moderation-store';
import { initPushNotifications } from '@/lib/push-notifications';
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

  // Track on-screen keyboard height into the `--keyboard-height` CSS var
  // so fixed input bars can slide up in lockstep with the keyboard.
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
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_likes' }, () => {
        useFeedStore.getState().fetchFeed(true);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_comments' }, (payload) => {
        if (payload.new.user_id !== currentUser.id) {
          useFeedStore.getState().fetchFeed(true);
        }
      })
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
      <BottomNav />
      <CelebrationModal />
      <ToastContainer />
    </div>
  );
}
