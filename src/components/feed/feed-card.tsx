'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { memo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, MessageCircle, Share2, Clock, Wine, UserPlus, X, Flag, MoreHorizontal } from 'lucide-react';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { useAuthStore } from '@/stores/use-auth-store';
import { useFeedStore } from '@/stores/use-feed-store';
import { hapticLight } from '@/lib/haptics';
import { getBaseUrl, shareLink } from '@/lib/share';
import { useUIStore } from '@/stores/use-ui-store';
import { Avatar } from '@/components/ui/avatar';
import { ReportModal } from '@/components/moderation/report-modal';
import { formatTimeAgo, formatDuration } from '@/lib/utils';
import type { FeedItem } from '@/types';

export const FeedCard = memo(function FeedCard({ item, milestone, showFollowButton }: { item: FeedItem; milestone?: { label: string } | null; showFollowButton?: boolean }) {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const toggleFollow = useAuthStore((s) => s.toggleFollow);
  const addLike = useFeedStore((s) => s.addLike);
  const removeLike = useFeedStore((s) => s.removeLike);
  const isFollowing = currentUser?.following.includes(item.userId) ?? false;

  const getUserById = useAuthStore((s) => s.getUserById);
  const addToast = useUIStore((s) => s.addToast);
  const [showLikesList, setShowLikesList] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const userLike = item.likes.find((l) => l.userId === currentUser?.id);
  const isLiked = !!userLike;
  const handleCardClick = () => {
    hapticLight();
    router.push(`/feed?post=${item.id}`);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    hapticLight();
    if (isLiked) {
      removeLike(item.id, userLike!.id);
    } else {
      addLike(item.id, {
        id: crypto.randomUUID(),
        userId: currentUser.id,
        userName: currentUser.displayName,
        createdAt: new Date().toISOString(),
      });
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${getBaseUrl()}/feed/${item.id}`;
    const text = `${item.userName} had ${item.sessionSummary.totalDrinks} drinks at ${item.sessionSummary.venue}`;
    const result = await shareLink(url, text, text);
    if (result === 'copied') addToast('Link copied!', 'success');
  };

  const goToProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(item.userId === currentUser?.id ? '/profile' : `/profile?user=${item.userId}`);
  };

  const { sessionSummary: s } = item;

  return (
    <div
      onClick={handleCardClick}
      className="feed-card rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden active:bg-white/[0.05] transition-colors cursor-pointer"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <Avatar name={item.userName} size="md" src={item.userAvatar} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate cursor-pointer" onClick={goToProfile}>{item.userName}</p>
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-zinc-500">{formatTimeAgo(item.createdAt)}</p>
            {milestone && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-accent text-black text-[10px] font-semibold leading-none">
                {milestone.label}
              </span>
            )}
          </div>
        </div>
        {showFollowButton && !isFollowing && item.userId !== currentUser?.id && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={(e) => { e.stopPropagation(); hapticLight(); toggleFollow(item.userId); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-black text-xs font-semibold"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Follow
          </motion.button>
        )}
      </div>

      {/* Caption */}
      {item.caption && (
        <p className="px-4 pb-2 text-[13px] text-zinc-300">{item.caption}</p>
      )}

      {/* Photos — Instagram style */}
      {item.photos && item.photos.length > 0 && (
        item.photos.length === 1 ? (
          <div className="mb-2">
            <img src={item.photos[0]} alt="" loading="lazy" decoding="async" className="w-full aspect-[4/3] object-cover" />
          </div>
        ) : (
          <div className="mb-2 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide">
            {item.photos.map((photo, i) => (
              <div key={i} className="w-full shrink-0 snap-center">
                <img src={photo} alt="" loading="lazy" decoding="async" className="w-full aspect-[4/3] object-cover" />
              </div>
            ))}
          </div>
        )
      )}

      {/* Session stats */}
      <div className="mx-4 mb-3 rounded-xl bg-white/[0.03] border border-white/[0.04] p-3">
        <p className="text-[11px] text-zinc-500 mb-2">{s.venue}</p>

        {/* Drink icons */}
        {s.drinks && s.drinks.length > 0 ? (
          <div className="flex flex-wrap gap-0.5 mb-2">
            {s.drinks.slice(0, 15).map((drink, i) => (
              <DrinkIcon key={i} category={drink.category} className="w-4 h-4" />
            ))}
            {s.drinks.length > 15 && (
              <span className="text-[11px] text-zinc-600 self-center ml-1">+{s.drinks.length - 15}</span>
            )}
          </div>
        ) : s.drinkEmojis.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mb-2">
            {s.drinkEmojis.slice(0, 15).map((_, i) => (
              <DrinkIcon key={i} category="custom" className="w-4 h-4" />
            ))}
            {s.drinkEmojis.length > 15 && (
              <span className="text-[11px] text-zinc-600 self-center ml-1">+{s.drinkEmojis.length - 15}</span>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <Wine className="w-3 h-3" />
            {s.totalDrinks} drink{s.totalDrinks !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(s.durationMinutes)}
          </span>
          <span>{s.totalStandardDrinks.toFixed(1)} std</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <motion.button
              whileTap={{ scale: 1.15 }}
              onClick={handleLike}
            >
              <Heart size={18} className={`transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-zinc-600'}`} />
            </motion.button>
            {item.likes.length > 0 && (
              <span className={`text-[11px] ${isLiked ? 'text-red-500' : 'text-zinc-600'}`}>{item.likes.length}</span>
            )}
          </div>

          <span className="flex items-center gap-1.5">
            <MessageCircle size={18} className="text-zinc-600" />
            {(() => {
              const total = item.comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);
              return total > 0 ? <span className="text-[11px] text-zinc-600">{total}</span> : null;
            })()}
          </span>

          <button onClick={handleShare} aria-label="Share">
            <Share2 size={18} className="text-zinc-600" />
          </button>

          {item.userId !== currentUser?.id && (
            <button onClick={(e) => { e.stopPropagation(); setShowReport(true); }} aria-label="Report">
              <Flag size={16} className="text-zinc-700" />
            </button>
          )}
        </div>

        {/* Liked by */}
        {item.likes.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowLikesList(true); }}
            className="flex items-center gap-2 mt-2"
          >
            <div className="flex -space-x-1.5">
              {item.likes.slice(0, 3).map((like) => {
                const user = getUserById(like.userId);
                return (
                  <Avatar
                    key={like.id}
                    name={like.userName}
                    size="xs"
                    src={user?.avatarUrl ?? null}
                    className="ring-1 ring-black"
                  />
                );
              })}
            </div>
            <p className="text-[12px] text-zinc-400">
              Liked by <span className="font-semibold text-zinc-200">{item.likes[0].userId === currentUser?.id ? 'you' : item.likes[0].userName}</span>
              {item.likes.length > 1 && <> and <span className="font-semibold text-zinc-200">{item.likes.length - 1} other{item.likes.length - 1 !== 1 ? 's' : ''}</span></>}
            </p>
          </button>
        )}
      </div>

      <ReportModal
        open={showReport}
        onClose={() => setShowReport(false)}
        targetType="post"
        targetId={item.id}
        targetLabel={`Post by ${item.userName}`}
      />

      {/* Likes List Modal */}
      <AnimatePresence>
        {showLikesList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowLikesList(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-sm mx-6 rounded-3xl overflow-hidden"
              style={{ background: 'rgba(20,20,24,0.85)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }}
            >
              <div className="px-5 py-4 flex items-center justify-between border-b border-white/[0.05]">
                <h3 className="text-base font-bold">Likes</h3>
                <button onClick={() => setShowLikesList(false)} className="p-2 rounded-lg hover:bg-white/5 active:bg-white/[0.08]">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              <div className="max-h-[60dvh] overflow-y-auto">
                {item.likes.map((like) => {
                  const user = getUserById(like.userId);
                  return (
                    <div
                      key={like.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLikesList(false);
                        router.push(like.userId === currentUser?.id ? '/profile' : `/profile?user=${like.userId}`);
                      }}
                      className="flex items-center gap-3 px-5 py-3 active:bg-white/[0.03] cursor-pointer"
                    >
                      <Avatar name={like.userName} size="sm" src={user?.avatarUrl ?? null} />
                      <p className="text-sm font-medium truncate flex-1">
                        {like.userId === currentUser?.id ? 'You' : like.userName}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
