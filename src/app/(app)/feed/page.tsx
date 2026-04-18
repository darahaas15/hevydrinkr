'use client';

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Bell } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFeedStore } from '@/stores/use-feed-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { FeedCard } from '@/components/feed/feed-card';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { SuggestedPeopleCarousel } from '@/components/feed/suggested-people-carousel';
import { Avatar } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase/client';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { useModerationStore } from '@/stores/use-moderation-store';
import { useNotificationStore } from '@/stores/use-notification-store';
import { getMilestoneBadge } from '@/lib/milestones';
import { hapticSelection, hapticLight } from '@/lib/haptics';
import { ErrorBanner } from '@/components/ui/error-banner';
import PostDetailPage from './[id]/post-detail';
import type { UserProfile } from '@/types';
import type { FeedItem } from '@/types/feed';

export default function FeedPage() {
  return (
    <Suspense>
      <FeedPageInner />
    </Suspense>
  );
}

function FeedPageInner() {
  const searchParams = useSearchParams();
  const postId = searchParams.get('post');
  const commentId = searchParams.get('comment');

  if (postId) {
    return <PostDetailPage postId={postId} highlightCommentId={commentId} />;
  }

  return <FeedPageList />;
}

function FeedPageList() {
  const router = useRouter();
  const following = useAuthStore((s) => s.currentUser?.following || []);
  const items = useFeedStore((s) => s.items);
  const currentUser = useAuthStore((s) => s.currentUser);
  const blockedUserIds = useModerationStore((s) => s.blockedUserIds);
  // Default to home unless the home feed has nothing to show.
  // Both stores are Zustand-persisted so this resolves synchronously.
  const hasHomePosts = useMemo(() => {
    const followSet = new Set(following);
    const blockedSet = new Set(blockedUserIds);
    const uid = currentUser?.id;
    return items.some((item) => (followSet.has(item.userId) || item.userId === uid) && !blockedSet.has(item.userId));
  }, [items, following, blockedUserIds, currentUser?.id]);
  const [tab, setTab] = useState<'home' | 'discover'>(hasHomePosts ? 'home' : 'discover');
  const loading = useFeedStore((s) => s.loading);
  const loadingMore = useFeedStore((s) => s.loadingMore);
  const hasMore = useFeedStore((s) => s.hasMore);
  const feedError = useFeedStore((s) => s.error);
  const fetchFeed = useFeedStore((s) => s.fetchFeed);
  const fetchMoreFeed = useFeedStore((s) => s.fetchMoreFeed);
  const toggleFollow = useAuthStore((s) => s.toggleFollow);
  const allUsers = useAuthStore((s) => s.allUsers);
  const fetchAllUsers = useAuthStore((s) => s.fetchAllUsers);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searchFeedResults, setSearchFeedResults] = useState<FeedItem[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    fetchFeed(true);
    fetchAllUsers(true);
    const refetch = () => { fetchFeed(); fetchAllUsers(); };
    window.addEventListener('focus', refetch);
    return () => window.removeEventListener('focus', refetch);
  }, [fetchFeed, fetchAllUsers]);

  // Search users when query changes
  useEffect(() => {
    if (!searchQuery.trim() || tab !== 'discover') {
      setSearchResults([]);
      setSearchFeedResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      const q = searchQuery.trim().toLowerCase();
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq('id', currentUser?.id ?? '')
        .limit(20);

      if (data) {
        setSearchResults(
          data.map((p) => ({
            id: p.id,
            username: p.username,
            displayName: p.display_name,
            avatarUrl: p.avatar_url,
            bio: p.bio || '',
            gender: p.gender || 'other',
            weightKg: p.weight_kg || 70,
            heightCm: p.height_cm || null,
            joinedAt: p.created_at,
            isDemo: false,
            followers: [],
            following: [],
          }))
        );
      }
      // Also search posts client-side
      const matchedPosts = items.filter((item) => {
        const lq = q;
        return (
          item.userId !== currentUser?.id &&
          (item.userName.toLowerCase().includes(lq) ||
           item.caption.toLowerCase().includes(lq) ||
           item.sessionSummary.venue.toLowerCase().includes(lq))
        );
      });
      setSearchFeedResults(matchedPosts);

      setSearching(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, tab, currentUser?.id, items]);

  const followingIds = following;

  const sorted = useMemo(() => {
    const followSet = new Set(followingIds);
    const blockedSet = new Set(blockedUserIds);
    const uid = currentUser?.id;
    const filtered = tab === 'home'
      ? items.filter((item) => (followSet.has(item.userId) || item.userId === uid) && !blockedSet.has(item.userId))
      : items.filter((item) => !followSet.has(item.userId) && item.userId !== uid && !blockedSet.has(item.userId));
    return [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [items, followingIds, currentUser?.id, tab, blockedUserIds]);

  const showSearchResults = tab === 'discover' && searchQuery.trim().length > 0;

  // Non-followed users for discover carousel
  const discoverUsers = useMemo(() => {
    if (!currentUser || tab !== 'discover') return [];
    const followSet = new Set(followingIds);
    const blockedSet = new Set(blockedUserIds);
    return allUsers.filter((u) => u.id !== currentUser.id && !followSet.has(u.id) && !blockedSet.has(u.id));
  }, [allUsers, currentUser, tab, followingIds, blockedUserIds]);

  // Infinite scroll observer. Use a callback ref so the observer attaches the
  // moment the sentinel mounts and detaches when it unmounts — a useEffect keyed
  // on a memoized callback can miss the sentinel's first mount if its deps
  // haven't changed, leaving pagination silently dead until the page remounts.
  // Read pagination state via getState() to dodge stale closures.
  const observerRef = useRef<IntersectionObserver | null>(null);
  const setSentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!node) return;
    observerRef.current = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      const { hasMore, loadingMore, fetchMoreFeed } = useFeedStore.getState();
      if (hasMore && !loadingMore) fetchMoreFeed();
    }, { rootMargin: '200px' });
    observerRef.current.observe(node);
  }, []);
  useEffect(() => () => observerRef.current?.disconnect(), []);

  // Swipe between tabs
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't capture touches originating inside a horizontal carousel
    if ((e.target as HTMLElement).closest('.snap-x')) {
      touchStart.current = null;
      return;
    }
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    // Only trigger if horizontal swipe is dominant and > 60px
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && tab === 'home') { setTab('discover'); }
      else if (dx > 0 && tab === 'discover') { setTab('home'); setSearchQuery(''); }
    }
    touchStart.current = null;
  }, [tab]);

  return (
    <div className="min-h-full" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-5 pt-1 pb-0">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
              <span className="gradient-text">Drinkr</span>
            </h1>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => router.push('/notifications')}
                aria-label="Notifications"
                className="relative p-2 rounded-xl hover:bg-white/5 active:bg-white/[0.08]"
              >
                <Bell className="w-5 h-5 text-zinc-500" />
                {unreadCount > 0 && (
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
              {tab !== 'discover' && (
                <button
                  onClick={() => setTab('discover')}
                  aria-label="Search"
                  className="p-2 -mr-2 rounded-xl hover:bg-white/5 active:bg-white/[0.08]"
                >
                  <Search className="w-5 h-5 text-zinc-500" />
                </button>
              )}
            </div>
          </div>

          <div className="flex">
            {(['home', 'discover'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { hapticSelection(); setTab(t); if (t === 'home') setSearchQuery(''); }}
                className="relative flex-1 py-2.5 text-center text-sm font-medium capitalize"
              >
                <span className={tab === t ? 'text-white' : 'text-zinc-600'}>{t}</span>
                {tab === t && (
                  <motion.div
                    layoutId="feed-tab"
                    className="absolute bottom-0 left-[20%] right-[20%] h-0.5 bg-accent rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Search bar — only on discover tab */}
        {tab === 'discover' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-5 pb-3 pt-2"
          >
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people & posts..."
                autoFocus
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent/40 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-zinc-600" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {feedError && <ErrorBanner message={feedError} onRetry={() => fetchFeed(true)} />}

      <PullToRefresh onRefresh={async () => { await Promise.all([fetchFeed(true), fetchAllUsers(true)]); }}>
      {/* Discover: Search Results */}
      {showSearchResults && (
        <div className="px-4 py-3">
          {searching && (
            <p className="text-sm text-zinc-600 text-center py-4">Searching...</p>
          )}
          {!searching && searchResults.length === 0 && searchFeedResults.length === 0 && searchQuery.trim().length > 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-600">No results found</p>
            </div>
          )}
          {!searching && searchResults.length > 0 && (
            <>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">People</p>
              <div className="space-y-1.5">
                {searchResults.map((user) => {
                  const isFollowing = followingIds.includes(user.id);
                  return (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] active:bg-white/[0.05] transition-colors"
                    >
                      <div onClick={() => router.push(`/profile/${user.id}`)} className="cursor-pointer">
                        <Avatar name={user.displayName} size="md" src={user.avatarUrl} />
                      </div>
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => router.push(`/profile/${user.id}`)}
                      >
                        <p className="text-sm font-semibold truncate">{user.displayName}</p>
                        <p className="text-[11px] text-zinc-500">@{user.username}</p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { hapticLight(); toggleFollow(user.id); }}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isFollowing
                            ? 'bg-white/[0.06] border border-white/[0.08] text-zinc-400'
                            : 'bg-accent text-black'
                        }`}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </motion.button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {!searching && searchFeedResults.length > 0 && (
            <>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 mt-4">Posts</p>
              <div className="space-y-3">
                {searchFeedResults.slice(0, 10).map((item) => (
                  <FeedCard key={item.id} item={item} showFollowButton />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Discover: Suggested people carousel */}
      {tab === 'discover' && !showSearchResults && (
        <AnimatePresence initial={false}>
          {discoverUsers.length > 0 && (
            <motion.div
              key="suggested"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="pt-3 pb-1">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-4">Suggested People</p>
                <SuggestedPeopleCarousel
                  users={discoverUsers}
                  feedItems={items}
                  followingIds={followingIds}
                  onFollow={toggleFollow}
                  onViewProfile={(id) => router.push(`/profile/${id}`)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Discover Posts header */}
      {tab === 'discover' && !showSearchResults && sorted.length > 0 && (
        <div className="px-4 pt-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Discover Posts</p>
        </div>
      )}

      {/* Feed */}
      {!showSearchResults && (
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="px-4 py-4 space-y-3"
          >
            {loading && sorted.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden animate-pulse">
                  <div className="px-4 pt-4 pb-2 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/5" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-28 rounded bg-white/5" />
                      <div className="h-2.5 w-16 rounded bg-white/5" />
                    </div>
                  </div>
                  <div className="px-4 pb-3 space-y-2">
                    <div className="h-3 w-full rounded bg-white/5" />
                    <div className="h-3 w-3/4 rounded bg-white/5" />
                  </div>
                  <div className="mx-4 mb-3 rounded-xl bg-white/[0.02] p-3 space-y-2">
                    <div className="h-2.5 w-24 rounded bg-white/5" />
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <div key={j} className="w-6 h-6 rounded bg-white/5" />
                      ))}
                    </div>
                    <div className="h-2.5 w-40 rounded bg-white/5" />
                  </div>
                  <div className="px-4 pb-3 flex gap-4">
                    <div className="h-4 w-10 rounded bg-white/5" />
                    <div className="h-4 w-10 rounded bg-white/5" />
                    <div className="h-4 w-10 rounded bg-white/5" />
                  </div>
                </div>
              ))
            ) : sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <DrinkIcon category="beer" className="w-10 h-10 mb-4" />
                <h3 className="text-base font-semibold text-zinc-400 mb-1">
                  {tab === 'home' ? 'No posts yet' : 'Nothing to discover'}
                </h3>
                <p className="text-sm text-zinc-600 max-w-[240px] mb-4">
                  {tab === 'home'
                    ? 'Start a session to see your first post'
                    : 'No new posts to discover'}
                </p>
                {tab === 'home' && (
                  <button
                    onClick={() => router.push('/session')}
                    className="px-5 py-2.5 rounded-xl bg-accent text-black text-sm font-bold"
                  >
                    Start Your First Sesh
                  </button>
                )}
              </div>
            ) : (
              <>
                {sorted.map((item, i) => (
                  <div
                    key={item.id}
                    className={i < 5 ? 'animate-slide-up' : ''}
                    style={i < 5 ? { animationDelay: `${i * 30}ms`, animationFillMode: 'both' } : undefined}
                  >
                    <FeedCard item={item} milestone={getMilestoneBadge(item, items)} showFollowButton={tab === 'discover'} />
                  </div>
                ))}
                {/* Infinite scroll sentinel */}
                <div ref={setSentinelRef} className="h-1" />
                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-zinc-700 border-t-accent rounded-full animate-spin" />
                  </div>
                )}
                {!hasMore && sorted.length > 0 && (
                  <p className="text-center text-xs text-zinc-700 py-4">You&apos;re all caught up</p>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      )}
      </PullToRefresh>
    </div>
  );
}
