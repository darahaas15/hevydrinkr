'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Clock, Wine, Droplets, TrendingUp, Pencil, Share2, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/stores/use-session-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { useFeedStore } from '@/stores/use-feed-store';
import { useUIStore } from '@/stores/use-ui-store';
import { useDrinkPrefsStore } from '@/stores/use-drink-prefs-store';
import { PhotoGallery } from '@/components/ui/photo-gallery';
import { formatDuration } from '@/lib/utils';
import { formatCost, sumCosts } from '@/lib/money';
import { DRINK_CATEGORY_COLORS, DRINK_CATEGORY_ICONS } from '@/lib/constants';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { hapticSuccess } from '@/lib/haptics';
import { useRouteParam } from '@/hooks/use-route-param';

export default function SessionDetailPage({ params, sessionId }: { params?: Promise<{ id: string }>; sessionId?: string }) {
  const routeId = useRouteParam(params, 'id');
  const resolvedId = sessionId || routeId;
  const router = useRouter();
  const session = useSessionStore((s) => s.getSessionById(resolvedId));
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const currentUser = useAuthStore((s) => s.currentUser);
  const userPostsMap = useFeedStore((s) => s.userPosts);
  const fetchUserPosts = useFeedStore((s) => s.fetchUserPosts);
  const createFeedItemFromSession = useFeedStore((s) => s.createFeedItemFromSession);
  const addToast = useUIStore((s) => s.addToast);
  const currency = useDrinkPrefsStore((s) => s.currency);
  const [sharing, setSharing] = useState(false);

  // Always fetch, not just on a cache miss. The persisted cache strips photo
  // URLs to stay inside the localStorage quota, so a session restored from it
  // has `photos: []` — which would render an empty gallery and, worse, share
  // a photo-less post. fetchSessions is stale-guarded, so this is cheap.
  useEffect(() => {
    if (currentUser) fetchSessions(currentUser.id);
  }, [currentUser, fetchSessions]);

  // Needed to know whether this session has already been shared.
  useEffect(() => {
    if (currentUser) fetchUserPosts(currentUser.id);
  }, [currentUser, fetchUserPosts]);

  // Only show your own sessions
  if (!session || (currentUser && session.userId !== currentUser.id)) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-sm text-fg-secondary">{session ? 'Not your session' : 'Session not found'}</p>
      </div>
    );
  }

  const categoryCounts: Record<string, number> = {};
  session.drinks.forEach((d) => {
    categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
  });

  const spend = sumCosts(session.drinks);

  const myPosts = currentUser ? userPostsMap[currentUser.id] : undefined;
  // `undefined` = posts not loaded yet; don't offer to share until we know,
  // otherwise a slow fetch would invite a duplicate post.
  const existingPost = myPosts?.find((p) => p.sessionId === session.id);
  const canShare =
    !!currentUser &&
    session.userId === currentUser.id &&
    session.status === 'completed' &&
    myPosts !== undefined &&
    !existingPost;

  const handleShare = async () => {
    if (!currentUser || !canShare || sharing) return;
    setSharing(true);
    hapticSuccess();
    await createFeedItemFromSession(session, currentUser, '', []);
    setSharing(false);
    // createFeedItemFromSession toasts on failure; only confirm on success.
    const posted = useFeedStore
      .getState()
      .userPosts[currentUser.id]?.some((p) => p.sessionId === session.id);
    if (posted) addToast('Shared to your feed', 'success');
  };

  return (
    <div className="min-h-full pb-8">
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'var(--chrome-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid var(--chrome-border)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/session')} className="p-2 -ml-2 active:text-foreground">
            <ChevronLeft className="w-6 h-6 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{session.venue}</h1>
            <p className="text-xs text-fg-secondary">
              {new Date(session.startedAt).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              })}
            </p>
          </div>
          {currentUser && session.userId === currentUser.id && session.status === 'completed' && (
            <button
              onClick={() => router.push(`/session/edit?id=${resolvedId}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-subtle text-fg-strong text-xs font-semibold active:bg-surface-strong"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Wine, label: 'Drinks', value: session.drinks.length.toString(), color: 'text-accent' },
            { icon: Clock, label: 'Duration', value: formatDuration(session.durationMinutes), color: 'text-info-fg' },
            { icon: Droplets, label: 'Std Drinks', value: session.totalStandardDrinks.toFixed(1), color: 'text-violet-fg' },
            { icon: TrendingUp, label: 'Types', value: new Set(session.drinks.map(d => d.drinkDefinitionId)).size.toString(), color: 'text-warning-fg' },
            // Spend only appears once a price was recorded, so sessions
            // logged before/without pricing look exactly as they did.
            ...(spend !== null
              ? [{ icon: Wallet, label: 'Spent', value: formatCost(spend, currency), color: 'text-success-fg' }]
              : []),
          ].map((stat, i, all) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`bg-card border border-hairline rounded-2xl p-4 text-center ${
                // Odd count: let the last tile span the row rather than
                // leaving a ragged gap.
                all.length % 2 === 1 && i === all.length - 1 ? 'col-span-2' : ''
              }`}
            >
              <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-fg-secondary">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Not yet shared — offer it, and make the private state explicit */}
        {canShare && (
          <div className="rounded-2xl bg-card border border-hairline p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Only you can see this</p>
              <p className="text-[11px] text-fg-secondary">Share it to your feed whenever you want</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleShare}
              disabled={sharing}
              className="shrink-0 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-bold disabled:opacity-50"
            >
              {sharing ? 'Sharing…' : 'Share'}
            </motion.button>
          </div>
        )}

        {/* Photos */}
        {session.photos.length > 0 && (
          <div className="bg-card border border-hairline rounded-2xl p-4">
            <h3 className="text-sm font-medium text-fg-secondary mb-3">Photos</h3>
            <PhotoGallery photos={session.photos} />
          </div>
        )}

        {/* Breakdown */}
        {Object.keys(categoryCounts).length > 0 && (
          <div className="bg-card border border-hairline rounded-2xl p-4">
            <h3 className="text-sm font-medium text-fg-secondary mb-3">Drink Breakdown</h3>
            {Object.entries(categoryCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count]) => (
                <div key={category} className="flex items-center gap-2 py-1.5">
                  {(() => { const Icon = DRINK_CATEGORY_ICONS[category] || DRINK_CATEGORY_ICONS.custom; return <Icon className="w-4 h-4 shrink-0" style={{ color: DRINK_CATEGORY_COLORS[category] || '#71717a' }} stroke={1.5} />; })()}
                  <span className="text-sm capitalize flex-1">{category}</span>
                  <span className="text-sm font-mono text-muted-foreground">{count}</span>
                  <div className="w-16 h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(count / session.drinks.length) * 100}%`,
                        backgroundColor: DRINK_CATEGORY_COLORS[category] || '#71717a',
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Drink Timeline */}
        {session.drinks.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-fg-secondary mb-3">Timeline</h3>
            <div className="space-y-2">
              {session.drinks.map((drink, i) => (
                <motion.div
                  key={drink.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card border border-hairline rounded-xl p-3 flex items-center gap-3"
                >
                  <DrinkIcon category={drink.category} className="w-6 h-6" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{drink.drinkName}</p>
                    <p className="text-[10px] text-fg-secondary">
                      {drink.abvPercent}% · {drink.volumeMl}ml · {drink.standardDrinks.toFixed(1)} std
                      {typeof drink.cost === 'number' && <> · {formatCost(drink.cost, currency)}</>}
                    </p>
                  </div>
                  <span className="text-xs text-muted">
                    {new Date(drink.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Mood */}
        {session.mood && (
          <div className="text-center py-2">
            <span className="text-3xl">
              {session.mood === 'legendary' ? '🤩' : session.mood === 'great' ? '😄' : session.mood === 'good' ? '🙂' : session.mood === 'meh' ? '😐' : '🤢'}
            </span>
            <p className="text-xs text-muted mt-1 capitalize">{session.mood}</p>
          </div>
        )}
      </div>
    </div>
  );
}
