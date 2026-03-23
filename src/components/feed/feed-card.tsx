'use client';

import { motion } from 'framer-motion';
import { memo } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Share2, Clock, Wine } from 'lucide-react';
import { useAuthStore } from '@/stores/use-auth-store';
import { useFeedStore } from '@/stores/use-feed-store';
import { Avatar } from '@/components/ui/avatar';
import { formatTimeAgo, formatDuration } from '@/lib/utils';
import { getMilestoneBadge } from '@/lib/milestones';
import type { FeedItem } from '@/types';

export const FeedCard = memo(function FeedCard({ item }: { item: FeedItem }) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const allItems = useFeedStore((s) => s.items);
  const addLike = useFeedStore((s) => s.addLike);
  const removeLike = useFeedStore((s) => s.removeLike);
  const milestone = getMilestoneBadge(item, allItems);

  const userLike = item.likes.find((l) => l.userId === currentUser?.id);
  const isLiked = !!userLike;
  const userProfileHref = item.userId === currentUser?.id ? '/profile' : `/profile/${item.userId}`;

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
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
    const text = `${item.userName} had ${item.sessionSummary.totalDrinks} drinks at ${item.sessionSummary.venue}`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  const { sessionSummary: s } = item;

  return (
    <Link href={`/feed/${item.id}`} prefetch={false} className="block">
    <div
      className="feed-card rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden active:bg-white/[0.05] transition-colors cursor-pointer"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <Link href={userProfileHref} onClick={(e) => e.stopPropagation()} className="cursor-pointer">
          <Avatar name={item.userName} size="md" src={item.userAvatar} />
        </Link>
        <Link href={userProfileHref} onClick={(e) => e.stopPropagation()} className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate cursor-pointer hover:underline">{item.userName}</p>
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-zinc-600">{formatTimeAgo(item.createdAt)}</p>
            {milestone && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-accent text-black text-[10px] font-semibold leading-none">
                {milestone.label}
              </span>
            )}
          </div>
        </Link>
      </div>

      {/* Caption */}
      {item.caption && (
        <p className="px-4 pb-2 text-[13px] text-zinc-300">{item.caption}</p>
      )}

      {/* Photos — Instagram style */}
      {item.photos && item.photos.length > 0 && (
        item.photos.length === 1 ? (
          <div className="mb-2">
            <img src={item.photos[0]} alt="" loading="lazy" className="w-full aspect-[4/3] object-cover" />
          </div>
        ) : (
          <div className="mb-2 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide">
            {item.photos.map((photo, i) => (
              <div key={i} className="w-full shrink-0 snap-center">
                <img src={photo} alt="" loading="lazy" className="w-full aspect-[4/3] object-cover" />
              </div>
            ))}
          </div>
        )
      )}

      {/* Session stats */}
      <div className="mx-4 mb-3 rounded-xl bg-white/[0.03] border border-white/[0.04] p-3">
        <p className="text-[11px] text-zinc-500 mb-2">{s.venue}</p>

        {/* Drink emojis */}
        {s.drinkEmojis.length > 0 && (
          <div className="flex flex-wrap gap-px mb-2">
            {s.drinkEmojis.slice(0, 15).map((emoji, i) => (
              <span key={i} className="text-base">{emoji}</span>
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
          <motion.button
            whileTap={{ scale: 1.15 }}
            onClick={handleLike}
            className="flex items-center gap-1.5"
          >
            <Heart size={18} className={`transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-zinc-600'}`} />
            {item.likes.length > 0 && (
              <span className={`text-[11px] ${isLiked ? 'text-red-500' : 'text-zinc-600'}`}>{item.likes.length}</span>
            )}
          </motion.button>

          <span className="flex items-center gap-1.5">
            <MessageCircle size={18} className="text-zinc-600" />
            {(() => {
              const total = item.comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);
              return total > 0 ? <span className="text-[11px] text-zinc-600">{total}</span> : null;
            })()}
          </span>

          <button onClick={handleShare}>
            <Share2 size={18} className="text-zinc-600" />
          </button>
        </div>
      </div>
    </div>
    </Link>
  );
});
