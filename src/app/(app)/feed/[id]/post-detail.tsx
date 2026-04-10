'use client';

import { use, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Heart, Share2, Clock, Wine, Send, MoreHorizontal, Trash2, Pencil, Plus, X, Camera, MessageCircle } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';
import { useRouter } from 'next/navigation';
import { useFeedStore } from '@/stores/use-feed-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { useUIStore } from '@/stores/use-ui-store';
import { Avatar } from '@/components/ui/avatar';
import { PhotoGallery } from '@/components/ui/photo-gallery';
import { DrinkPicker } from '@/components/session/drink-picker';
import { pickImage, compressImage } from '@/lib/image-utils';
import type { FeedItem, FeedComment } from '@/types';
import { formatTimeAgo, formatDuration } from '@/lib/utils';
import { getMilestoneBadge } from '@/lib/milestones';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { MentionText } from '@/components/ui/mention-text';

const MAX_VISIBLE_REPLIES = 2;

export default function PostDetailPage({ params, postId }: { params?: Promise<{ id: string }>; postId?: string }) {
  const resolvedId = postId || (params ? use(params).id : '');
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
  const getUserById = useAuthStore((s) => s.getUserById);
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
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const allUsers = useAuthStore((s) => s.allUsers);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const setHideBottomNav = useUIStore((s) => s.setHideBottomNav);

  const item = items.find((i) => i.id === resolvedId);

  // Hide bottom nav for full-screen post experience
  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  // Enable portal for the fixed comment bar so it renders outside <main>'s
  // scroll container — prevents iOS from locking scroll when the input is focused.
  useEffect(() => setPortalReady(true), []);

  // iOS-style edge swipe to go back
  const touchRef = useRef<{ startX: number; startY: number } | null>(null);
  const goBack = useCallback(() => router.push('/feed'), [router]);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t.clientX < 30) {
        touchRef.current = { startX: t.clientX, startY: t.clientY };
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (!touchRef.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchRef.current.startX;
      const dy = Math.abs(t.clientY - touchRef.current.startY);
      touchRef.current = null;
      if (dx > 80 && dy < 100) goBack();
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, [goBack]);

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
      router.push(`/profile?user=${userId}`);
    }
  };

  const handleShare = async () => {
    const text = `${item.userName} had ${s.totalDrinks} drinks at ${s.venue} — Drinkr`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  const totalCommentCount = item.comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);

  const handleComment = () => {
    if (!commentText.trim() || !currentUser) return;
    hapticLight();
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

  // Group identical drinks by name for compact display
  const groupedDrinks = (() => {
    if (!s.drinks || s.drinks.length === 0) return [];
    const groups: { drink: typeof s.drinks[0]; count: number }[] = [];
    for (const drink of s.drinks) {
      const existing = groups.find(
        (g) => g.drink.name === drink.name && g.drink.abvPercent === drink.abvPercent && g.drink.volumeMl === drink.volumeMl
      );
      if (existing) {
        existing.count++;
      } else {
        groups.push({ drink, count: 1 });
      }
    }
    return groups;
  })();

  return (
    <div className="min-h-full" style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/feed')} className="p-2 -ml-2 active:text-white">
            <ChevronLeft className="w-6 h-6 text-zinc-400" />
          </button>
          <h1 className="text-lg font-bold flex-1">Post</h1>
          {item.userId === currentUser?.id && (
            <button onClick={() => setShowMenu(true)} className="p-2.5 -mr-2.5 rounded-lg hover:bg-white/5 active:bg-white/[0.08]">
              <MoreHorizontal className="w-5 h-5 text-zinc-500" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        {/* User row */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar name={item.userName} size="md" src={item.userAvatar} />
          <div className="flex-1">
            <p className="text-sm font-semibold cursor-pointer" onClick={() => goToUser(item.userId)}>{item.userName}</p>
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

          {/* Grouped drinks */}
          {groupedDrinks.length > 0 ? (
            <div className="space-y-1">
              {groupedDrinks.map((g, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-lg bg-white/[0.02]">
                  <DrinkIcon category={g.drink.category} className="w-5 h-5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {g.drink.name}{g.count > 1 && <span className="text-zinc-500 font-normal"> x{g.count}</span>}
                    </p>
                    <p className="text-[10px] text-zinc-600">
                      {g.drink.abvPercent}% · {g.drink.volumeMl}ml · {(g.drink.standardDrinks * g.count).toFixed(1)} std
                    </p>
                  </div>
                  <span className="text-[10px] text-zinc-700 capitalize">{g.drink.category}</span>
                </div>
              ))}
            </div>
          ) : (
            /* Fallback for old posts without drink details */
            s.drinkEmojis.length > 0 && (
              <div className="flex flex-wrap gap-0.5">
                {s.drinkEmojis.map((_, i) => (
                  <DrinkIcon key={i} category="custom" className="w-4 h-4" />
                ))}
              </div>
            )
          )}
        </div>

        {/* Actions */}
        <div className="pb-3 mb-3 border-b border-white/[0.05]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <motion.button whileTap={{ scale: 1.15 }} onClick={handleLike}>
                <Heart size={18} className={`transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-zinc-600'}`} />
              </motion.button>
              {item.likes.length > 0 && (
                <span className={`text-[11px] ${isLiked ? 'text-red-500' : 'text-zinc-600'}`}>{item.likes.length}</span>
              )}
            </div>
            <button onClick={handleShare}><Share2 className="w-[18px] h-[18px] text-zinc-600" /></button>
            <span className="text-[11px] text-zinc-700 ml-auto">
              {totalCommentCount} comment{totalCommentCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Liked by */}
          {item.likes.length > 0 && (
            <button
              onClick={() => setShowLikesList(true)}
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
                        <MentionText text={comment.text} className="text-zinc-400" />
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-zinc-700">{formatTimeAgo(comment.createdAt)}</span>
                        <button onClick={() => handleReply(comment)} className="text-[10px] text-zinc-600 font-semibold hover:text-zinc-400 active:text-zinc-300 py-1 px-1">
                          Reply
                        </button>
                        <button onClick={() => handleCommentLike(comment)} className="flex items-center gap-1 py-1 px-1">
                          <Heart className={`w-3.5 h-3.5 transition-colors ${commentLiked ? 'fill-red-500 text-red-500' : 'text-zinc-700 active:text-zinc-500'}`} />
                          {comment.likes.length > 0 && (
                            <span className={`text-[10px] ${commentLiked ? 'text-red-500' : 'text-zinc-700'}`}>{comment.likes.length}</span>
                          )}
                        </button>
                      </div>
                    </div>
                    {comment.userId === currentUser?.id && (
                      <button
                        onClick={() => deleteComment(item.id, comment.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 active:bg-red-500/15 self-start"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-zinc-700 active:text-red-400" />
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
                                <MentionText text={reply.text} className="text-zinc-400" />
                              </p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[10px] text-zinc-700">{formatTimeAgo(reply.createdAt)}</span>
                                <button onClick={() => handleReply(reply)} className="text-[10px] text-zinc-600 font-semibold hover:text-zinc-400 active:text-zinc-300 py-1 px-1">
                                  Reply
                                </button>
                                <button onClick={() => handleCommentLike(reply)} className="flex items-center gap-1 py-1 px-1">
                                  <Heart className={`w-3 h-3 transition-colors ${replyLiked ? 'fill-red-500 text-red-500' : 'text-zinc-700 active:text-zinc-500'}`} />
                                  {reply.likes.length > 0 && (
                                    <span className={`text-[10px] ${replyLiked ? 'text-red-500' : 'text-zinc-700'}`}>{reply.likes.length}</span>
                                  )}
                                </button>
                              </div>
                            </div>
                            {reply.userId === currentUser?.id && (
                              <button
                                onClick={() => deleteComment(item.id, reply.id)}
                                className="p-2 rounded-lg hover:bg-red-500/10 active:bg-red-500/15 self-start"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-zinc-700 active:text-red-400" />
                              </button>
                            )}
                          </motion.div>
                        );
                      })}
                      {!isExpanded && hiddenCount > 0 && (
                        <button
                          onClick={() => setExpandedThreads((prev) => new Set(prev).add(comment.id))}
                          className="flex items-center gap-1.5 text-[11px] text-zinc-600 font-semibold hover:text-zinc-400 active:text-zinc-300 py-2"
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
      </div>

      {/* Comment input — portaled to document.body so it lives outside
          the <main> scroll container. This prevents iOS Safari from locking
          scroll when the input is focused with the keyboard open. */}
      {portalReady && createPortal(
        <div
          className="comment-input-bar"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 55,
            background: '#09090b',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {replyingTo && (
            <div className="px-4 pt-2 pb-0 flex items-center gap-2 max-w-lg mx-auto">
              <span className="text-[11px] text-zinc-500">
                Replying to <span className="font-semibold text-zinc-400">@{replyingTo.userName}</span>
              </span>
              <button onClick={() => setReplyingTo(null)} className="p-2 rounded hover:bg-white/5 active:bg-white/[0.08]">
                <X className="w-3.5 h-3.5 text-zinc-600" />
              </button>
            </div>
          )}
          <div className="px-4 py-2 flex gap-2.5 items-center max-w-lg mx-auto">
            <Avatar name={currentUser?.displayName || 'You'} size="sm" src={currentUser?.avatarUrl || null} />
            <div className="flex-1 relative">
              {/* Mention suggestions */}
              {mentionQuery !== null && (() => {
                const q = mentionQuery.toLowerCase();
                const matches = allUsers
                  .filter((u) => u.id !== currentUser?.id && (u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q)))
                  .slice(0, 5);
                if (matches.length === 0) return null;
                return (
                  <div className="absolute bottom-full mb-1 left-0 right-0 rounded-xl bg-zinc-900 border border-white/[0.08] shadow-lg overflow-hidden z-10">
                    {matches.map((user) => (
                      <button
                        key={user.id}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.06] active:bg-white/[0.08] transition-colors"
                        onClick={() => {
                          // Replace the @query with @username
                          const beforeMention = commentText.slice(0, commentText.lastIndexOf('@'));
                          setCommentText(`${beforeMention}@${user.username} `);
                          setMentionQuery(null);
                          inputRef.current?.focus();
                        }}
                      >
                        <Avatar name={user.displayName} size="sm" src={user.avatarUrl} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{user.displayName}</p>
                          <p className="text-[10px] text-zinc-600">@{user.username}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })()}
              <input
                ref={inputRef}
                value={commentText}
                onChange={(e) => {
                  const val = e.target.value;
                  setCommentText(val);
                  // Detect if user is typing a mention
                  const lastAt = val.lastIndexOf('@');
                  if (lastAt >= 0 && !val.slice(lastAt).includes(' ')) {
                    setMentionQuery(val.slice(lastAt + 1));
                  } else {
                    setMentionQuery(null);
                  }
                }}
                placeholder={replyingTo ? `Reply to @${replyingTo.userName}...` : 'Add a comment...'}
                enterKeyHint="send"
                autoCapitalize="sentences"
                className="w-full px-3.5 py-2 rounded-full bg-white/[0.06] border border-white/[0.06] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40 transition-colors"
                onKeyDown={(e) => { if (e.key === 'Enter') { handleComment(); setMentionQuery(null); } }}
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleComment}
              disabled={!commentText.trim()}
              className="p-2 rounded-full bg-accent disabled:opacity-20 transition-opacity"
            >
              <Send className="w-4 h-4 text-black" />
            </motion.button>
          </div>
        </div>,
        document.body
      )}
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
              style={{ background: 'rgba(20,20,24,0.85)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }}
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
                        <DrinkIcon category={drink.category} className="w-5 h-5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{drink.name}</p>
                          <p className="text-[10px] text-zinc-600">
                            {drink.abvPercent}% · {drink.volumeMl}ml · {drink.standardDrinks.toFixed(1)} std
                          </p>
                        </div>
                        <button
                          onClick={() => setEditDrinks((prev) => prev.filter((_, j) => j !== i))}
                          className="p-2.5 rounded-lg hover:bg-red-500/10 active:bg-red-500/15"
                        >
                          <X className="w-4 h-4 text-zinc-600 active:text-red-400" />
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
              style={{ background: 'rgba(20,20,24,0.85)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }}
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
                    router.push('/feed');
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
              style={{ background: 'rgba(20,20,24,0.85)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }}
            >
              <div className="px-5 py-4 flex items-center justify-between border-b border-white/[0.05]">
                <h3 className="text-base font-bold">Likes</h3>
                <button onClick={() => setShowLikesList(false)} className="p-2 rounded-lg hover:bg-white/5 active:bg-white/[0.08]">
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
                      <Avatar name={like.userName} size="sm" src={getUserById(like.userId)?.avatarUrl ?? null} />
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
