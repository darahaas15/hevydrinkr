'use client';

import { motion } from 'framer-motion';
import { ChevronUp, Clock, Wine, MapPin } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useSessionStore } from '@/stores/use-session-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { useTimer } from '@/hooks/use-timer';

export function ActiveSessionBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const activeSession = useSessionStore((s) => s.activeSession);
  const currentUser = useAuthStore((s) => s.currentUser);
  const timer = useTimer(activeSession?.startedAt || null);

  // Only show YOUR active session, not on the session page
  if (!activeSession || !currentUser || activeSession.userId !== currentUser.id || pathname === '/session') return null;

  return (
    <motion.button
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      onClick={() => router.push('/session')}
      className="fixed bottom-[72px] left-0 right-0 z-40 px-4 pb-1"
    >
      <div className="max-w-lg mx-auto rounded-2xl p-3 flex items-center gap-3 shadow-lg" style={{ background: 'rgba(17,17,20,0.95)', border: '1px solid rgba(20,184,166,0.2)', backdropFilter: 'blur(12px)' }}>
        <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
          <Clock className="w-4 h-4 text-accent" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs text-accent font-semibold">Live Session</p>
          <p className="text-[11px] text-zinc-400 truncate flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            {activeSession.venue}
            <span className="text-zinc-600 mx-0.5">·</span>
            <Wine className="w-2.5 h-2.5 shrink-0" />
            {activeSession.drinks.length}
          </p>
        </div>
        <span className="text-sm font-mono font-bold text-accent">{timer.formatted}</span>
        <ChevronUp className="w-4 h-4 text-accent/60 shrink-0" />
      </div>
    </motion.button>
  );
}
