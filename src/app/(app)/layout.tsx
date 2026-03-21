'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/use-auth-store';
import { useSessionStore } from '@/stores/use-session-store';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ActiveSessionBanner } from '@/components/session/active-session-banner';
import { CelebrationModal } from '@/components/effects/celebration-modal';
import { ToastContainer } from '@/components/ui/toast';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const initialize = useAuthStore((s) => s.initialize);
  const activeSession = useSessionStore((s) => s.activeSession);
  const showBanner = !!activeSession && pathname !== '/session';

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="h-dvh flex items-center justify-center" style={{ background: '#09090b' }}>
        <div className="text-3xl animate-pulse">🥃</div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col" style={{ background: '#09090b' }}>
      <main className={`flex-1 overflow-y-auto overflow-x-hidden ${showBanner ? 'pb-36' : 'pb-20'}`}>
        <div className="max-w-lg mx-auto w-full">
          {children}
        </div>
      </main>
      <ActiveSessionBanner />
      <BottomNav />
      <CelebrationModal />
      <ToastContainer />
    </div>
  );
}
