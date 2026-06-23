'use client';

import { useEffect, useRef } from 'react';
import { useAppRouter } from '@/hooks/use-app-router';
import { Heart, MessageCircle, AtSign, UserPlus, UserCheck, Users, Trophy, Clock, Bell, CheckCheck, ChevronLeft, ImageIcon, Tag } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useNotificationStore, Notification } from '@/stores/use-notification-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { formatTimeAgo } from '@/lib/utils';

const TYPE_ICON: Record<string, { icon: typeof Heart; color: string }> = {
  like:                     { icon: Heart,         color: 'text-danger-fg bg-red-500/15' },
  comment_like:             { icon: Heart,         color: 'text-danger-fg bg-red-500/15' },
  comment:                  { icon: MessageCircle, color: 'text-blue-fg bg-blue-500/15' },
  reply:                    { icon: MessageCircle, color: 'text-blue-fg bg-blue-500/15' },
  mention:                  { icon: AtSign,        color: 'text-violet-fg bg-purple-500/15' },
  tag:                      { icon: Tag,           color: 'text-pink-fg bg-pink-500/15' },
  follow:                   { icon: UserPlus,      color: 'text-success-fg bg-emerald-500/15' },
  follow_request:           { icon: UserPlus,      color: 'text-success-fg bg-emerald-500/15' },
  follow_request_accepted:  { icon: UserCheck,     color: 'text-success-fg bg-emerald-500/15' },
  group_join:               { icon: Users,         color: 'text-warning-fg bg-amber-500/15' },
  challenge_created:        { icon: Trophy,        color: 'text-warning-fg bg-amber-500/15' },
  new_post:                 { icon: ImageIcon,     color: 'text-accent-text bg-teal-500/15' },
  still_drinking:           { icon: Clock,         color: 'text-warning-fg bg-amber-500/15' },
};

// Maps a notification to the in-app path it should open. KEEP IN SYNC with
// notificationPath() in public/sw.js — tapping a push and tapping the same
// notification here must land on the same screen for every type.
function getNotificationPath(n: Notification): string {
  const d = n.data;
  const feedItemId = d.feedItemId as string | undefined;
  const commentId = d.commentId as string | undefined;
  const groupId = d.groupId as string | undefined;
  const actorId = n.actorId ?? (d.actorId as string | undefined);

  // Post-related → open the post, scrolling to the comment when there is one.
  if (['like', 'comment', 'reply', 'comment_like', 'mention', 'new_post', 'tag'].includes(n.type)) {
    if (!feedItemId) return '/feed';
    return commentId ? `/feed?post=${feedItemId}&comment=${commentId}` : `/feed?post=${feedItemId}`;
  }

  if (n.type === 'follow') return actorId ? `/profile/${actorId}` : '/feed';
  if (n.type === 'follow_request') return '/profile/requests';
  if (n.type === 'follow_request_accepted') return actorId ? `/profile/${actorId}` : '/profile';
  if (n.type === 'group_join' || n.type === 'challenge_created') return groupId ? `/groups?id=${groupId}` : '/feed';
  if (n.type === 'still_drinking') return '/session';

  return '/feed';
}

export default function NotificationsPage() {
  const router = useAppRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const loading = useNotificationStore((s) => s.loading);
  const loadingMore = useNotificationStore((s) => s.loadingMore);
  const hasMore = useNotificationStore((s) => s.hasMore);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const fetchMoreNotifications = useNotificationStore((s) => s.fetchMoreNotifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);

  useEffect(() => {
    if (currentUser?.id) fetchNotifications(currentUser.id);
  }, [currentUser?.id, fetchNotifications]);

  // Infinite scroll: when the sentinel near the bottom enters the viewport,
  // page in older notifications.
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !currentUser?.id || !hasMore) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        fetchMoreNotifications(currentUser.id);
      }
    }, { rootMargin: '200px' });
    io.observe(node);
    return () => io.disconnect();
  }, [currentUser?.id, hasMore, fetchMoreNotifications, notifications.length]);

  const handleTap = (n: Notification) => {
    router.push(getNotificationPath(n));
    // Defer so the state update + persist write don't get batched with navigation
    // inside the view transition, which caused jank and swallowed taps.
    if (!n.read) setTimeout(() => markAsRead(n.id), 0);
  };

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'var(--chrome-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid var(--chrome-border)' }}>
        <div className="flex items-center justify-between h-14 px-4">
          <div className="w-10 flex items-center">
            <button
              onClick={() => router.back()}
              aria-label="Back"
              className="p-2 -ml-2 text-muted-foreground hover:text-foreground active:text-foreground transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground">Notifications</h1>
          <div className="w-10 flex items-center justify-end">
            {unreadCount > 0 && (
              <button
                onClick={() => currentUser?.id && markAllAsRead(currentUser.id)}
                className="p-2 -mr-2 rounded-xl hover:bg-surface-subtle active:bg-surface-hover-strong transition-colors"
              >
                <CheckCheck size={20} className="text-muted-foreground" aria-label="Mark all as read" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        {loading && notifications.length === 0 ? (
          <div className="px-4 py-4 space-y-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-faint border border-border-faint p-3 flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-surface-subtle" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 rounded bg-surface-subtle max-w-[200px]" />
                  <div className="h-2.5 rounded bg-surface-subtle max-w-[100px]" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="w-10 h-10 text-fg-faint mb-3" />
            <h3 className="text-base font-semibold text-muted-foreground mb-1">No notifications</h3>
            <p className="text-sm text-muted max-w-[240px]">
              When someone likes, comments, or follows you, it&apos;ll show up here
            </p>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-1.5">
            {notifications.map((n) => {
              const typeInfo = TYPE_ICON[n.type] ?? { icon: Bell, color: 'text-muted-foreground bg-zinc-500/15' };
              const Icon = typeInfo.icon;

              return (
                <button
                  key={n.id}
                  onClick={() => handleTap(n)}
                  className={`w-full text-left rounded-xl p-3 flex items-center gap-3 transition-colors active:bg-surface-raised ${
                    n.read
                      ? 'bg-surface-faint border border-border-faint'
                      : 'bg-surface-subtle border border-border-strong'
                  }`}
                >
                  <div className="relative shrink-0">
                    <Avatar
                      name={n.actorDisplayName ?? '?'}
                      size="md"
                      src={n.actorAvatarUrl}
                    />
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${typeInfo.color}`}>
                      <Icon size={11} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${n.read ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                      {n.body}
                    </p>
                    {['comment', 'reply', 'mention'].includes(n.type) && !!n.data.commentPreview && (
                      <p className="text-xs text-fg-secondary mt-0.5 truncate">
                        &ldquo;{String(n.data.commentPreview)}&rdquo;
                      </p>
                    )}
                    <p className="text-[11px] text-fg-secondary mt-0.5">
                      {formatTimeAgo(n.createdAt)}
                    </p>
                  </div>

                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  )}
                </button>
              );
            })}

            {hasMore && (
              <div ref={loadMoreRef} className="py-4 flex items-center justify-center">
                {loadingMore && (
                  <div className="w-5 h-5 rounded-full border-2 border-track border-t-zinc-400 animate-spin" />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
