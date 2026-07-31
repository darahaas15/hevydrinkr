'use client';

import { useEffect, memo, useMemo } from 'react';
import { Home, Users, Trophy, User, Wine, Clock, MapPin, ChevronRight, Plus } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useSessionStore } from '@/stores/use-session-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { useUIStore } from '@/stores/use-ui-store';
import {
  useDrinkPrefsStore,
  selectPrefs,
  selectRecents,
  selectCost,
  entryFromQuickDrink,
} from '@/stores/use-drink-prefs-store';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { useTimer } from '@/hooks/use-timer';

const tabs = [
  { icon: Home, path: '/feed', label: 'Feed' },
  { icon: Users, path: '/groups', label: 'Groups' },
  { icon: Wine, path: '/session', label: 'Sesh', isCenter: true },
  { icon: Trophy, path: '/leaderboard', label: 'Board' },
  { icon: User, path: '/profile', label: 'Profile' },
];

// Isolated component so the 1s timer tick doesn't re-render the tab bar
const SessionBanner = memo(function SessionBanner({ onNavigate }: { onNavigate: (path: string) => void }) {
  const activeSession = useSessionStore((s) => s.activeSession);
  const addDrink = useSessionStore((s) => s.addDrink);
  const removeDrink = useSessionStore((s) => s.removeDrink);
  const currentUser = useAuthStore((s) => s.currentUser);
  const addToast = useUIStore((s) => s.addToast);
  const pathname = usePathname();
  const timer = useTimer(activeSession?.startedAt || null);

  const userId = currentUser?.id;
  const byUser = useDrinkPrefsStore((s) => s.byUser);
  const recordUse = useDrinkPrefsStore((s) => s.recordUse);
  const prefs = useMemo(() => selectPrefs(byUser, userId), [byUser, userId]);
  const lastDrink = useMemo(() => selectRecents(prefs, 1)[0] ?? null, [prefs]);

  const show = !!activeSession && !!currentUser && activeSession.userId === currentUser.id && pathname !== '/session';
  if (!show) return null;

  // Re-log the most recent drink without leaving the current screen. Paired
  // with an undo because this button sits under the thumb on every tab.
  const quickLog = () => {
    if (!lastDrink || !userId) return;
    hapticMedium();
    const entry = entryFromQuickDrink(lastDrink, selectCost(prefs, lastDrink.definitionId));
    recordUse(userId, lastDrink);
    addDrink(entry);
    addToast(`${lastDrink.name} logged`, {
      type: 'success',
      durationMs: 6000,
      action: { label: 'Undo', onPress: () => removeDrink(entry.id) },
    });
  };

  return (
    <div
      className="w-full px-4 py-2 flex items-center gap-2"
      style={{ borderBottom: '1px solid rgba(20,184,166,0.15)', background: 'rgba(20,184,166,0.05)' }}
    >
      <button
        onClick={() => onNavigate('/session')}
        className="flex-1 min-w-0 flex items-center gap-3 text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
          <Clock className="w-3.5 h-3.5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-accent font-semibold">Live Session</p>
          <p className="text-[10px] text-fg-secondary truncate flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            {activeSession!.venue}
            <span className="text-fg-faint mx-0.5">·</span>
            <Wine className="w-2.5 h-2.5 shrink-0" />
            {activeSession!.drinks.length}
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-accent">{timer.formatted}</span>
        <ChevronRight className="w-3.5 h-3.5 text-accent/50 shrink-0" />
      </button>

      {lastDrink && (
        <button
          onClick={quickLog}
          aria-label={`Log another ${lastDrink.name}`}
          className="shrink-0 h-9 pl-1.5 pr-2 rounded-xl bg-accent/15 border border-accent/25 flex items-center gap-0.5 active:bg-accent/25 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-accent" />
          <DrinkIcon category={lastDrink.category} className="w-4 h-4" />
        </button>
      )}
    </div>
  );
});

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const hideBottomNav = useUIStore((s) => s.hideBottomNav);
  const activeSession = useSessionStore((s) => s.activeSession);

  // Prefetch all tab routes for instant switching
  useEffect(() => {
    tabs.forEach(tab => router.prefetch(tab.path));
  }, [router]);

  if (hideBottomNav) return null;

  const navigate = (path: string) => {
    hapticLight();
    router.push(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 vt-bottom-nav"
      style={{
        background: 'var(--chrome-bg)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        borderTop: '1px solid var(--chrome-border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <SessionBanner onNavigate={navigate} />

      {/* Tab bar */}
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = tab.path === '/profile'
            ? pathname === '/profile' || pathname.startsWith('/profile/settings')
            : pathname.startsWith(tab.path);
          const Icon = tab.icon;

          if (tab.isCenter) {
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                aria-label={tab.label}
                className="relative flex flex-col items-center justify-center -mt-5"
              >
                <div className={cn(
                  'w-13 h-13 rounded-2xl flex items-center justify-center transition-all',
                  isActive
                    ? 'bg-accent shadow-[0_0_20px_rgba(20,184,166,0.25)]'
                    : activeSession ? 'bg-accent/80' : 'bg-chip'
                )}>
                  <Icon size={22} className={isActive || activeSession ? 'text-accent-foreground' : 'text-muted-foreground'} />
                </div>
                <span className={cn(
                  'text-[10px] mt-1 font-medium',
                  isActive ? 'text-accent' : 'text-muted'
                )}>
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              aria-label={tab.label}
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-4 min-w-[48px] min-h-[48px]"
            >
              <Icon
                size={20}
                className={cn(
                  'transition-colors',
                  isActive ? 'text-foreground' : 'text-muted'
                )}
              />
              <span className={cn(
                'text-[10px] font-medium transition-colors',
                isActive ? 'text-foreground' : 'text-muted'
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
