'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/use-auth-store';
import { useModerationStore } from '@/stores/use-moderation-store';
import { hapticSelection, hapticLight } from '@/lib/haptics';
import { ErrorBanner } from '@/components/ui/error-banner';
import { buildLeaderboard } from '@/lib/algorithms/leaderboard';
import { Avatar } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase/client';
import type { LeaderboardMetric, LeaderboardTimeframe, FeedItem } from '@/types';

const METRICS: { value: LeaderboardMetric; label: string }[] = [
  { value: 'total_standard_drinks', label: 'Drinks' },
  { value: 'total_sessions', label: 'Sessions' },
  { value: 'longest_session', label: 'Longest' },
  { value: 'most_diverse', label: 'Variety' },
  { value: 'single_session', label: 'Single Session' },
];

const TIMEFRAMES: { value: LeaderboardTimeframe; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all-time', label: 'All Time' },
];

// Slim leaderboard row — only the fields buildLeaderboard needs. Pulled
// directly from the DB so rankings reflect ALL posts, not just whatever's
// in the paginated feed cache.
type LeaderboardPostRow = {
  user_id: string;
  session_summary: FeedItem['sessionSummary'];
  created_at: string;
};

const LEADERBOARD_STALE_MS = 30_000;

export default function LeaderboardPage() {
  const router = useRouter();
  const [metric, setMetric] = useState<LeaderboardMetric>('total_standard_drinks');
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>('week');
  const allUsers = useAuthStore((s) => s.allUsers);
  const fetchAllUsers = useAuthStore((s) => s.fetchAllUsers);
  const currentUser = useAuthStore((s) => s.currentUser);
  const blockedUserIds = useModerationStore((s) => s.blockedUserIds);

  const [posts, setPosts] = useState<FeedItem[] | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);

  const circleUsers = useMemo(() => {
    if (!currentUser) return [];
    const followingSet = new Set(currentUser.following);
    followingSet.add(currentUser.id);
    const blockedSet = new Set(blockedUserIds);
    return allUsers.filter((u) => followingSet.has(u.id) && !blockedSet.has(u.id));
  }, [allUsers, currentUser, blockedUserIds]);

  const circleIds = useMemo(() => circleUsers.map((u) => u.id), [circleUsers]);
  const circleIdsKey = circleIds.join(',');

  const staleRef = useRef({ key: '', at: 0 });

  const loadLeaderboard = useCallback(async (force?: boolean) => {
    if (circleIds.length === 0) {
      setPosts([]);
      return;
    }
    const key = `${circleIdsKey}|${timeframe}`;
    if (!force && key === staleRef.current.key && Date.now() - staleRef.current.at < LEADERBOARD_STALE_MS) return;
    staleRef.current = { key, at: Date.now() };

    let query = supabase
      .from('feed_items')
      .select('user_id, session_summary, created_at')
      .in('user_id', circleIds);

    if (timeframe !== 'all-time') {
      const sinceMs = timeframe === 'week' ? 7 * 86400000 : 30 * 86400000;
      query = query.gte('created_at', new Date(Date.now() - sinceMs).toISOString());
    }

    const { data, error } = await query;
    if (error || !data) {
      setPostsError(error?.message ?? 'Failed to load leaderboard');
      return;
    }
    setPostsError(null);
    // buildLeaderboard reads only id-less fields from FeedItem, so we adapt
    // the slim row into a minimal FeedItem-shaped object.
    const rows = data as unknown as LeaderboardPostRow[];
    setPosts(rows.map((r) => ({
      id: '',
      userId: r.user_id,
      userName: '',
      userAvatar: null,
      sessionId: '',
      sessionSummary: r.session_summary,
      photos: [],
      caption: '',
      likes: [],
      comments: [],
      createdAt: r.created_at,
      isBackfilled: false,
    })));
  }, [circleIds, circleIdsKey, timeframe]);

  useEffect(() => {
    fetchAllUsers();
    // Defer to a microtask so any sync setState inside loadLeaderboard
    // doesn't fire during the effect body (avoids cascading renders).
    Promise.resolve().then(() => loadLeaderboard());
    const refetch = () => { fetchAllUsers(true); loadLeaderboard(true); };
    window.addEventListener('focus', refetch);
    return () => window.removeEventListener('focus', refetch);
  }, [fetchAllUsers, loadLeaderboard]);

  const leaderboard = useMemo(
    () => buildLeaderboard(posts ?? [], circleUsers, metric, timeframe),
    [posts, circleUsers, metric, timeframe]
  );

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-5 pt-3 pb-0">
          <h1 className="text-xl font-extrabold flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-accent" />
            Leaderboard
          </h1>

          {/* Metrics */}
          <div className="flex gap-1.5 mb-2.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {METRICS.map((m) => (
              <button
                key={m.value}
                onClick={() => { hapticSelection(); setMetric(m.value); }}
                className={`px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap active:scale-[0.97] ${
                  metric === m.value
                    ? 'bg-accent text-black'
                    : 'bg-white/[0.04] text-zinc-500'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Timeframe */}
          <div className="flex gap-1 pb-3">
            {TIMEFRAMES.map((t) => (
              <button
                key={t.value}
                onClick={() => { hapticSelection(); setTimeframe(t.value); }}
                className={`flex-1 py-2.5 text-center text-[11px] font-medium rounded-lg transition-all active:scale-[0.97] ${
                  timeframe === t.value ? 'text-white bg-white/[0.06]' : 'text-zinc-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {postsError && <ErrorBanner message={postsError} onRetry={() => loadLeaderboard(true)} />}

      {/* Rankings */}
      <div className="px-4 py-4">
        {posts === null && !postsError ? (
          <div className="space-y-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 flex items-center gap-3 animate-pulse">
                <div className="w-8 h-4 rounded bg-white/5" />
                <div className="w-8 h-8 rounded-full bg-white/5" />
                <div className="flex-1 h-3.5 rounded bg-white/5 max-w-[120px]" />
                <div className="w-12 h-3.5 rounded bg-white/5 ml-auto" />
              </div>
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Trophy className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-zinc-600 text-sm">No data for this timeframe</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {leaderboard.map((entry, i) => {
              const isMe = entry.userId === currentUser?.id;
              const rankDisplay = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${entry.rank}`;

              return (
                <div key={entry.userId} onClick={() => { hapticLight(); router.push(isMe ? '/profile' : `/profile/${entry.userId}`); }}>
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  className={`leaderboard-entry rounded-xl p-3 flex items-center gap-3 cursor-pointer active:bg-white/[0.05] transition-colors ${
                    isMe
                      ? 'bg-accent/[0.06] border border-accent/10'
                      : 'bg-white/[0.02] border border-white/[0.04]'
                  }`}
                >
                  <span className={`text-sm font-bold w-8 text-center ${
                    i < 3 ? 'text-base' : 'text-zinc-600'
                  }`}>
                    {rankDisplay}
                  </span>
                  <Avatar name={entry.userName} size="sm" src={entry.userAvatar} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isMe ? 'text-accent' : ''}`}>
                      {isMe ? 'You' : entry.userName}
                    </p>
                  </div>
                  <span className="text-sm font-mono text-zinc-400">{entry.formattedValue}</span>
                  {entry.trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-green-500" />}
                  {entry.trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                  {entry.trend === 'same' && <Minus className="w-3 h-3 text-zinc-700" />}
                </motion.div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
