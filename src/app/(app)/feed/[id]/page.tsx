'use client';

import { use, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Heart, Share2, Clock, Wine, Send, MoreHorizontal, Trash2, Pencil, Plus, X, Camera, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFeedStore } from '@/stores/use-feed-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { Avatar } from '@/components/ui/avatar';
import { PhotoGallery } from '@/components/ui/photo-gallery';
import { DrinkPicker } from '@/components/session/drink-picker';
import { pickImage, compressImage } from '@/lib/image-utils';
import type { FeedItem, FeedComment } from '@/types';
import { formatTimeAgo, formatDuration } from '@/lib/utils';
import { getMilestoneBadge } from '@/lib/milestones';

const MAX_VISIBLE_REPLIES = 2;

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
  const likeComment = useFeedStore((s) => s.likeComment);
  const unlikeComment = useFeedStore((s) => s.unlikeComment);
  const currentUser = useAuthStore((s) => s.currentUser);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; userName: string } | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [editDrinks, setEditDrinks] = useState<FeedItem['sessionSummary']['drinks']>([]);
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [showDrinkPicker, setShowDrinkPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLikesList, setShowLikesList] = useState(false);
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

  const milestone = getMilestoneBadge(item, items);
  const userLike = item.likes.find((l) => l.userId === currentUser?.id);
  const isLiked = !!userLike;
  const s = item.sessionSummary;

  const handleLike = () => {
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

  const totalCommentCount = item.comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);

  const handleComment = () => {
    if (!commentText.trim() || !currentUser) return;
    const parentId = replyingTo?.commentId ?? null;
    addComment(
      item.id,
      {
        id: crypto.randomUUID(),
        userId: currentUser.id,
        userName: currentUser.displayName,
        userAvatar: currentUser.avatarUrl,
        text: commentText.trim(),
        parentCommentId: parentId,
        likes: [],
        replies: [],
        createdAt: new Date().toISOString(),
      },
      parentId,
    );
    // Auto-expand the thread when a reply is posted
    if (parentId) {
      setExpandedThreads((prev) => new Set(prev).add(parentId));
    }
    setCommentText('');
    setReplyingTo(null);
    inputRef.current?.focus();
  };

  const handleReply = (comment: FeedComment) => {
    // Replying to a reply targets the parent thread (1-level nesting)
    const targetId = comment.parentCommentId ?? comment.id;
    const targetName = comment.userName;
    setReplyingTo({ commentId: targetId, userName: targetName });
    inputRef.current?.focus();
  };

  const handleCommentLike = (comment: FeedComment) => {
    if (!currentUser) return;
    const existingLike = comment.likes.find((l) => l.userId === currentUser.id);
    if (existingLike) {
      unlikeComment(item.id, comment.id, existingLike.id);
    } else {
      likeComment(item.id, comment.id);
    }
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
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] text-zinc-600">{formatTimeAgo(item.createdAt)}</p>
              {milestone && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-accent text-black text-[10px] font-semibold leading-none">
                  {milestone.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {item.caption && (
          <p className="text-[13px] text-zinc-300 mb-3">{item.caption}</p>
        )}

        {/* Photos */}
        {item.photos && item.photos.length > 0 && (
          <div className="-mx-5 mb-4">
            <PhotoGallery photos={item.photos} variant="feed" />
          </div>
        )}

        {/* Session details */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4 space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-zinc-500">{s.venue}</p>
            <div className="flex items-center gap-3 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1"><Wine className="w-3 h-3" />{s.totalDrinks}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(s.durationMinutes)}</span>
              <span>{s.totalStandardDrinks.toFixed(1)} std</span>
            </div>
          </div>

          {/* Individual drinks */}
          {s.drinks && s.drinks.length > 0 ? (
            <div className="space-y-1.5">
              {s.drinks.map((drink, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-lg bg-white/[0.02]">
                  <span className="text-xl">{drink.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{drink.name}</p>
                    <p className="text-[10px] text-zinc-600">
                      {drink.abvPercent}% · {drink.volumeMl}ml · {drink.standardDrinks.toFixed(1)} std
                    </p>
                  </div>
                  <span className="text-[10px] text-zinc-700 capitalize">{drink.category}</span>
                </div>
              ))}
            </div>
          ) : (
            /* Fallback for old posts without drink details */
            s.drinkEmojis.length > 0 && (
              <div className="flex flex-wrap gap-0.5">
                {s.drinkEmojis.map((emoji, i) => (
                  <span key={i} className="text-lg">{emoji}</span>
                ))}
              </div>
            )
          )}
        </div>

        {/* Actions */}
        <div className="pb-4 mb-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-5">
            <motion.button whileTap={{ scale: 1.15 }} onClick={handleLike} className="flex items-center gap-1.5">
              <Heart className={`w-5 h-5 transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-zinc-600'}`} />
            </motion.button>
            {item.likes.length > 0 && (
              <button onClick={() => setShowLikesList(true)} className="flex items-center">
                <span className={`text-xs ${isLiked ? 'text-red-500' : 'text-zinc-600'}`}>{item.likes.length}</span>
              </button>
            )}
            <button onClick={handleShare}><Share2 className="w-[18px] h-[18px] text-zinc-600" /></button>
            <span className="text-[11px] text-zinc-700 ml-auto">
              {totalCommentCount} comment{totalCommentCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Comments */}
        {item.comments.length === 0 ? (
          <p className="text-sm text-zinc-700 text-center py-6">No comments yet — be the first</p>
        ) : (
          <div className="space-y-4">
            {item.comments.map((comment, i) => {
              const commentLiked = !!comment.likes.find((l) => l.userId === currentUser?.id);
              const isExpanded = expandedThreads.has(comment.id);
              const visibleReplies = isExpanded ? comment.replies : comment.replies.slice(0, MAX_VISIBLE_REPLIES);
              const hiddenCount = comment.replies.length - MAX_VISIBLE_REPLIES;

              return (
                <div key={comment.id}>
                  {/* Top-level comment */}
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex gap-3 group"
                  >
                    <div onClick={() => goToUser(comment.userId)} className="cursor-pointer">
                      <Avatar name={comment.userName} size="sm" src={comment.userAvatar} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px]">
                        <span className="font-semibold cursor-pointer hover:underline" onClick={() => goToUser(comment.userId)}>{comment.userName}</span>{' '}
                        <span className="text-zinc-400">{comment.text}</span>
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-zinc-700">{formatTimeAgo(comment.createdAt)}</span>
                        <button onClick={() => handleReply(comment)} className="text-[10px] text-zinc-600 font-semibold hover:text-zinc-400">
                          Reply
                        </button>
                        <button onClick={() => handleCommentLike(comment)} className="flex items-center gap-1">
                          <Heart className={`w-3 h-3 transition-colors ${commentLiked ? 'fill-red-500 text-red-500' : 'text-zinc-700 hover:text-zinc-500'}`} />
                          {comment.likes.length > 0 && (
                            <span className={`text-[10px] ${commentLiked ? 'text-red-500' : 'text-zinc-700'}`}>{comment.likes.length}</span>
                          )}
                        </button>
                      </div>
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

                  {/* Replies */}
                  {comment.replies.length > 0 && (
                    <div className="ml-11 mt-2 space-y-3">
                      {visibleReplies.map((reply) => {
                        const replyLiked = !!reply.likes.find((l) => l.userId === currentUser?.id);
                        return (
                          <motion.div
                            key={reply.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex gap-3 group"
                          >
                            <div onClick={() => goToUser(reply.userId)} className="cursor-pointer">
                              <Avatar name={reply.userName} size="sm" src={reply.userAvatar} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px]">
                                <span className="font-semibold cursor-pointer hover:underline" onClick={() => goToUser(reply.userId)}>{reply.userName}</span>{' '}
                                <span className="text-zinc-400">{reply.text}</span>
                              </p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[10px] text-zinc-700">{formatTimeAgo(reply.createdAt)}</span>
                                <button onClick={() => handleReply(reply)} className="text-[10px] text-zinc-600 font-semibold hover:text-zinc-400">
                                  Reply
                                </button>
                                <button onClick={() => handleCommentLike(reply)} className="flex items-center gap-1">
                                  <Heart className={`w-2.5 h-2.5 transition-colors ${replyLiked ? 'fill-red-500 text-red-500' : 'text-zinc-700 hover:text-zinc-500'}`} />
                                  {reply.likes.length > 0 && (
                                    <span className={`text-[10px] ${replyLiked ? 'text-red-500' : 'text-zinc-700'}`}>{reply.likes.length}</span>
                                  )}
                                </button>
                              </div>
                            </div>
                            {reply.userId === currentUser?.id && (
                              <button
                                onClick={() => deleteComment(item.id, reply.id)}
                                className="p-1 rounded-lg hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity self-start mt-0.5"
                              >
                                <Trash2 className="w-3 h-3 text-zinc-700 hover:text-red-400" />
                              </button>
                            )}
                          </motion.div>
                        );
                      })}
                      {!isExpanded && hiddenCount > 0 && (
                        <button
                          onClick={() => setExpandedThreads((prev) => new Set(prev).add(comment.id))}
                          className="flex items-center gap-1.5 text-[11px] text-zinc-600 font-semibold hover:text-zinc-400 py-1"
                        >
                          <MessageCircle className="w-3 h-3" />
                          View {hiddenCount} more {hiddenCount === 1 ? 'reply' : 'replies'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
        {/* Spacer for fixed comment input */}
        <div className="h-16" />
      </div>

      {/* Comment input — floating island above bottom nav */}
      <div className="fixed bottom-[80px] left-0 right-0 z-40 px-4">
        <div className="max-w-lg mx-auto rounded-2xl border border-white/[0.08] overflow-hidden" style={{ background: 'rgba(20,20,24,0.95)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          {replyingTo && (
            <div className="px-4 pt-2.5 pb-0 flex items-center gap-2">
              <span className="text-[11px] text-zinc-500">
                Replying to <span className="font-semibold text-zinc-400">@{replyingTo.userName}</span>
              </span>
              <button onClick={() => setReplyingTo(null)} className="p-0.5 rounded hover:bg-white/5">
                <X className="w-3 h-3 text-zinc-600" />
              </button>
            </div>
          )}
          <div className="px-3 py-2.5 flex gap-2.5 items-center">
            <Avatar name={currentUser?.displayName || 'You'} size="sm" src={currentUser?.avatarUrl || null} />
            <input
              ref={inputRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={replyingTo ? `Reply to @${replyingTo.userName}...` : 'Add a comment...'}
              className="flex-1 px-3.5 py-2 rounded-full bg-white/[0.06] border border-white/[0.06] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40 transition-colors"
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
                  setEditDrinks(s.drinks || []);
                  setEditPhotos(item.photos || []);
                  setShowEditModal(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-white/5 transition-colors"
              >
                <Pencil className="w-4 h-4 text-zinc-400" />
                <span className="text-sm">Edit Post</span>
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
      {/* Edit Post Modal */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-[#09090b] overflow-y-auto"
          >
            <div className="sticky top-0 z-10 safe-top" style={{ background: 'rgba(9,9,11,0.95)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="px-5 py-3 flex items-center justify-between">
                <button onClick={() => setShowEditModal(false)} className="text-sm text-zinc-400">Cancel</button>
                <h2 className="text-sm font-semibold">Edit Post</h2>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    const totalStd = editDrinks.reduce((sum, d) => sum + d.standardDrinks, 0);
                    await updateFeedItem(item.id, {
                      caption: editCaption,
                      photos: editPhotos,
                      sessionSummary: {
                        ...s,
                        totalDrinks: editDrinks.length,
                        totalStandardDrinks: totalStd,
                        drinkEmojis: editDrinks.map((d) => d.emoji),
                        drinks: editDrinks,
                      },
                    });
                    setSaving(false);
                    setShowEditModal(false);
                  }}
                  className="text-sm font-bold text-accent disabled:text-zinc-700"
                >
                  {saving ? 'Saving...' : 'Save'}
                </motion.button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-5 max-w-lg mx-auto">
              {/* Caption */}
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Caption</p>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  placeholder="Write a caption..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40 resize-none"
                />
              </div>

              {/* Drinks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Drinks ({editDrinks.length})
                  </p>
                  <button
                    onClick={() => setShowDrinkPicker(true)}
                    className="flex items-center gap-1 text-xs text-accent font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                {editDrinks.length === 0 ? (
                  <p className="text-sm text-zinc-700 text-center py-4">No drinks — tap Add above</p>
                ) : (
                  <div className="space-y-1.5">
                    {editDrinks.map((drink, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <span className="text-xl">{drink.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{drink.name}</p>
                          <p className="text-[10px] text-zinc-600">
                            {drink.abvPercent}% · {drink.volumeMl}ml · {drink.standardDrinks.toFixed(1)} std
                          </p>
                        </div>
                        <button
                          onClick={() => setEditDrinks((prev) => prev.filter((_, j) => j !== i))}
                          className="p-1.5 rounded-lg hover:bg-red-500/10"
                        >
                          <X className="w-4 h-4 text-zinc-600 hover:text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-zinc-700 mt-2">
                  Total: {editDrinks.reduce((sum, d) => sum + d.standardDrinks, 0).toFixed(1)} std drinks
                </p>
              </div>

              {/* Photos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Photos</p>
                  <button
                    onClick={async () => {
                      const file = await pickImage();
                      if (!file) return;
                      const dataUrl = await compressImage(file);
                      setEditPhotos((prev) => [...prev, dataUrl]);
                    }}
                    className="flex items-center gap-1 text-xs text-accent font-semibold"
                  >
                    <Camera className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                {editPhotos.length > 0 && (
                  <PhotoGallery
                    photos={editPhotos}
                    onRemove={(i) => setEditPhotos((prev) => prev.filter((_, j) => j !== i))}
                  />
                )}
              </div>
            </div>

            {/* Drink Picker */}
            <AnimatePresence>
              {showDrinkPicker && (
                <DrinkPicker
                  onSelect={(drink) => {
                    setEditDrinks((prev) => [...prev, {
                      name: drink.drinkName,
                      emoji: drink.emoji,
                      category: drink.category,
                      abvPercent: drink.abvPercent,
                      volumeMl: drink.volumeMl,
                      standardDrinks: drink.standardDrinks,
                    }]);
                    setShowDrinkPicker(false);
                  }}
                  onClose={() => setShowDrinkPicker(false)}
                />
              )}
            </AnimatePresence>
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

      {/* Likes List Modal */}
      <AnimatePresence>
        {showLikesList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowLikesList(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-sm mx-6 rounded-3xl overflow-hidden"
              style={{ background: '#141418' }}
            >
              <div className="px-5 py-4 flex items-center justify-between border-b border-white/[0.05]">
                <h3 className="text-base font-bold">Likes</h3>
                <button onClick={() => setShowLikesList(false)} className="p-1 rounded-lg hover:bg-white/5">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              <div className="max-h-[60dvh] overflow-y-auto">
                {item.likes.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm text-zinc-600">No likes yet</p>
                  </div>
                ) : (
                  item.likes.map((like) => (
                    <div
                      key={like.id}
                      onClick={() => { setShowLikesList(false); goToUser(like.userId); }}
                      className="flex items-center gap-3 px-5 py-3 active:bg-white/[0.03] cursor-pointer"
                    >
                      <Avatar name={like.userName} size="sm" src={null} />
                      <p className="text-sm font-medium truncate flex-1">
                        {like.userId === currentUser?.id ? 'You' : like.userName}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
