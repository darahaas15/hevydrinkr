'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useSessionStore } from '@/stores/use-session-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { buildLeaderboard } from '@/lib/algorithms/leaderboard';
import { Avatar } from '@/components/ui/avatar';
import type { LeaderboardMetric, LeaderboardTimeframe } from '@/types';

const METRICS: { value: LeaderboardMetric; label: string }[] = [
  { value: 'total_standard_drinks', label: 'Drinks' },
  { value: 'total_sessions', label: 'Sessions' },
  { value: 'longest_session', label: 'Longest' },
  { value: 'most_diverse', label: 'Variety' },
  { value: 'most_rounds_bought', label: 'Rounds' },
];

const TIMEFRAMES: { value: LeaderboardTimeframe; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all-time', label: 'All Time' },
];

export default function LeaderboardPage() {
  const [metric, setMetric] = useState<LeaderboardMetric>('total_standard_drinks');
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>('all-time');
  const sessionHistory = useSessionStore((s) => s.sessionHistory);
  const allUsers = useAuthStore((s) => s.allUsers);
  const currentUser = useAuthStore((s) => s.currentUser);

  const leaderboard = useMemo(
    () => buildLeaderboard(sessionHistory, allUsers, metric, timeframe),
    [sessionHistory, allUsers, metric, timeframe]
  );

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
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
                onClick={() => setMetric(m.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
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
                onClick={() => setTimeframe(t.value)}
                className={`flex-1 py-1.5 text-center text-[11px] font-medium rounded-lg transition-all ${
                  timeframe === t.value ? 'text-white bg-white/[0.06]' : 'text-zinc-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rankings */}
      <div className="px-4 py-4">
        {leaderboard.length === 0 ? (
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
                <motion.div
                  key={entry.userId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  className={`rounded-xl p-3 flex items-center gap-3 ${
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
