'use client';

import { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Settings, Flame, Wine, Clock, Calendar, TrendingUp, Share2 } from 'lucide-react';
import { useAppRouter } from '@/hooks/use-app-router';
import { useAuthStore } from '@/stores/use-auth-store';
import { useSessionStore } from '@/stores/use-session-store';
import { useProfileStore } from '@/stores/use-profile-store';
import { useUIStore } from '@/stores/use-ui-store';
import { hapticLight } from '@/lib/haptics';
import { useFeedStore } from '@/stores/use-feed-store';
import { FeedCard } from '@/components/feed/feed-card';
import { ImagePicker } from '@/components/ui/image-picker';
import { calculateWeeklyStreak } from '@/lib/algorithms/streaks';
import { formatDuration } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { PR_LABELS, PR_ICONS } from '@/types/pr';
import { DRINK_CATEGORY_COLORS } from '@/lib/constants';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { Heart, Trophy as TrophyIcon, Timer } from 'lucide-react';
import { getBaseUrl, shareLink } from '@/lib/share';
import { ErrorBanner } from '@/components/ui/error-banner';
export default function ProfilePage() {
  return <ProfilePageOwn />;
}

function ProfilePageOwn() {
  const router = useAppRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const allUsers = useAuthStore((s) => s.allUsers);
  const fetchAllUsers = useAuthStore((s) => s.fetchAllUsers);
  const toggleFollow = useAuthStore((s) => s.toggleFollow);
  const addToast = useUIStore((s) => s.addToast);
  const userPostsMap = useFeedStore((s) => s.userPosts);
  const feedError = useFeedStore((s) => s.error);
  const fetchUserPosts = useFeedStore((s) => s.fetchUserPosts);
  const [showFollowList, setShowFollowList] = useState<'followers' | 'following' | null>(null);
  const sessionHistory = useSessionStore((s) => s.sessionHistory);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const personalRecords = useProfileStore((s) => s.personalRecords);
  const fetchPRs = useProfileStore((s) => s.fetchPRs);

  // Fetch on mount (respects stale guard) and force-refetch when page regains focus
  useEffect(() => {
    if (currentUser) {
      fetchSessions(currentUser.id);
      fetchPRs(currentUser.id);
      fetchAllUsers();
      fetchUserPosts(currentUser.id);
    }
    const refetch = () => {
      if (currentUser) {
        fetchSessions(currentUser.id, true);
        fetchPRs(currentUser.id, true);
        fetchAllUsers(true);
        fetchUserPosts(currentUser.id, true);
      }
    };
    window.addEventListener('focus', refetch);
    return () => window.removeEventListener('focus', refetch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const mySessions = sessionHistory.filter(
    (s) => s.userId === currentUser?.id && s.status === 'completed'
  );
  const myPosts = useMemo(
    () => (currentUser ? userPostsMap[currentUser.id] ?? [] : []),
    [currentUser, userPostsMap]
  );
  const myPostsLoaded = currentUser ? userPostsMap[currentUser.id] !== undefined : false;

  const streak = useMemo(() => calculateWeeklyStreak(mySessions), [mySessions]);

  const stats = useMemo(() => {
    const totalSessions = myPosts.length;
    const totalDrinks = myPosts.reduce((sum, p) => sum + (p.sessionSummary.totalDrinks ?? 0), 0);
    const totalMinutes = myPosts.reduce((sum, p) => sum + (p.sessionSummary.durationMinutes ?? 0), 0);
    const avgDrinksPerSession = totalSessions > 0 ? totalDrinks / totalSessions : 0;

    const categoryCounts: Record<string, number> = {};
    myPosts.forEach((p) =>
      (p.sessionSummary.drinks ?? []).forEach((d) => {
        categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
      })
    );

    return { totalSessions, totalDrinks, totalMinutes, avgDrinksPerSession, categoryCounts };
  }, [myPosts]);

  const myPRs = personalRecords.filter((pr) => pr.userId === currentUser?.id);

  // Signature drink
  const signatureDrink = useMemo(() => {
    const counts: Record<string, { count: number; category: string }> = {};
    myPosts.forEach((p) =>
      (p.sessionSummary.drinks ?? []).forEach((d) => {
        if (!counts[d.name]) counts[d.name] = { count: 0, category: d.category };
        counts[d.name].count++;
      })
    );
    const entries = Object.entries(counts).sort(([, a], [, b]) => b.count - a.count);
    if (entries.length === 0) return null;
    const [name, { count, category }] = entries[0];
    const total = Object.values(counts).reduce((s, v) => s + v.count, 0);
    return { name, count, category, pct: Math.round((count / total) * 100) };
  }, [myPosts]);

  // Session highlights
  const highlights = useMemo(() => {
    if (myPosts.length === 0) return [];
    const items: { label: string; value: string; icon: typeof Heart; postId: string }[] = [];
    // Best night (most likes)
    const byLikes = [...myPosts].sort((a, b) => b.likes.length - a.likes.length);
    if (byLikes[0]?.likes.length > 0) {
      items.push({ label: 'Best Night', value: `${byLikes[0].likes.length} likes`, icon: Heart, postId: byLikes[0].id });
    }
    // Marathon (longest)
    const byDuration = [...myPosts].sort((a, b) => b.sessionSummary.durationMinutes - a.sessionSummary.durationMinutes);
    if (byDuration[0]?.sessionSummary.durationMinutes > 0) {
      items.push({ label: 'Marathon', value: formatDuration(byDuration[0].sessionSummary.durationMinutes), icon: Timer, postId: byDuration[0].id });
    }
    // Record (most drinks)
    const byDrinks = [...myPosts].sort((a, b) => b.sessionSummary.totalDrinks - a.sessionSummary.totalDrinks);
    if (byDrinks[0]?.sessionSummary.totalDrinks > 0) {
      items.push({ label: 'Record', value: `${byDrinks[0].sessionSummary.totalDrinks} drinks`, icon: TrophyIcon, postId: byDrinks[0].id });
    }
    return items;
  }, [myPosts]);

  // Achievements (milestones)
  const milestones = [
    { threshold: 10, label: '10th Sesh' },
    { threshold: 25, label: '25th Sesh' },
    { threshold: 50, label: '50th Sesh' },
    { threshold: 100, label: '100th Sesh' },
  ];
  const sessionCount = myPosts.length;
  const earnedMilestones = milestones.filter((m) => sessionCount >= m.threshold);
  const nextMilestone = milestones.find((m) => sessionCount < m.threshold);

  if (!currentUser) return null;

  const categoryEntries = Object.entries(stats.categoryCounts).sort(([, a], [, b]) => b - a);
  const totalCatDrinks = categoryEntries.reduce((sum, [, c]) => sum + c, 0) || 1;

  return (
    <div className="min-h-full pb-8">
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-5 py-3 flex items-center justify-between">
          <h1 className="text-xl font-extrabold">Profile</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                const result = await shareLink(`${getBaseUrl()}/profile/${currentUser.id}`, `${currentUser.displayName} on Drinkr`);
                if (result === 'copied') addToast('Link copied!', 'success');
              }}
              aria-label="Share profile"
              className="p-2 rounded-xl hover:bg-white/5 active:bg-white/[0.08]"
            >
              <Share2 className="w-5 h-5 text-zinc-500" />
            </button>
            <button onClick={() => router.push('/profile/settings')} aria-label="Settings" className="p-2 -mr-2 rounded-xl hover:bg-white/5 active:bg-white/[0.08]">
              <Settings className="w-5 h-5 text-zinc-500" />
            </button>
          </div>
        </div>
      </div>

      {feedError && currentUser && <ErrorBanner message={feedError} onRetry={() => fetchUserPosts(currentUser.id, true)} />}

      <div className="px-5 py-5 space-y-6">
        {/* User */}
        <div className="flex items-center gap-4">
          <ImagePicker
            currentImage={currentUser.avatarUrl}
            onSelect={(dataUrl) => updateProfile({ avatarUrl: dataUrl })}
            shape="circle"
            size={64}
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-extrabold truncate">{currentUser.displayName}</h2>
            <p className="text-sm text-zinc-500 truncate">@{currentUser.username}</p>
            <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{currentUser.bio}</p>
          </div>
        </div>

        {/* Follow counts */}
        <div className="flex gap-5">
          <button onClick={() => setShowFollowList('following')} className="active:opacity-70">
            <span className="text-lg font-bold">{currentUser.following.length}</span>
            <span className="text-xs text-zinc-500 ml-1">Following</span>
          </button>
          <button onClick={() => setShowFollowList('followers')} className="active:opacity-70">
            <span className="text-lg font-bold">{currentUser.followers.length}</span>
            <span className="text-xs text-zinc-500 ml-1">Followers</span>
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
              <p className="text-[10px] text-zinc-500">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Achievements */}
        {(earnedMilestones.length > 0 || nextMilestone) && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Achievements</h3>
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4">
              {earnedMilestones.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {earnedMilestones.map((m) => (
                    <span key={m.threshold} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-[11px] font-semibold text-accent">
                      {m.label}
                    </span>
                  ))}
                </div>
              )}
              {nextMilestone && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] text-zinc-500">Next: {nextMilestone.label}</p>
                    <p className="text-[11px] text-zinc-600">{sessionCount}/{nextMilestone.threshold}</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(sessionCount / nextMilestone.threshold) * 100}%` }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      className="h-full rounded-full bg-accent"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Session Highlights */}
        {highlights.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Highlights</h3>
            <div className="flex gap-2.5 overflow-x-auto scrollbar-hide">
              {highlights.map((h) => (
                <div
                  key={h.label}
                  onClick={() => router.push(`/feed?post=${h.postId}`)}
                  className="shrink-0 w-[130px] rounded-2xl bg-white/[0.03] border border-white/[0.05] p-3.5 cursor-pointer active:bg-white/[0.05] transition-colors"
                >
                  <h.icon className="w-4 h-4 text-accent mb-2" />
                  <p className="text-lg font-bold">{h.value}</p>
                  <p className="text-[10px] text-zinc-500">{h.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signature Drink */}
        {signatureDrink && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Signature Drink</h3>
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4 flex items-center gap-4">
              <DrinkIcon category={signatureDrink.category} className="w-8 h-8" />
              <div className="flex-1">
                <p className="text-sm font-bold">{signatureDrink.name}</p>
                <p className="text-[11px] text-zinc-500">{signatureDrink.count} times &middot; {signatureDrink.pct}% of your drinks</p>
              </div>
            </div>
          </div>
        )}

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
                  {(() => { const Icon = PR_ICONS[pr.category]; return <Icon className="w-5 h-5 text-accent" />; })()}
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
          const sortedPosts = [...myPosts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          if (!myPostsLoaded && !feedError) {
            return (
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Posts</h3>
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden animate-pulse">
                      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/5" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3.5 w-28 rounded bg-white/5" />
                          <div className="h-2.5 w-16 rounded bg-white/5" />
                        </div>
                      </div>
                      <div className="px-4 pb-3 space-y-2">
                        <div className="h-3 w-full rounded bg-white/5" />
                        <div className="h-3 w-3/4 rounded bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          return sortedPosts.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Posts</h3>
              <div className="space-y-3">
                {sortedPosts.map((post) => (
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
              style={{ background: 'rgba(20,20,24,0.85)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }}
            >
              <div className="px-5 py-4 flex items-center justify-between border-b border-white/[0.05]">
                <h3 className="text-base font-bold capitalize">{showFollowList}</h3>
                <button onClick={() => setShowFollowList(null)} className="p-2 rounded-lg hover:bg-white/5 active:bg-white/[0.08]">
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
                          <p className="text-[11px] text-zinc-500">@{user.username}</p>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { hapticLight(); toggleFollow(user.id); }}
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
