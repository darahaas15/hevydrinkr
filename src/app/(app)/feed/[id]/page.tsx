'use client';

import { use, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Heart, Share2, Clock, Wine, Send, MoreHorizontal, Trash2, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFeedStore } from '@/stores/use-feed-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { Avatar } from '@/components/ui/avatar';
import { PhotoGallery } from '@/components/ui/photo-gallery';
import { formatTimeAgo, formatDuration } from '@/lib/utils';
import { REACTION_EMOJIS } from '@/lib/constants';
import type { ReactionEmoji } from '@/types';

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const items = useFeedStore((s) => s.items);
  const addLike = useFeedStore((s) => s.addLike);
  const removeLike = useFeedStore((s) => s.removeLike);
  const addComment = useFeedStore((s) => s.addComment);
  const deleteFeedItem = useFeedStore((s) => s.deleteFeedItem);
  const updateFeedItem = useFeedStore((s) => s.updateFeedItem);
  const deleteComment = useFeedStore((s) => s.deleteComment);
  const currentUser = useAuthStore((s) => s.currentUser);
  const [commentText, setCommentText] = useState('');
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const item = items.find((i) => i.id === id);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [item?.comments.length]);

  if (!item) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-zinc-500">Post not found</p>
      </div>
    );
  }

  const userLike = item.likes.find((l) => l.userId === currentUser?.id);
  const isLiked = !!userLike;
  const s = item.sessionSummary;

  const handleLike = () => {
    if (!currentUser) return;
    if (isLiked) {
      removeLike(item.id, userLike!.id);
      setShowReactions(false);
    } else {
      setShowReactions(true);
    }
  };

  const handleReact = (emoji: ReactionEmoji) => {
    if (!currentUser) return;
    addLike(item.id, {
      id: crypto.randomUUID(),
      userId: currentUser.id,
      userName: currentUser.displayName,
      emoji,
      createdAt: new Date().toISOString(),
    });
    setShowReactions(false);
  };

  const goToUser = (userId: string) => {
    if (userId === currentUser?.id) {
      router.push('/profile');
    } else {
      router.push(`/profile/${userId}`);
    }
  };

  const handleShare = async () => {
    const text = `${item.userName} had ${s.totalDrinks} drinks at ${s.venue} — hevydrinkr`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  const handleComment = () => {
    if (!commentText.trim() || !currentUser) return;
    addComment(item.id, {
      id: crypto.randomUUID(),
      userId: currentUser.id,
      userName: currentUser.displayName,
      userAvatar: currentUser.avatarUrl,
      text: commentText.trim(),
      createdAt: new Date().toISOString(),
    });
    setCommentText('');
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ChevronLeft className="w-6 h-6 text-zinc-400" />
          </button>
          <h1 className="text-lg font-bold flex-1">Post</h1>
          {item.userId === currentUser?.id && (
            <button onClick={() => setShowMenu(true)} className="p-1.5 -mr-1.5 rounded-lg hover:bg-white/5">
              <MoreHorizontal className="w-5 h-5 text-zinc-500" />
            </button>
          )}
        </div>
      </div>

      {/* Post content */}
      <div className="flex-1 px-5 py-4">
        {/* User row */}
        <div className="flex items-center gap-3 mb-4">
          <div onClick={() => goToUser(item.userId)} className="cursor-pointer">
            <Avatar name={item.userName} size="md" src={item.userAvatar} />
          </div>
          <div className="flex-1 cursor-pointer" onClick={() => goToUser(item.userId)}>
            <p className="text-sm font-semibold hover:underline">{item.userName}</p>
            <p className="text-[11px] text-zinc-600">{formatTimeAgo(item.createdAt)}</p>
          </div>
        </div>

        {editing ? (
          <div className="mb-3 space-y-2">
            <textarea
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              rows={2}
              autoFocus
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-accent/30 text-sm text-white placeholder:text-zinc-600 focus:outline-none resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 bg-white/[0.04]">Cancel</button>
              <button
                onClick={async () => {
                  await updateFeedItem(item.id, { caption: editCaption });
                  setEditing(false);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-black bg-accent"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          item.caption && (
            <p className="text-[13px] text-zinc-300 mb-3">{item.caption}</p>
          )
        )}

        {/* Photos */}
        {item.photos && item.photos.length > 0 && (
          <div className="-mx-5 mb-4">
            <PhotoGallery photos={item.photos} variant="feed" />
          </div>
        )}

        {/* Session card */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4 space-y-2.5 mb-4">
          <p className="text-[11px] text-zinc-500">{s.venue}</p>
          {s.drinkEmojis.length > 0 && (
            <div className="flex flex-wrap gap-px">
              {s.drinkEmojis.map((emoji, i) => (
                <span key={i} className="text-lg">{emoji}</span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1"><Wine className="w-3 h-3" />{s.totalDrinks} drink{s.totalDrinks !== 1 ? 's' : ''}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(s.durationMinutes)}</span>
            <span>{s.totalStandardDrinks.toFixed(1)} std</span>
          </div>
        </div>

        {/* Actions */}
        <div className="relative pb-4 mb-4 border-b border-white/[0.05]">
          <AnimatePresence>
            {showReactions && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="absolute bottom-full mb-1 left-0 flex gap-1.5 px-3 py-2 rounded-full z-10"
                style={{ background: '#1a1a1e', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji as ReactionEmoji)}
                    className="text-xl hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-5">
            <motion.button whileTap={{ scale: 1.15 }} onClick={handleLike} className="flex items-center gap-1.5">
              <Heart className={`w-5 h-5 transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-zinc-600'}`} />
              {item.likes.length > 0 && (
                <span className={`text-xs ${isLiked ? 'text-red-500' : 'text-zinc-600'}`}>{item.likes.length}</span>
              )}
            </motion.button>
            <button onClick={handleShare}><Share2 className="w-[18px] h-[18px] text-zinc-600" /></button>
            <span className="text-[11px] text-zinc-700 ml-auto">
              {item.comments.length} comment{item.comments.length !== 1 ? 's' : ''}
            </span>
          </div>
          {/* Reaction summary */}
          {item.likes.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              {[...new Set(item.likes.map((l) => l.emoji))].map((emoji) => (
                <span key={emoji} className="text-sm">{emoji}</span>
              ))}
              <span className="text-[11px] text-zinc-600 ml-1">
                {item.likes.length === 1 ? item.likes[0].userName : `${item.likes[0].userName} and ${item.likes.length - 1} other${item.likes.length > 2 ? 's' : ''}`}
              </span>
            </div>
          )}
        </div>

        {/* Comments */}
        {item.comments.length === 0 ? (
          <p className="text-sm text-zinc-700 text-center py-6">No comments yet — be the first</p>
        ) : (
          <div className="space-y-4">
            {item.comments.map((comment, i) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex gap-3 group"
              >
                <div onClick={() => goToUser(comment.userId)} className="cursor-pointer">
                  <Avatar name={comment.userName} size="sm" src={comment.userAvatar} />
                </div>
                <div className="flex-1">
                  <p className="text-[13px]">
                    <span className="font-semibold cursor-pointer hover:underline" onClick={() => goToUser(comment.userId)}>{comment.userName}</span>{' '}
                    <span className="text-zinc-400">{comment.text}</span>
                  </p>
                  <p className="text-[10px] text-zinc-700 mt-0.5">{formatTimeAgo(comment.createdAt)}</p>
                </div>
                {comment.userId === currentUser?.id && (
                  <button
                    onClick={() => deleteComment(item.id, comment.id)}
                    className="p-1 rounded-lg hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity self-start mt-1"
                  >
                    <Trash2 className="w-3 h-3 text-zinc-700 hover:text-red-400" />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
        {/* Spacer for fixed comment input */}
        <div className="h-16" />
      </div>

      {/* Comment input — fixed above the bottom nav */}
      <div className="fixed bottom-[72px] left-0 right-0 z-40" style={{ background: '#09090b', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="px-5 py-2.5 flex gap-3 items-center max-w-lg mx-auto">
          <Avatar name={currentUser?.displayName || 'You'} size="sm" src={currentUser?.avatarUrl || null} />
          <input
            ref={inputRef}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40 transition-colors"
            onKeyDown={(e) => e.key === 'Enter' && handleComment()}
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleComment}
            disabled={!commentText.trim()}
            className="p-2.5 rounded-full bg-accent disabled:opacity-20 transition-opacity"
          >
            <Send className="w-4 h-4 text-black" />
          </motion.button>
        </div>
      </div>
      {/* Post Menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowMenu(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-xs mx-6 rounded-3xl p-5 space-y-1"
              style={{ background: '#141418' }}
            >
              <button
                onClick={() => {
                  setShowMenu(false);
                  setEditCaption(item.caption);
                  setEditing(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-white/5 transition-colors"
              >
                <Pencil className="w-4 h-4 text-zinc-400" />
                <span className="text-sm">Edit Caption</span>
              </button>
              <button
                onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-red-500/5 transition-colors"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400">Delete Post</span>
              </button>
              <button
                onClick={() => setShowMenu(false)}
                className="w-full py-3 mt-2 rounded-xl bg-white/[0.04] text-sm text-zinc-400 font-medium"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-xs mx-6 rounded-3xl p-6 text-center"
              style={{ background: '#141418' }}
            >
              <div className="text-3xl mb-3">🗑️</div>
              <h3 className="text-lg font-bold mb-1">Delete post?</h3>
              <p className="text-sm text-zinc-500 mb-5">This can&apos;t be undone</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-white/[0.04] text-zinc-400 font-medium text-sm"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={async () => {
                    setShowDeleteConfirm(false);
                    await deleteFeedItem(item.id);
                    router.back();
                  }}
                  className="flex-1 py-3 rounded-xl bg-red-500/20 text-red-400 font-bold text-sm"
                >
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
