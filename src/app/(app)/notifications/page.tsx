'use client';

import { useEffect } from 'react';
import { useAppRouter } from '@/hooks/use-app-router';
import { Heart, MessageCircle, AtSign, UserPlus, Users, Flame, Clock, Bell, CheckCheck, ChevronLeft, ImageIcon } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useNotificationStore, Notification } from '@/stores/use-notification-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { formatTimeAgo } from '@/lib/utils';

const TYPE_ICON: Record<string, { icon: typeof Heart; color: string }> = {
  like:              { icon: Heart,         color: 'text-red-400 bg-red-500/15' },
  comment_like:      { icon: Heart,         color: 'text-red-400 bg-red-500/15' },
  comment:           { icon: MessageCircle, color: 'text-blue-400 bg-blue-500/15' },
  reply:             { icon: MessageCircle, color: 'text-blue-400 bg-blue-500/15' },
  mention:           { icon: AtSign,        color: 'text-purple-400 bg-purple-500/15' },
  follow:            { icon: UserPlus,      color: 'text-emerald-400 bg-emerald-500/15' },
  group_join:        { icon: Users,         color: 'text-amber-400 bg-amber-500/15' },
  new_post:          { icon: ImageIcon,      color: 'text-teal-400 bg-teal-500/15' },
  weekly_roast:      { icon: Flame,         color: 'text-orange-400 bg-orange-500/15' },
  still_drinking:    { icon: Clock,         color: 'text-amber-400 bg-amber-500/15' },
};

function getNotificationPath(n: Notification): string {
  const d = n.data;
  if (['like', 'comment_like', 'comment', 'reply', 'mention', 'new_post'].includes(n.type) && d.feedItemId) {
    return `/feed?post=${d.feedItemId}`;
  }
  if (n.type === 'follow' && n.actorId) {
    return `/profile/${n.actorId}`;
  }
  if (['group_join', 'weekly_roast'].includes(n.type) && d.groupId) {
    return `/groups?id=${d.groupId}`;
  }
  if (n.type === 'still_drinking') {
    return '/session';
  }
  return '/feed';
}

export default function NotificationsPage() {
  const router = useAppRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const loading = useNotificationStore((s) => s.loading);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);

  useEffect(() => {
    if (currentUser?.id) fetchNotifications(currentUser.id);
  }, [currentUser?.id, fetchNotifications]);

  const handleTap = (n: Notification) => {
    router.push(getNotificationPath(n));
    // Defer so the state update + persist write don't get batched with navigation
    // inside the view transition, which caused jank and swallowed taps.
    if (!n.read) setTimeout(() => markAsRead(n.id), 0);
  };

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between h-14 px-4">
          <div className="w-10 flex items-center">
            <button
              onClick={() => router.back()}
              aria-label="Back"
              className="p-2 -ml-2 text-zinc-400 hover:text-white active:text-white transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          </div>
          <h1 className="text-base font-semibold text-white">Notifications</h1>
          <div className="w-10 flex items-center justify-end">
            {unreadCount > 0 && (
              <button
                onClick={() => currentUser?.id && markAllAsRead(currentUser.id)}
                className="p-2 -mr-2 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                <CheckCheck size={20} className="text-zinc-400" aria-label="Mark all as read" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        {loading && notifications.length === 0 ? (
          <div className="px-4 py-4 space-y-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-white/5" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 rounded bg-white/5 max-w-[200px]" />
                  <div className="h-2.5 rounded bg-white/5 max-w-[100px]" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="w-10 h-10 text-zinc-700 mb-3" />
            <h3 className="text-base font-semibold text-zinc-400 mb-1">No notifications</h3>
            <p className="text-sm text-zinc-600 max-w-[240px]">
              When someone likes, comments, or follows you, it&apos;ll show up here
            </p>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-1.5">
            {notifications.map((n) => {
              const typeInfo = TYPE_ICON[n.type] ?? { icon: Bell, color: 'text-zinc-400 bg-zinc-500/15' };
              const Icon = typeInfo.icon;

              return (
                <button
                  key={n.id}
                  onClick={() => handleTap(n)}
                  className={`w-full text-left rounded-xl p-3 flex items-center gap-3 transition-colors active:bg-white/[0.06] ${
                    n.read
                      ? 'bg-white/[0.02] border border-white/[0.04]'
                      : 'bg-white/[0.05] border border-white/[0.08]'
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
                    <p className={`text-sm leading-snug ${n.read ? 'text-zinc-400' : 'text-white font-medium'}`}>
                      {n.body}
                    </p>
                    {['comment', 'reply', 'mention'].includes(n.type) && !!n.data.commentPreview && (
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">
                        &ldquo;{String(n.data.commentPreview)}&rdquo;
                      </p>
                    )}
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {formatTimeAgo(n.createdAt)}
                    </p>
                  </div>

                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
