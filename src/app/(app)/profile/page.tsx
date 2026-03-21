'use client';

import { useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Flame, Wine, Clock, Calendar, TrendingUp, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/use-auth-store';
import { useSessionStore } from '@/stores/use-session-store';
import { useProfileStore } from '@/stores/use-profile-store';
import { useUIStore } from '@/stores/use-ui-store';
import { ImagePicker } from '@/components/ui/image-picker';
import { calculateWeeklyStreak } from '@/lib/algorithms/streaks';
import { formatDuration } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { PR_LABELS, PR_EMOJIS } from '@/types/pr';
import { DRINK_CATEGORY_COLORS, DRINK_CATEGORY_EMOJIS } from '@/lib/constants';
import { getBaseUrl, shareLink } from '@/lib/share';

export default function ProfilePage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const addToast = useUIStore((s) => s.addToast);
  const sessionHistory = useSessionStore((s) => s.sessionHistory);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const personalRecords = useProfileStore((s) => s.personalRecords);
  const fetchPRs = useProfileStore((s) => s.fetchPRs);

  useEffect(() => {
    if (currentUser) {
      fetchSessions(currentUser.id);
      fetchPRs(currentUser.id);
    }
  }, [currentUser, fetchSessions, fetchPRs]);

  const mySessions = sessionHistory.filter(
    (s) => s.userId === currentUser?.id && s.status === 'completed'
  );

  const streak = useMemo(() => calculateWeeklyStreak(mySessions), [mySessions]);

  const stats = useMemo(() => {
    const totalDrinks = mySessions.reduce((sum, s) => sum + s.drinks.length, 0);
    const totalMinutes = mySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const avgDrinksPerSession = mySessions.length > 0 ? totalDrinks / mySessions.length : 0;

    const categoryCounts: Record<string, number> = {};
    mySessions.forEach((s) =>
      s.drinks.forEach((d) => {
        categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
      })
    );

    return { totalSessions: mySessions.length, totalDrinks, totalMinutes, avgDrinksPerSession, categoryCounts };
  }, [mySessions]);

  const myPRs = personalRecords.filter((pr) => pr.userId === currentUser?.id);
  if (!currentUser) return null;

  const categoryEntries = Object.entries(stats.categoryCounts).sort(([, a], [, b]) => b - a);
  const totalCatDrinks = categoryEntries.reduce((sum, [, c]) => sum + c, 0) || 1;

  return (
    <div className="min-h-full pb-8">
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="px-5 py-3 flex items-center justify-between">
          <h1 className="text-xl font-extrabold">Profile</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                const result = await shareLink(`${getBaseUrl()}/profile/${currentUser.id}`, `${currentUser.displayName} on hevydrinkr`);
                if (result === 'copied') addToast('Link copied!', 'success');
              }}
              className="p-2 rounded-xl hover:bg-white/5"
            >
              <Share2 className="w-5 h-5 text-zinc-500" />
            </button>
            <button onClick={() => router.push('/profile/settings')} className="p-2 -mr-2 rounded-xl hover:bg-white/5">
              <Settings className="w-5 h-5 text-zinc-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 space-y-6">
        {/* User */}
        <div className="flex items-center gap-4">
          <ImagePicker
            currentImage={currentUser.avatarUrl}
            onSelect={(dataUrl) => updateProfile({ avatarUrl: dataUrl })}
            shape="circle"
            size={64}
          />
          <div className="flex-1">
            <h2 className="text-xl font-extrabold">{currentUser.displayName}</h2>
            <p className="text-sm text-zinc-500">@{currentUser.username}</p>
            <p className="text-xs text-zinc-600 mt-1">{currentUser.bio}</p>
          </div>
        </div>

        {/* Follow counts */}
        <div className="flex gap-5">
          <div>
            <span className="text-lg font-bold">{currentUser.following.length}</span>
            <span className="text-xs text-zinc-600 ml-1">Following</span>
          </div>
          <div>
            <span className="text-lg font-bold">{currentUser.followers.length}</span>
            <span className="text-xs text-zinc-600 ml-1">Followers</span>
          </div>
        </div>

        {/* Streak */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <Flame className="w-6 h-6 text-accent" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-zinc-500">Party Streak</p>
            <p className="text-2xl font-extrabold">
              {streak.currentStreak}<span className="text-sm font-normal text-zinc-600 ml-1">weeks</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-700">Best</p>
            <p className="text-sm font-bold text-zinc-500">{streak.longestStreak}w</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { icon: Calendar, label: 'Sessions', value: stats.totalSessions, color: 'text-violet-400' },
            { icon: Wine, label: 'Total Drinks', value: stats.totalDrinks, color: 'text-accent' },
            { icon: Clock, label: 'Time Partying', value: formatDuration(stats.totalMinutes), color: 'text-cyan-400' },
            { icon: TrendingUp, label: 'Avg/Session', value: stats.avgDrinksPerSession.toFixed(1), color: 'text-green-400' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4"
            >
              <stat.icon className={`w-4 h-4 ${stat.color} mb-2`} />
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-[10px] text-zinc-600">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Drink breakdown — donut style */}
        {categoryEntries.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Drink Breakdown</h3>
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4">
              {/* Stacked bar */}
              <div className="h-3 rounded-full overflow-hidden flex mb-4">
                {categoryEntries.map(([cat, count]) => (
                  <motion.div
                    key={cat}
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / totalCatDrinks) * 100}%` }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="h-full first:rounded-l-full last:rounded-r-full"
                    style={{ backgroundColor: DRINK_CATEGORY_COLORS[cat] || '#71717a' }}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {categoryEntries.map(([cat, count]) => {
                  const pct = Math.round((count / totalCatDrinks) * 100);
                  const color = DRINK_CATEGORY_COLORS[cat] || '#71717a';
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-xs text-zinc-400 capitalize truncate flex-1">{cat}</span>
                      <span className="text-xs font-mono text-zinc-500">{count}</span>
                      <span className="text-[10px] text-zinc-700">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Personal Records */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Personal Records</h3>
          {myPRs.length === 0 ? (
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-6 text-center">
              <p className="text-sm text-zinc-600">No PRs yet — start a session!</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {myPRs.map((pr, i) => (
                <motion.div
                  key={pr.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 flex items-center gap-3"
                >
                  <span className="text-xl">{PR_EMOJIS[pr.category]}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{PR_LABELS[pr.category]}</p>
                    <p className="text-[10px] text-zinc-600">
                      {new Date(pr.achievedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <p className="text-sm font-mono font-bold text-accent">{pr.formattedValue}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Session History */}
        {mySessions.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Session History</h3>
            <div className="space-y-1.5">
              {mySessions.slice(0, 8).map((session) => (
                <button
                  key={session.id}
                  onClick={() => router.push(`/session/${session.id}`)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-left active:bg-white/[0.05] transition-colors"
                >
                  <span className="text-lg">{session.drinks[0]?.emoji || '🍻'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{session.venue}</p>
                    <p className="text-[10px] text-zinc-600">
                      {session.drinks.length} drinks · {formatDuration(session.durationMinutes)}
                    </p>
                  </div>
                  <p className="text-[10px] text-zinc-700 shrink-0">
                    {new Date(session.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
