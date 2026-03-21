'use client';

import { Home, Users, Trophy, User, Wine } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { icon: Home, path: '/feed', label: 'Feed' },
  { icon: Users, path: '/groups', label: 'Groups' },
  { icon: Wine, path: '/session', label: 'Sesh', isCenter: true },
  { icon: Trophy, path: '/leaderboard', label: 'Board' },
  { icon: User, path: '/profile', label: 'Profile' },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 safe-bottom"
      style={{
        background: 'rgba(9, 9, 11, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.path);
          const Icon = tab.icon;

          if (tab.isCenter) {
            return (
              <button
                key={tab.path}
                onClick={() => router.push(tab.path)}
                className="relative flex flex-col items-center justify-center -mt-5"
              >
                <div className={cn(
                  'w-13 h-13 rounded-2xl flex items-center justify-center transition-all',
                  isActive
                    ? 'bg-accent shadow-[0_0_20px_rgba(20,184,166,0.25)]'
                    : 'bg-zinc-800'
                )}>
                  <Icon size={22} className={isActive ? 'text-black' : 'text-zinc-400'} />
                </div>
                <span className={cn(
                  'text-[10px] mt-1 font-medium',
                  isActive ? 'text-accent' : 'text-zinc-600'
                )}>
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.path}
              onClick={() => router.push(tab.path)}
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-4 min-w-[48px] min-h-[48px]"
            >
              <Icon
                size={20}
                className={cn(
                  'transition-colors',
                  isActive ? 'text-white' : 'text-zinc-600'
                )}
              />
              <span className={cn(
                'text-[10px] font-medium transition-colors',
                isActive ? 'text-white' : 'text-zinc-600'
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
