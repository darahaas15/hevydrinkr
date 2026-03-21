'use client';

import { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Settings, Flame, Wine, Clock, Calendar, TrendingUp, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/use-auth-store';
import { useSessionStore } from '@/stores/use-session-store';
import { useProfileStore } from '@/stores/use-profile-store';
import { useUIStore } from '@/stores/use-ui-store';
import { useFeedStore } from '@/stores/use-feed-store';
import { FeedCard } from '@/components/feed/feed-card';
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
  const allUsers = useAuthStore((s) => s.allUsers);
  const fetchAllUsers = useAuthStore((s) => s.fetchAllUsers);
  const toggleFollow = useAuthStore((s) => s.toggleFollow);
  const addToast = useUIStore((s) => s.addToast);
  const feedItems = useFeedStore((s) => s.items);
  const fetchFeed = useFeedStore((s) => s.fetchFeed);
  const [showFollowList, setShowFollowList] = useState<'followers' | 'following' | null>(null);
  const sessionHistory = useSessionStore((s) => s.sessionHistory);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const personalRecords = useProfileStore((s) => s.personalRecords);
  const fetchPRs = useProfileStore((s) => s.fetchPRs);

  // Fetch on mount and refetch when page regains focus
  useEffect(() => {
    const refetch = () => {
      if (currentUser) {
        fetchSessions(currentUser.id);
        fetchPRs(currentUser.id);
        fetchAllUsers();
        fetchFeed();
      }
    };
    refetch();
    window.addEventListener('focus', refetch);
    return () => window.removeEventListener('focus', refetch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

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
          <button onClick={() => setShowFollowList('following')} className="active:opacity-70">
            <span className="text-lg font-bold">{currentUser.following.length}</span>
            <span className="text-xs text-zinc-600 ml-1">Following</span>
          </button>
          <button onClick={() => setShowFollowList('followers')} className="active:opacity-70">
            <span className="text-lg font-bold">{currentUser.followers.length}</span>
            <span className="text-xs text-zinc-600 ml-1">Followers</span>
          </button>
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

        {/* My Posts */}
        {(() => {
          const myPosts = feedItems.filter((f) => f.userId === currentUser.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return myPosts.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Posts</h3>
              <div className="space-y-3">
                {myPosts.map((post) => (
                  <FeedCard key={post.id} item={post} />
                ))}
              </div>
            </div>
          ) : null;
        })()}
      </div>

      {/* Followers / Following List Modal */}
      <AnimatePresence>
        {showFollowList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowFollowList(null)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-sm mx-6 rounded-3xl overflow-hidden"
              style={{ background: '#141418' }}
            >
              <div className="px-5 py-4 flex items-center justify-between border-b border-white/[0.05]">
                <h3 className="text-base font-bold capitalize">{showFollowList}</h3>
                <button onClick={() => setShowFollowList(null)} className="p-1 rounded-lg hover:bg-white/5">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              <div className="max-h-[60dvh] overflow-y-auto">
                {(() => {
                  const ids = showFollowList === 'followers' ? currentUser.followers : currentUser.following;
                  const users = ids.map((id) => allUsers.find((u) => u.id === id)).filter(Boolean);

                  if (users.length === 0) {
                    return (
                      <div className="py-12 text-center">
                        <p className="text-sm text-zinc-600">
                          {showFollowList === 'followers' ? 'No followers yet' : 'Not following anyone'}
                        </p>
                      </div>
                    );
                  }

                  return users.map((user) => {
                    if (!user) return null;
                    const isFollowing = currentUser.following.includes(user.id);
                    return (
                      <div key={user.id} className="flex items-center gap-3 px-5 py-3 active:bg-white/[0.03]">
                        <div onClick={() => { setShowFollowList(null); router.push(`/profile/${user.id}`); }} className="cursor-pointer">
                          <Avatar name={user.displayName} size="md" src={user.avatarUrl} />
                        </div>
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => { setShowFollowList(null); router.push(`/profile/${user.id}`); }}
                        >
                          <p className="text-sm font-semibold truncate">{user.displayName}</p>
                          <p className="text-[11px] text-zinc-600">@{user.username}</p>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => toggleFollow(user.id)}
                          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            isFollowing
                              ? 'bg-white/[0.06] border border-white/[0.08] text-zinc-400'
                              : 'bg-accent text-black'
                          }`}
                        >
                          {isFollowing ? 'Following' : 'Follow'}
                        </motion.button>
                      </div>
                    );
                  });
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
