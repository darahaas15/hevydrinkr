'use client';

import { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Wine, Clock, Calendar, TrendingUp, Share2, X, Heart, Trophy as TrophyIcon, Timer, Flag, Ban, MoreHorizontal, Lock } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAppRouter } from '@/hooks/use-app-router';
import { useAuthStore } from '@/stores/use-auth-store';
import { useSessionStore } from '@/stores/use-session-store';
import { useFeedStore } from '@/stores/use-feed-store';
import { Avatar } from '@/components/ui/avatar';
import { FeedCard } from '@/components/feed/feed-card';
import { formatDuration } from '@/lib/utils';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { useUIStore } from '@/stores/use-ui-store';
import { useModerationStore } from '@/stores/use-moderation-store';
import { ReportModal } from '@/components/moderation/report-modal';
import { getBaseUrl, shareLink } from '@/lib/share';
import { hapticLight } from '@/lib/haptics';

export default function UserProfilePage({ userId: userIdProp }: { userId?: string }) {
  const pathname = usePathname();
  const resolvedUserId = userIdProp || pathname.split('/').pop() || '';
  const router = useAppRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const allUsers = useAuthStore((s) => s.allUsers);
  const toggleFollow = useAuthStore((s) => s.toggleFollow);
  const addToast = useUIStore((s) => s.addToast);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const sessionsByUser = useSessionStore((s) => s.sessionsByUser);
  const userPostsMap = useFeedStore((s) => s.userPosts);
  const fetchUserPosts = useFeedStore((s) => s.fetchUserPosts);
  const fetchAllUsers = useAuthStore((s) => s.fetchAllUsers);

  const [loadingUser, setLoadingUser] = useState(!allUsers.some((u) => u.id === resolvedUserId));
  const [showFollowList, setShowFollowList] = useState<'followers' | 'following' | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const blockUser = useModerationStore((s) => s.blockUser);
  const unblockUser = useModerationStore((s) => s.unblockUser);
  const isBlocked = useModerationStore((s) => s.isBlocked(resolvedUserId));

  const outgoingRequests = useAuthStore((s) => s.outgoingRequests);
  const sendFollowRequest = useAuthStore((s) => s.sendFollowRequest);
  const cancelFollowRequest = useAuthStore((s) => s.cancelFollowRequest);
  const fetchOutgoingRequests = useAuthStore((s) => s.fetchOutgoingRequests);

  useEffect(() => {
    fetchSessions(resolvedUserId);
    fetchUserPosts(resolvedUserId);
    fetchOutgoingRequests();
    const alreadyLoaded = useAuthStore.getState().allUsers.some((u) => u.id === resolvedUserId);
    if (alreadyLoaded) {
      fetchAllUsers();
      void Promise.resolve().then(() => setLoadingUser(false));
    } else {
      void Promise.resolve().then(() => setLoadingUser(true));
      fetchAllUsers(true).finally(() => setLoadingUser(false));
    }
  }, [resolvedUserId, fetchSessions, fetchUserPosts, fetchAllUsers, fetchOutgoingRequests]);

  const user = allUsers.find((u) => u.id === resolvedUserId);
  const isFollowing = currentUser?.following.includes(resolvedUserId) ?? false;
  const hasPendingRequest = outgoingRequests.some((r) => r.targetId === resolvedUserId);
  // A pending request can only exist against a private account, so it implies
  // privacy even if the cached `isPrivate` is stale (e.g. the target flipped
  // private after our last fetchAllUsers, or fell outside the 500-row window).
  const isPrivate = (user?.isPrivate ?? false) || hasPendingRequest;
  const isLockedProfile = isPrivate && !isFollowing;

  const userPosts = useMemo(
    () => userPostsMap[resolvedUserId] ?? [],
    [userPostsMap, resolvedUserId]
  );

  const userSessions = useMemo(
    () => (sessionsByUser[resolvedUserId] ?? []).filter((s) => s.status === 'completed'),
    [sessionsByUser, resolvedUserId]
  );

  // Stats are computed from sessions (the source of truth).
  const stats = useMemo(() => {
    const totalSessions = userSessions.length;
    const totalDrinks = userSessions.reduce((sum, s) => sum + s.drinks.length, 0);
    const totalMinutes = userSessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
    const avgDrinks = totalSessions > 0 ? totalDrinks / totalSessions : 0;
    return { totalSessions, totalDrinks, totalMinutes, avgDrinks };
  }, [userSessions]);

  // Signature drink — computed from sessions for completeness.
  const signatureDrink = useMemo(() => {
    const counts: Record<string, { count: number; category: string }> = {};
    userSessions.forEach((s) =>
      s.drinks.forEach((d) => {
        if (!counts[d.drinkName]) counts[d.drinkName] = { count: 0, category: d.category };
        counts[d.drinkName].count++;
      })
    );
    const entries = Object.entries(counts).sort(([, a], [, b]) => b.count - a.count);
    if (entries.length === 0) return null;
    const [name, { count, category }] = entries[0];
    const total = Object.values(counts).reduce((s, v) => s + v.count, 0);
    return { name, count, category, pct: Math.round((count / total) * 100) };
  }, [userSessions]);

  // Session highlights
  const highlights = useMemo(() => {
    if (userPosts.length === 0) return [];
    const items: { label: string; value: string; icon: typeof Heart; postId: string }[] = [];
    const byLikes = [...userPosts].sort((a, b) => b.likes.length - a.likes.length);
    if (byLikes[0]?.likes.length > 0) {
      items.push({ label: 'Best Night', value: `${byLikes[0].likes.length} likes`, icon: Heart, postId: byLikes[0].id });
    }
    const byDuration = [...userPosts].sort((a, b) => b.sessionSummary.durationMinutes - a.sessionSummary.durationMinutes);
    if (byDuration[0]?.sessionSummary.durationMinutes > 0) {
      items.push({ label: 'Marathon', value: formatDuration(byDuration[0].sessionSummary.durationMinutes), icon: Timer, postId: byDuration[0].id });
    }
    const byDrinks = [...userPosts].sort((a, b) => b.sessionSummary.totalDrinks - a.sessionSummary.totalDrinks);
    if (byDrinks[0]?.sessionSummary.totalDrinks > 0) {
      items.push({ label: 'Record', value: `${byDrinks[0].sessionSummary.totalDrinks} drinks`, icon: TrophyIcon, postId: byDrinks[0].id });
    }
    return items;
  }, [userPosts]);

  // Achievements — based on actual sessions completed.
  const milestones = [
    { threshold: 10, label: '10th Sesh' },
    { threshold: 25, label: '25th Sesh' },
    { threshold: 50, label: '50th Sesh' },
    { threshold: 100, label: '100th Sesh' },
  ];
  const sessionCount = userSessions.length;
  const earnedMilestones = milestones.filter((m) => sessionCount >= m.threshold);

  // Redirect to own profile
  if (resolvedUserId === currentUser?.id) {
    router.replace('/profile');
    return null;
  }

  if (loadingUser && !user) {
    return (
      <div className="min-h-full">
        <div className="sticky top-0 z-20 safe-top" style={{ background: 'var(--chrome-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid var(--chrome-border)' }}>
          <div className="px-5 py-3 flex items-center gap-3">
            <button onClick={() => router.back()} aria-label="Back" className="p-2 -ml-2 active:text-foreground">
              <ChevronLeft className="w-6 h-6 text-muted-foreground" />
            </button>
            <div className="h-5 w-24 rounded bg-surface-subtle animate-pulse" />
          </div>
        </div>
        <div className="px-5 py-5 space-y-5 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-surface-subtle" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-32 rounded bg-surface-subtle" />
              <div className="h-3 w-20 rounded bg-surface-subtle" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-card border border-hairline p-4 h-20" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user || !currentUser) {
    return (
      <div className="min-h-full">
        <div className="sticky top-0 z-20 safe-top" style={{ background: 'var(--chrome-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid var(--chrome-border)' }}>
          <div className="px-5 py-3 flex items-center gap-3">
            <button onClick={() => router.back()} aria-label="Back" className="p-2 -ml-2 active:text-foreground">
              <ChevronLeft className="w-6 h-6 text-muted-foreground" />
            </button>
            <h1 className="text-lg font-bold truncate flex-1">Profile</h1>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-subtle flex items-center justify-center mb-4">
            <ChevronLeft className="w-8 h-8 text-fg-faint" />
          </div>
          <p className="text-fg-secondary text-sm">User not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-8">
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'var(--chrome-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid var(--chrome-border)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} aria-label="Back" className="p-2 -ml-2 active:text-foreground">
            <ChevronLeft className="w-6 h-6 text-muted-foreground" />
          </button>
          <h1 className="text-lg font-bold truncate flex-1">{user.displayName}</h1>
          <button
            onClick={async () => {
              const result = await shareLink(`${getBaseUrl()}/profile/${resolvedUserId}`, `${user.displayName} on Drinkr`);
              if (result === 'copied') addToast('Link copied!', 'success');
            }}
            aria-label="Share profile"
            className="p-2.5 rounded-lg hover:bg-surface-subtle active:bg-surface-strong"
          >
            <Share2 className="w-5 h-5 text-fg-secondary" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu((v) => !v)}
              aria-label="More options"
              className="p-2.5 -mr-2.5 rounded-lg hover:bg-surface-subtle active:bg-surface-strong"
            >
              <MoreHorizontal className="w-5 h-5 text-fg-secondary" />
            </button>
            <AnimatePresence>
              {showMoreMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 top-full mt-1 w-44 rounded-xl overflow-hidden z-30"
                  style={{ background: 'var(--popover-strong-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--chrome-border)' }}
                >
                  <button
                    onClick={() => { setShowMoreMenu(false); setShowReport(true); }}
                    className="w-full px-4 py-3 flex items-center gap-3 text-sm text-muted-foreground active:bg-surface-subtle"
                  >
                    <Flag className="w-4 h-4 text-danger-fg" />
                    Report User
                  </button>
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      if (isBlocked) {
                        unblockUser(currentUser.id, resolvedUserId);
                        addToast('User unblocked', 'success');
                      } else {
                        blockUser(currentUser.id, resolvedUserId);
                        addToast('User blocked', 'success');
                      }
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 text-sm text-muted-foreground active:bg-surface-subtle border-t border-hairline"
                  >
                    <Ban className="w-4 h-4 text-danger-fg" />
                    {isBlocked ? 'Unblock User' : 'Block User'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 space-y-5">
        {/* User info */}
        <div className="flex items-center gap-4">
          <Avatar name={user.displayName} size="xl" src={user.avatarUrl} />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-extrabold truncate">{user.displayName}</h2>
            <p className="text-sm text-fg-secondary truncate">@{user.username}</p>
            {user.bio && <p className="text-xs text-fg-secondary mt-1 line-clamp-2">{user.bio}</p>}
          </div>
        </div>

        {/* Follow counts + button */}
        <div className="flex items-center gap-5">
          <button onClick={() => setShowFollowList('following')} className="active:opacity-70">
            <span className="text-lg font-bold">{user.following.length}</span>
            <span className="text-xs text-fg-secondary ml-1">Following</span>
          </button>
          <button onClick={() => setShowFollowList('followers')} className="active:opacity-70">
            <span className="text-lg font-bold">{user.followers.length}</span>
            <span className="text-xs text-fg-secondary ml-1">Followers</span>
          </button>
          <div className="flex-1" />
          {hasPendingRequest ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { hapticLight(); cancelFollowRequest(resolvedUserId); }}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-surface-raised border border-border-strong text-muted-foreground"
            >
              Requested
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { hapticLight(); toggleFollow(resolvedUserId); }}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                isFollowing
                  ? 'bg-surface-raised border border-border-strong text-muted-foreground'
                  : 'bg-accent text-accent-foreground'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </motion.button>
          )}
        </div>

        {isLockedProfile ? (
          <div className="rounded-2xl bg-card border border-hairline p-8 text-center">
            <Lock className="w-10 h-10 text-muted mx-auto mb-3" />
            <h3 className="text-base font-semibold mb-1">This account is private</h3>
            <p className="text-sm text-fg-secondary mb-5">Follow this account to see their sessions and posts</p>
            {hasPendingRequest ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { hapticLight(); cancelFollowRequest(resolvedUserId); }}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-surface-raised border border-border-strong text-muted-foreground"
              >
                Requested
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { hapticLight(); toggleFollow(resolvedUserId); }}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-accent text-accent-foreground"
              >
                Follow
              </motion.button>
            )}
          </div>
        ) : (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { icon: Calendar, label: 'Sessions', value: stats.totalSessions, color: 'text-violet-fg' },
                { icon: Wine, label: 'Total Drinks', value: stats.totalDrinks, color: 'text-accent' },
                { icon: Clock, label: 'Time Partying', value: formatDuration(stats.totalMinutes), color: 'text-info-fg' },
                { icon: TrendingUp, label: 'Avg/Session', value: stats.avgDrinks.toFixed(1), color: 'text-success-fg' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl bg-card border border-hairline p-4"
                >
                  <stat.icon className={`w-4 h-4 ${stat.color} mb-2`} />
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-[10px] text-fg-secondary">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Achievements */}
            {earnedMilestones.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-3">Achievements</h3>
                <div className="flex flex-wrap gap-2">
                  {earnedMilestones.map((m) => (
                    <span key={m.threshold} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-[11px] font-semibold text-accent">
                      {m.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Session Highlights */}
            {highlights.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-3">Highlights</h3>
                <div className="flex gap-2.5 overflow-x-auto scrollbar-hide">
                  {highlights.map((h) => (
                    <div
                      key={h.label}
                      onClick={() => router.push(`/feed?post=${h.postId}`)}
                      className="shrink-0 w-[130px] rounded-2xl bg-card border border-hairline p-3.5 cursor-pointer active:bg-surface-subtle transition-colors"
                    >
                      <h.icon className="w-4 h-4 text-accent mb-2" />
                      <p className="text-lg font-bold">{h.value}</p>
                      <p className="text-[10px] text-fg-secondary">{h.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signature Drink */}
            {signatureDrink && (
              <div>
                <h3 className="text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-3">Signature Drink</h3>
                <div className="rounded-2xl bg-card border border-hairline p-4 flex items-center gap-4">
                  <DrinkIcon category={signatureDrink.category} className="w-8 h-8" />
                  <div className="flex-1">
                    <p className="text-sm font-bold">{signatureDrink.name}</p>
                    <p className="text-[11px] text-fg-secondary">{signatureDrink.count} times &middot; {signatureDrink.pct}% of drinks</p>
                  </div>
                </div>
              </div>
            )}

            {/* User's posts */}
            {userPosts.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-3">Posts</h3>
                <div className="space-y-3">
                  {userPosts.map((post) => (
                    <FeedCard key={post.id} item={post} />
                  ))}
                </div>
              </div>
            )}

            {userPosts.length === 0 && (
              <div className="rounded-2xl bg-card border border-hairline p-6 text-center">
                <p className="text-sm text-muted">No posts yet</p>
              </div>
            )}
          </>
        )}
      </div>

      <ReportModal
        open={showReport}
        onClose={() => setShowReport(false)}
        targetType="user"
        targetId={resolvedUserId}
        targetLabel={user.displayName}
      />

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
              style={{ background: 'var(--popover-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }}
            >
              <div className="px-5 py-4 flex items-center justify-between border-b border-hairline">
                <h3 className="text-base font-bold capitalize">{showFollowList}</h3>
                <button onClick={() => setShowFollowList(null)} className="p-2 rounded-lg hover:bg-surface-subtle active:bg-surface-strong">
                  <X className="w-5 h-5 text-fg-secondary" />
                </button>
              </div>
              <div className="max-h-[60dvh] overflow-y-auto">
                {(() => {
                  const ids = showFollowList === 'followers' ? user.followers : user.following;
                  const users = ids.map((fid) => allUsers.find((u) => u.id === fid)).filter(Boolean);

                  if (users.length === 0) {
                    return (
                      <div className="py-12 text-center">
                        <p className="text-sm text-muted">
                          {showFollowList === 'followers' ? 'No followers yet' : 'Not following anyone'}
                        </p>
                      </div>
                    );
                  }

                  return users.map((u) => {
                    if (!u) return null;
                    const iAmFollowing = currentUser.following.includes(u.id);
                    const isMe = u.id === currentUser.id;
                    return (
                      <div key={u.id} className="flex items-center gap-3 px-5 py-3 active:bg-card">
                        <div onClick={() => { setShowFollowList(null); router.push(isMe ? '/profile' : `/profile/${u.id}`); }} className="cursor-pointer">
                          <Avatar name={u.displayName} size="md" src={u.avatarUrl} />
                        </div>
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => { setShowFollowList(null); router.push(isMe ? '/profile' : `/profile/${u.id}`); }}
                        >
                          <p className="text-sm font-semibold truncate">{isMe ? 'You' : u.displayName}</p>
                          <p className="text-[11px] text-fg-secondary">@{u.username}</p>
                        </div>
                        {!isMe && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { hapticLight(); toggleFollow(u.id); }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              iAmFollowing
                                ? 'bg-surface-raised border border-border-strong text-muted-foreground'
                                : 'bg-accent text-accent-foreground'
                            }`}
                          >
                            {iAmFollowing ? 'Following' : 'Follow'}
                          </motion.button>
                        )}
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
