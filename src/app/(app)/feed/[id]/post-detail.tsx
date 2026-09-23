'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Heart, Share2, Clock, Wine, Send, MoreHorizontal, Trash2, Pencil, X, MessageCircle, Flag } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';
import { getBaseUrl, shareLink } from '@/lib/share';
import { useRouter } from 'next/navigation';
import { useFeedStore } from '@/stores/use-feed-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { useUIStore } from '@/stores/use-ui-store';
import { Avatar } from '@/components/ui/avatar';
import { PhotoGallery } from '@/components/ui/photo-gallery';
import type { FeedComment } from '@/types';
import { formatTimeAgo, formatDuration } from '@/lib/utils';
import { getMilestoneBadge } from '@/lib/milestones';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { MentionText } from '@/components/ui/mention-text';
import { TaggedUsersLine } from '@/components/feed/tagged-users-line';
import { ReportModal } from '@/components/moderation/report-modal';
import Skeleton from '@/components/ui/skeleton';
import { useRouteParam } from '@/hooks/use-route-param';

const MAX_VISIBLE_REPLIES = 2;

export default function PostDetailPage({ params, postId, highlightCommentId }: { params?: Promise<{ id: string }>; postId?: string; highlightCommentId?: string | null }) {
  const routeId = useRouteParam(params, 'id');
  const resolvedId = postId || routeId;
  const router = useRouter();
  const items = useFeedStore((s) => s.items);
  const fetchSinglePost = useFeedStore((s) => s.fetchSinglePost);
  const addLike = useFeedStore((s) => s.addLike);
  const removeLike = useFeedStore((s) => s.removeLike);
  const addComment = useFeedStore((s) => s.addComment);
  const deleteFeedItem = useFeedStore((s) => s.deleteFeedItem);
  const deleteComment = useFeedStore((s) => s.deleteComment);
  const refreshFeedItem = useFeedStore((s) => s.refreshFeedItem);
  const likeComment = useFeedStore((s) => s.likeComment);
  const unlikeComment = useFeedStore((s) => s.unlikeComment);
  const currentUser = useAuthStore((s) => s.currentUser);
  const getUserById = useAuthStore((s) => s.getUserById);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; userName: string } | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLikesList, setShowLikesList] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(highlightCommentId ?? null);
  const [missingPostIds, setMissingPostIds] = useState<Set<string>>(() => new Set());
  const allUsers = useAuthStore((s) => s.allUsers);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestedPostIdsRef = useRef<Set<string>>(new Set());
  const setHideBottomNav = useUIStore((s) => s.setHideBottomNav);
  const setLockMainScroll = useUIStore((s) => s.setLockMainScroll);
  const addToast = useUIStore((s) => s.addToast);

  const item = items.find((i) => i.id === resolvedId);

  // If the post isn't in the store (e.g. deep-link from a notification),
  // fetch it directly from Supabase.
  useEffect(() => {
    if (item && resolvedId) {
      requestedPostIdsRef.current.delete(resolvedId);
      return;
    }

    if (item || !resolvedId || missingPostIds.has(resolvedId) || requestedPostIdsRef.current.has(resolvedId)) {
      return;
    }

    requestedPostIdsRef.current.add(resolvedId);
    let cancelled = false;

    void fetchSinglePost(resolvedId).then((result) => {
      if (cancelled) return;
      if (!result) {
        setMissingPostIds((prev) => {
          const next = new Set(prev);
          next.add(resolvedId);
          return next;
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [item, resolvedId, fetchSinglePost, missingPostIds]);

  // When the post hydrates from a cache that stripped likes/comments arrays
  // (likes.length === 0 but likeCount > 0, etc.), kick a one-shot refresh so
  // the comments section and "Liked by..." row backfill instead of staying
  // permanently empty until the next focus refetch.
  const needsRefresh = !!item && (
    (item.likes.length === 0 && item.likeCount > 0) ||
    (item.comments.length === 0 && item.commentCount > 0)
  );
  useEffect(() => {
    if (needsRefresh && resolvedId) {
      void refreshFeedItem(resolvedId);
    }
    // resolvedId is stable for this page; the effect runs once when needsRefresh flips true.
  }, [needsRefresh, resolvedId, refreshFeedItem]);

  // Hide bottom nav for full-screen post experience
  useEffect(() => {
    setHideBottomNav(true);
    setLockMainScroll(true);
    return () => {
      setHideBottomNav(false);
      setLockMainScroll(false);
    };
  }, [setHideBottomNav, setLockMainScroll]);

  // iOS-style edge swipe to go back
  const touchRef = useRef<{ startX: number; startY: number } | null>(null);
  const goBack = useCallback(() => {
    // When opened from a push notification, the PWA may have no real in-app
    // history. window.history.length is unreliable (about:blank entries) and
    // navigation.canGoBack can be true even without a useful destination.
    // Threshold of > 2 avoids the about:blank trap in fresh windows.
    if (window.history.length > 2) {
      router.back();
    } else {
      // Soft navigation (router.push/replace) can silently no-op when the
      // pathname is already /feed. Hard-navigate to guarantee it works.
      window.location.href = '/feed';
    }
  }, [router]);

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

  // When we have a target comment, expand its parent thread and scroll to it.
  useEffect(() => {
    if (!highlightCommentId || !item) return;

    // Give React a tick to render the expanded replies, then scroll
    requestAnimationFrame(() => {
      const el = document.getElementById(`comment-${highlightCommentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Clear the highlight after the flash animation
        setTimeout(() => setHighlightedId(null), 2000);
      }
    });
  }, [highlightCommentId, item]);

  const postHeader = (
    <div
      className="safe-top shrink-0"
      style={{
        background: 'var(--chrome-strong-bg)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        borderBottom: '1px solid var(--chrome-border)',
      }}
    >
      <div className="px-5 py-3 flex items-center gap-3">
        <button onClick={goBack} className="p-2 -ml-2 active:text-foreground">
          <ChevronLeft className="w-6 h-6 text-muted-foreground" />
        </button>
        <h1 className="text-lg font-bold flex-1">Post</h1>
        {item ? (
          item.userId === currentUser?.id ? (
            <button onClick={() => setShowMenu(true)} className="p-2.5 -mr-2.5 rounded-lg hover:bg-surface-subtle active:bg-surface-strong">
              <MoreHorizontal className="w-5 h-5 text-fg-secondary" />
            </button>
          ) : (
            <button onClick={() => setShowReport(true)} className="p-2.5 -mr-2.5 rounded-lg hover:bg-surface-subtle active:bg-surface-strong">
              <Flag className="w-4 h-4 text-fg-secondary" />
            </button>
          )
        ) : (
          <div className="w-10 shrink-0" aria-hidden="true" />
        )}
      </div>
    </div>
  );

  const postLoading = !item && Boolean(resolvedId) && !missingPostIds.has(resolvedId);

  if (!item) {
    if (postLoading) {
      return (
        <div className="visual-viewport-shell fixed inset-x-0 z-[61] bg-background">
          <div className="mx-auto flex h-full max-w-lg flex-col overflow-hidden bg-background">
            {postHeader}
            <div className="flex-1 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-track border-t-accent rounded-full animate-spin" />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="visual-viewport-shell fixed inset-x-0 z-[61] bg-background">
        <div className="mx-auto flex h-full max-w-lg flex-col overflow-hidden bg-background">
          {postHeader}
          <div className="flex-1 flex items-center justify-center">
            <p className="text-fg-secondary">Post not found</p>
          </div>
        </div>
      </div>
    );
  }

  const milestone = getMilestoneBadge(item, items);
  const userLike = item.likes.find((l) => l.userId === currentUser?.id);
  const isLiked = userLike != null || (item.likes.length === 0 && item.currentUserLikeId != null);
  const s = item.sessionSummary;
  const highlightedThreadId = highlightCommentId
    ? item.comments.find((comment) => comment.replies.some((reply) => reply.id === highlightCommentId))?.id ?? null
    : null;

  const handleLike = () => {
    if (!currentUser) return;
    if (isLiked) {
      const likeId = userLike?.id ?? item.currentUserLikeId;
      if (likeId) removeLike(item.id, likeId);
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
    const url = `${getBaseUrl()}/feed/${resolvedId}`;
    const text = `${item.userName} had ${s.totalDrinks} drinks at ${s.venue} — Drinkr`;
    const result = await shareLink(url, text, text);
    if (result === 'copied') addToast('Link copied!', 'success');
  };

  const totalCommentCount = item.commentCount;

  const focusCommentInput = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const input = inputRef.current;
        if (!input) return;

        try {
          input.focus({ preventScroll: true });
        } catch {
          input.focus();
        }

        const caret = input.value.length;
        input.setSelectionRange(caret, caret);
      });
    });
  };

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
    setMentionQuery(null);
    setReplyingTo(null);
    focusCommentInput();
  };

  const handleReply = (comment: FeedComment) => {
    // Replying to a reply targets the parent thread (1-level nesting)
    const targetId = comment.parentCommentId ?? comment.id;
    const targetName = comment.userName;
    setExpandedThreads((prev) => new Set(prev).add(targetId));
    setReplyingTo({ commentId: targetId, userName: targetName });
    focusCommentInput();
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
    <div className="visual-viewport-shell fixed inset-x-0 z-[61] bg-background">
      <div className="mx-auto flex h-full max-w-lg flex-col overflow-hidden bg-background">
        {postHeader}

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="px-5 py-4 pb-6">
            {/* User row */}
            <div className="flex items-center gap-3 mb-4">
              <Avatar name={item.userName} size="md" src={item.userAvatar} />
              <div className="flex-1">
                <p className="text-sm font-semibold cursor-pointer" onClick={() => goToUser(item.userId)}>{item.userName}</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] text-muted">{formatTimeAgo(item.createdAt)}</p>
                  {milestone && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold leading-none">
                      {milestone.label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {item.caption && (
              <p className="text-[13px] text-fg-strong mb-3">{item.caption}</p>
            )}

            {/* Tagged people */}
            <TaggedUsersLine taggedUserIds={item.taggedUserIds ?? []} className="mb-3" />

            {/* Photos */}
            {item.photos && item.photos.length > 0 && (
              <div className="-mx-5 mb-4">
                <PhotoGallery photos={item.photos} variant="feed" />
              </div>
            )}

            {/* Session details */}
            <div className="rounded-2xl bg-card border border-hairline p-4 space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-fg-secondary">{s.venue}</p>
                <div className="flex items-center gap-3 text-[11px] text-fg-secondary">
                  <span className="flex items-center gap-1"><Wine className="w-3 h-3" />{s.totalDrinks}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(s.durationMinutes)}</span>
                  <span>{s.totalStandardDrinks.toFixed(1)} std</span>
                </div>
              </div>

              {/* Grouped drinks */}
              {groupedDrinks.length > 0 ? (
                <div className="space-y-1">
                  {groupedDrinks.map((g, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-lg bg-surface-faint">
                      <DrinkIcon category={g.drink.category} className="w-5 h-5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {g.drink.name}{g.count > 1 && <span className="text-fg-secondary font-normal"> x{g.count}</span>}
                        </p>
                        <p className="text-[10px] text-muted">
                          {g.drink.abvPercent}% · {g.drink.volumeMl}ml · {(g.drink.standardDrinks * g.count).toFixed(1)} std
                        </p>
                      </div>
                      <span className="text-[10px] text-fg-faint capitalize">{g.drink.category}</span>
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
            <div className="pb-3 mb-3 border-b border-hairline">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <motion.button whileTap={{ scale: 1.15 }} onClick={handleLike}>
                    <Heart size={18} className={`transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-muted'}`} />
                  </motion.button>
                  {item.likeCount > 0 && (
                    <span className={`text-[11px] ${isLiked ? 'text-red-500' : 'text-muted'}`}>{item.likeCount}</span>
                  )}
                </div>
                <button onClick={handleShare}><Share2 className="w-[18px] h-[18px] text-muted" /></button>
                <span className="text-[11px] text-fg-faint ml-auto">
                  {totalCommentCount} comment{totalCommentCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Liked by — see FeedCard for the same three-state pattern. */}
              {item.likeCount > 0 && item.likes.length === 0 && (
                <div className="flex items-center gap-2 mt-2" aria-hidden="true">
                  <div className="flex -space-x-1.5">
                    {Array.from({ length: Math.min(3, item.likeCount) }).map((_, i) => (
                      <Skeleton key={i} variant="circle" className="w-4 h-4 ring-1 ring-background" />
                    ))}
                  </div>
                  <Skeleton variant="text" className="h-3 w-32" />
                </div>
              )}
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
                          className="ring-1 ring-background"
                        />
                      );
                    })}
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    Liked by <span className="font-semibold text-fg-bright">{item.likes[0].userId === currentUser?.id ? 'you' : item.likes[0].userName}</span>
                    {item.likes.length > 1 && <> and <span className="font-semibold text-fg-bright">{item.likes.length - 1} other{item.likes.length - 1 !== 1 ? 's' : ''}</span></>}
                  </p>
                </button>
              )}
            </div>

            {/* Comments */}
            {item.commentCount === 0 ? (
              <p className="text-sm text-fg-faint text-center py-6">No comments yet — be the first</p>
            ) : item.comments.length === 0 ? (
              <div className="space-y-4" aria-hidden="true">
                {Array.from({ length: Math.min(3, item.commentCount) }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton variant="circle" className="w-8 h-8 shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <Skeleton variant="text" className="h-3 w-full max-w-[260px]" />
                      <Skeleton variant="text" className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {item.comments.map((comment, i) => {
                  const commentLiked = !!comment.likes.find((l) => l.userId === currentUser?.id);
                  const isExpanded = expandedThreads.has(comment.id) || highlightedThreadId === comment.id;
                  const visibleReplies = isExpanded ? comment.replies : comment.replies.slice(0, MAX_VISIBLE_REPLIES);
                  const hiddenCount = comment.replies.length - MAX_VISIBLE_REPLIES;

                  return (
                    <div key={comment.id}>
                      {/* Top-level comment */}
                      <motion.div
                        id={`comment-${comment.id}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`flex gap-3 group rounded-lg transition-colors duration-700 ${highlightedId === comment.id ? 'bg-accent/10 -mx-2 px-2 py-1' : ''}`}
                      >
                        <div onClick={() => goToUser(comment.userId)} className="cursor-pointer">
                          <Avatar name={comment.userName} size="sm" src={comment.userAvatar} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px]">
                            <span className="font-semibold cursor-pointer hover:underline" onClick={() => goToUser(comment.userId)}>{comment.userName}</span>{' '}
                            <MentionText text={comment.text} className="text-muted-foreground" />
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-fg-faint">{formatTimeAgo(comment.createdAt)}</span>
                            <button onClick={() => handleReply(comment)} className="text-[10px] text-muted font-semibold hover:text-muted-foreground active:text-fg-strong py-1 px-1">
                              Reply
                            </button>
                            <button onClick={() => handleCommentLike(comment)} className="flex items-center gap-1 py-1 px-1">
                              <Heart className={`w-3.5 h-3.5 transition-colors ${commentLiked ? 'fill-red-500 text-red-500' : 'text-fg-faint active:text-fg-secondary'}`} />
                              {comment.likes.length > 0 && (
                                <span className={`text-[10px] ${commentLiked ? 'text-red-500' : 'text-fg-faint'}`}>{comment.likes.length}</span>
                              )}
                            </button>
                          </div>
                        </div>
                        {comment.userId === currentUser?.id && (
                          <button
                            onClick={() => deleteComment(item.id, comment.id)}
                            className="p-2 rounded-lg hover:bg-red-500/10 active:bg-red-500/15 self-start"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-fg-faint active:text-danger-fg" />
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
                                id={`comment-${reply.id}`}
                                key={reply.id}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex gap-3 group rounded-lg transition-colors duration-700 ${highlightedId === reply.id ? 'bg-accent/10 -mx-2 px-2 py-1' : ''}`}
                              >
                                <div onClick={() => goToUser(reply.userId)} className="cursor-pointer">
                                  <Avatar name={reply.userName} size="sm" src={reply.userAvatar} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px]">
                                    <span className="font-semibold cursor-pointer hover:underline" onClick={() => goToUser(reply.userId)}>{reply.userName}</span>{' '}
                                    <MentionText text={reply.text} className="text-muted-foreground" />
                                  </p>
                                  <div className="flex items-center gap-3 mt-0.5">
                                    <span className="text-[10px] text-fg-faint">{formatTimeAgo(reply.createdAt)}</span>
                                    <button onClick={() => handleReply(reply)} className="text-[10px] text-muted font-semibold hover:text-muted-foreground active:text-fg-strong py-1 px-1">
                                      Reply
                                    </button>
                                    <button onClick={() => handleCommentLike(reply)} className="flex items-center gap-1 py-1 px-1">
                                      <Heart className={`w-3 h-3 transition-colors ${replyLiked ? 'fill-red-500 text-red-500' : 'text-fg-faint active:text-fg-secondary'}`} />
                                      {reply.likes.length > 0 && (
                                        <span className={`text-[10px] ${replyLiked ? 'text-red-500' : 'text-fg-faint'}`}>{reply.likes.length}</span>
                                      )}
                                    </button>
                                  </div>
                                </div>
                                {reply.userId === currentUser?.id && (
                                  <button
                                    onClick={() => deleteComment(item.id, reply.id)}
                                    className="p-2 rounded-lg hover:bg-red-500/10 active:bg-red-500/15 self-start"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-fg-faint active:text-danger-fg" />
                                  </button>
                                )}
                              </motion.div>
                            );
                          })}
                          {!isExpanded && hiddenCount > 0 && (
                            <button
                              onClick={() => setExpandedThreads((prev) => new Set(prev).add(comment.id))}
                              className="flex items-center gap-1.5 text-[11px] text-muted font-semibold hover:text-muted-foreground active:text-fg-strong py-2"
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
          </div>
        </div>

        <div
          className="comment-input-bar shrink-0"
          style={{
            background: 'var(--chrome-strong-bg)',
            backdropFilter: 'blur(24px) saturate(165%)',
            WebkitBackdropFilter: 'blur(24px) saturate(165%)',
            borderTop: '1px solid var(--card-border)',
            boxShadow: '0 -12px 32px rgba(0,0,0,0.32)',
          }}
        >
          {replyingTo && (
            <div className="px-4 pt-2 pb-0 flex items-center gap-2 max-w-lg mx-auto">
              <span className="text-[11px] text-fg-secondary">
                Replying to <span className="font-semibold text-muted-foreground">@{replyingTo.userName}</span>
              </span>
              <button onClick={() => setReplyingTo(null)} className="p-2 rounded hover:bg-surface-subtle active:bg-surface-strong">
                <X className="w-3.5 h-3.5 text-muted" />
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleComment();
            }}
            className="px-4 py-2 flex gap-2.5 items-center max-w-lg mx-auto"
          >
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
                  <div className="absolute bottom-full mb-1 left-0 right-0 rounded-xl bg-zinc-900 border border-border-strong shadow-lg overflow-hidden z-10">
                    {matches.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-raised active:bg-surface-strong transition-colors"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => {
                          // Replace the @query with @username
                          const beforeMention = commentText.slice(0, commentText.lastIndexOf('@'));
                          setCommentText(`${beforeMention}@${user.username} `);
                          setMentionQuery(null);
                          focusCommentInput();
                        }}
                      >
                        <Avatar name={user.displayName} size="sm" src={user.avatarUrl} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{user.displayName}</p>
                          <p className="text-[10px] text-muted">@{user.username}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })()}
              {/* Keep the mobile font size at 16px so iOS does not zoom the page on focus. */}
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
                className="w-full px-3.5 py-2 rounded-full bg-surface-raised border border-card-border text-[16px] md:text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/40 transition-colors"
              />
            </div>
            <motion.button
              type="submit"
              whileTap={{ scale: 0.9 }}
              disabled={!commentText.trim()}
              className="p-2 rounded-full bg-accent disabled:opacity-20 transition-opacity"
            >
              <Send className="w-4 h-4 text-accent-foreground" />
            </motion.button>
          </form>
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
              style={{ background: 'var(--popover-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }}
            >
              <button
                onClick={() => {
                  setShowMenu(false);
                  router.push(`/session/edit?id=${item.sessionId}`);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-surface-subtle transition-colors"
              >
                <Pencil className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Edit Post</span>
              </button>
              <button
                onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-red-500/5 transition-colors"
              >
                <Trash2 className="w-4 h-4 text-danger-fg" />
                <span className="text-sm text-danger-fg">Delete Post</span>
              </button>
              <button
                onClick={() => setShowMenu(false)}
                className="w-full py-3 mt-2 rounded-xl bg-surface-secondary text-sm text-muted-foreground font-medium"
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
              style={{ background: 'var(--popover-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }}
            >
              <Trash2 className="w-8 h-8 text-danger-fg mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-1">Delete post?</h3>
              <p className="text-sm text-fg-secondary mb-5">This can&apos;t be undone</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-surface-secondary text-muted-foreground font-medium text-sm"
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
                  className="flex-1 py-3 rounded-xl bg-red-500/20 text-danger-fg font-bold text-sm"
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
              style={{ background: 'var(--popover-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }}
            >
              <div className="px-5 py-4 flex items-center justify-between border-b border-hairline">
                <h3 className="text-base font-bold">Likes</h3>
                <button onClick={() => setShowLikesList(false)} className="p-2 rounded-lg hover:bg-surface-subtle active:bg-surface-strong">
                  <X className="w-5 h-5 text-fg-secondary" />
                </button>
              </div>
              <div className="max-h-[60dvh] overflow-y-auto">
                {item.likes.length === 0 && item.likeCount > 0 ? (
                  <div aria-hidden="true">
                    {Array.from({ length: Math.min(5, item.likeCount) }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-3">
                        <Skeleton variant="circle" className="w-8 h-8" />
                        <Skeleton variant="text" className="h-4 w-32" />
                      </div>
                    ))}
                  </div>
                ) : item.likes.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm text-muted">No likes yet</p>
                  </div>
                ) : (
                  item.likes.map((like) => (
                    <div
                      key={like.id}
                      onClick={() => { setShowLikesList(false); goToUser(like.userId); }}
                      className="flex items-center gap-3 px-5 py-3 active:bg-card cursor-pointer"
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

      <ReportModal
        open={showReport}
        onClose={() => setShowReport(false)}
        targetType="post"
        targetId={item.id}
        targetLabel={`Post by ${item.userName}`}
      />
    </div>
  );
}
