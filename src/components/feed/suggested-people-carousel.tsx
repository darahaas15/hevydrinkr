'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '@/components/ui/avatar';
import type { UserProfile } from '@/types';
import type { FeedItem } from '@/types/feed';

interface SuggestedPeopleCarouselProps {
  users: UserProfile[];
  feedItems: FeedItem[];
  followingIds: string[];
  onFollow: (userId: string) => void;
  onViewProfile: (userId: string) => void;
}

export function SuggestedPeopleCarousel({
  users,
  feedItems,
  followingIds,
  onFollow,
  onViewProfile,
}: SuggestedPeopleCarouselProps) {
  const userStats = useMemo(() => {
    const map = new Map<string, { sessions: number; drinks: number }>();
    for (const item of feedItems) {
      const prev = map.get(item.userId) ?? { sessions: 0, drinks: 0 };
      map.set(item.userId, {
        sessions: prev.sessions + 1,
        drinks: prev.drinks + item.sessionSummary.totalDrinks,
      });
    }
    return map;
  }, [feedItems]);

  if (users.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4 pb-2">
      <AnimatePresence>
        {users.map((user, i) => {
          const stats = userStats.get(user.id);
          const isFollowing = followingIds.includes(user.id);
          const statLabel = stats
            ? stats.sessions === 1
              ? '1 sesh'
              : `${stats.sessions} seshes`
            : 'New member';

          return (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
              transition={{ delay: i < 6 ? i * 0.04 : 0 }}
              className="shrink-0 snap-start w-[130px] rounded-2xl bg-white/[0.03] border border-white/[0.05] p-3.5 flex flex-col items-center"
            >
              <div onClick={() => onViewProfile(user.id)} className="cursor-pointer flex flex-col items-center">
                <Avatar name={user.displayName} size="lg" src={user.avatarUrl} />
                <p className="text-sm font-semibold truncate w-full text-center mt-2">{user.displayName}</p>
                <p className="text-[11px] text-zinc-600 truncate w-full text-center">@{user.username}</p>
                <span className="text-[10px] text-zinc-500 bg-white/[0.04] rounded-full px-2 py-0.5 mt-1.5">
                  {statLabel}
                </span>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => onFollow(user.id)}
                className={`mt-3 w-full py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isFollowing
                    ? 'bg-white/[0.06] border border-white/[0.08] text-zinc-400'
                    : 'bg-accent text-black'
                }`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </motion.button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
