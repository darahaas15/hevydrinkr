'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/use-auth-store';
import { useSessionStore } from '@/stores/use-session-store';
import { buildVenueStats, type VenueStat } from '@/lib/venues';

/**
 * The signed-in user's venues, most-recently-visited first.
 *
 * Derived from the sessions already in the store — no extra query, and it
 * warms up as soon as any screen has called `fetchSessions`. Callers that
 * render before that simply get an empty list and no suggestions.
 */
export function useVenueStats(): VenueStat[] {
  const userId = useAuthStore((s) => s.currentUser?.id);
  const sessionsByUser = useSessionStore((s) => s.sessionsByUser);

  return useMemo(
    () => buildVenueStats(userId ? sessionsByUser[userId] ?? [] : []),
    [userId, sessionsByUser],
  );
}
