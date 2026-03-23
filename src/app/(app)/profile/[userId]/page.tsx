'use client';

import { use, useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Wine, Clock, Calendar, TrendingUp, Share2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/use-auth-store';
import { useSessionStore } from '@/stores/use-session-store';
import { useFeedStore } from '@/stores/use-feed-store';
import { Avatar } from '@/components/ui/avatar';
import { FeedCard } from '@/components/feed/feed-card';
import { formatDuration } from '@/lib/utils';
import { useUIStore } from '@/stores/use-ui-store';
import { getBaseUrl, shareLink } from '@/lib/share';

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const allUsers = useAuthStore((s) => s.allUsers);
  const toggleFollow = useAuthStore((s) => s.toggleFollow);
  const addToast = useUIStore((s) => s.addToast);
  const sessionHistory = useSessionStore((s) => s.sessionHistory);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const feedItems = useFeedStore((s) => s.items);
  const fetchFeed = useFeedStore((s) => s.fetchFeed);
  const fetchAllUsers = useAuthStore((s) => s.fetchAllUsers);

  useEffect(() => {
    fetchSessions(userId);
    fetchFeed();
    fetchAllUsers();
  }, [userId, fetchSessions, fetchFeed, fetchAllUsers]);

  const user = allUsers.find((u) => u.id === userId);

  // Redirect to own profile
  if (userId === currentUser?.id) {
    router.replace('/profile');
    return null;
  }

  if (!user || !currentUser) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-zinc-500">User not found</p>
      </div>
    );
  }

  const isFollowing = currentUser.following.includes(userId);
  const [showFollowList, setShowFollowList] = useState<'followers' | 'following' | null>(null);

  const userPosts = feedItems.filter((f) => f.userId === userId);

  const stats = useMemo(() => {
    const totalSessions = userPosts.length;
    const totalDrinks = userPosts.reduce((sum, p) => sum + (p.sessionSummary.totalDrinks ?? 0), 0);
    const totalMinutes = userPosts.reduce((sum, p) => sum + (p.sessionSummary.durationMinutes ?? 0), 0);
    const avgDrinks = totalSessions > 0 ? totalDrinks / totalSessions : 0;
    return { totalSessions, totalDrinks, totalMinutes, avgDrinks };
  }, [userPosts]);

  return (
    <div className="min-h-full pb-8">
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ChevronLeft className="w-6 h-6 text-zinc-400" />
          </button>
          <h1 className="text-lg font-bold truncate flex-1">{user.displayName}</h1>
          <button
            onClick={async () => {
              const result = await shareLink(`${getBaseUrl()}/profile/${userId}`, `${user.displayName} on hevydrinkr`);
              if (result === 'copied') addToast('Link copied!', 'success');
            }}
            className="p-1.5 -mr-1.5 rounded-lg hover:bg-white/5"
          >
            <Share2 className="w-5 h-5 text-zinc-500" />
          </button>
        </div>
      </div>

      <div className="px-5 py-5 space-y-5">
        {/* User info */}
        <div className="flex items-center gap-4">
          <Avatar name={user.displayName} size="xl" src={user.avatarUrl} />
          <div className="flex-1">
            <h2 className="text-xl font-extrabold">{user.displayName}</h2>
            <p className="text-sm text-zinc-500">@{user.username}</p>
            {user.bio && <p className="text-xs text-zinc-600 mt-1">{user.bio}</p>}
          </div>
        </div>

        {/* Follow counts + button */}
        <div className="flex items-center gap-5">
          <button onClick={() => setShowFollowList('following')} className="active:opacity-70">
            <span className="text-lg font-bold">{user.following.length}</span>
            <span className="text-xs text-zinc-600 ml-1">Following</span>
          </button>
          <button onClick={() => setShowFollowList('followers')} className="active:opacity-70">
            <span className="text-lg font-bold">{user.followers.length}</span>
            <span className="text-xs text-zinc-600 ml-1">Followers</span>
          </button>
          <div className="flex-1" />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => toggleFollow(userId)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              isFollowing
                ? 'bg-white/[0.06] border border-white/[0.08] text-zinc-400'
                : 'bg-accent text-black'
            }`}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </motion.button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { icon: Calendar, label: 'Sessions', value: stats.totalSessions, color: 'text-violet-400' },
            { icon: Wine, label: 'Total Drinks', value: stats.totalDrinks, color: 'text-accent' },
            { icon: Clock, label: 'Time Partying', value: formatDuration(stats.totalMinutes), color: 'text-cyan-400' },
            { icon: TrendingUp, label: 'Avg/Session', value: stats.avgDrinks.toFixed(1), color: 'text-green-400' },
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

        {/* User's posts */}
        {userPosts.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Posts</h3>
            <div className="space-y-3">
              {userPosts.map((post) => (
                <FeedCard key={post.id} item={post} />
              ))}
            </div>
          </div>
        )}

        {userPosts.length === 0 && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-6 text-center">
            <p className="text-sm text-zinc-600">No posts yet</p>
          </div>
        )}
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
                  const ids = showFollowList === 'followers' ? user.followers : user.following;
                  const users = ids.map((fid) => allUsers.find((u) => u.id === fid)).filter(Boolean);

                  if (users.length === 0) {
                    return (
                      <div className="py-12 text-center">
                        <p className="text-sm text-zinc-600">
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
                      <div key={u.id} className="flex items-center gap-3 px-5 py-3 active:bg-white/[0.03]">
                        <div onClick={() => { setShowFollowList(null); router.push(isMe ? '/profile' : `/profile/${u.id}`); }} className="cursor-pointer">
                          <Avatar name={u.displayName} size="md" src={u.avatarUrl} />
                        </div>
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => { setShowFollowList(null); router.push(isMe ? '/profile' : `/profile/${u.id}`); }}
                        >
                          <p className="text-sm font-semibold truncate">{isMe ? 'You' : u.displayName}</p>
                          <p className="text-[11px] text-zinc-600">@{u.username}</p>
                        </div>
                        {!isMe && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleFollow(u.id)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              iAmFollowing
                                ? 'bg-white/[0.06] border border-white/[0.08] text-zinc-400'
                                : 'bg-accent text-black'
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
