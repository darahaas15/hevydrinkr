'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFeedStore } from '@/stores/use-feed-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { FeedCard } from '@/components/feed/feed-card';
import { Avatar } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase/client';
import type { UserProfile } from '@/types';

export default function FeedPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'home' | 'discover'>('home');
  const items = useFeedStore((s) => s.items);
  const fetchFeed = useFeedStore((s) => s.fetchFeed);
  const currentUser = useAuthStore((s) => s.currentUser);
  const toggleFollow = useAuthStore((s) => s.toggleFollow);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFeed();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Search users when query changes
  useEffect(() => {
    if (!searchQuery.trim() || tab !== 'discover') {
      setSearchResults([]);
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
            joinedAt: p.created_at,
            isDemo: false,
            followers: [],
            following: [],
          }))
        );
      }
      setSearching(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, tab, currentUser?.id]);

  const followingIds = currentUser?.following || [];
  const homeItems = items.filter(
    (item) => followingIds.includes(item.userId) || item.userId === currentUser?.id
  );
  const discoverItems = items.filter(
    (item) => !followingIds.includes(item.userId) && item.userId !== currentUser?.id
  );
  const displayItems = tab === 'home' ? homeItems : discoverItems;

  const sorted = [...displayItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const showSearchResults = tab === 'discover' && searchQuery.trim().length > 0;

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="px-5 pt-3 pb-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-extrabold tracking-tight">
              hevy<span className="gradient-text">drinkr</span>
            </h1>
            <div className="flex items-center gap-1">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 rounded-xl hover:bg-white/5"
              >
                <RefreshCw className={`w-4.5 h-4.5 text-zinc-500 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              {tab !== 'discover' && (
                <button
                  onClick={() => setTab('discover')}
                  className="p-2 -mr-2 rounded-xl hover:bg-white/5"
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
                onClick={() => { setTab(t); if (t === 'home') setSearchQuery(''); }}
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
                placeholder="Search people..."
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

      {/* Search Results */}
      {showSearchResults && (
        <div className="px-4 py-3">
          {searching && (
            <p className="text-sm text-zinc-600 text-center py-4">Searching...</p>
          )}
          {!searching && searchResults.length === 0 && searchQuery.trim().length > 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-600">No users found</p>
            </div>
          )}
          {!searching && searchResults.length > 0 && (
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
                      <p className="text-[11px] text-zinc-600">@{user.username}</p>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleFollow(user.id)}
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
          )}
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
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="text-4xl mb-4">🍻</span>
                <h3 className="text-base font-semibold text-zinc-400 mb-1">
                  {tab === 'home' ? 'No posts yet' : 'Nothing to discover'}
                </h3>
                <p className="text-sm text-zinc-600 max-w-[240px] mb-4">
                  {tab === 'home'
                    ? 'Start a session to see your first post'
                    : 'Search for people to follow'}
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
              sorted.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                >
                  <FeedCard item={item} />
                </motion.div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
