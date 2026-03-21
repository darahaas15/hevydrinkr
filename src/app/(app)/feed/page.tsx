'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useFeedStore } from '@/stores/use-feed-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { FeedCard } from '@/components/feed/feed-card';

export default function FeedPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'home' | 'discover'>('home');
  const items = useFeedStore((s) => s.items);
  const currentUser = useAuthStore((s) => s.currentUser);

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

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="px-5 pt-3 pb-0">
          <h1 className="text-xl font-extrabold tracking-tight mb-3">
            hevy<span className="gradient-text">drinkr</span>
          </h1>

          <div className="flex">
            {(['home', 'discover'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
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
      </div>

      {/* Feed */}
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
                  : 'Check back later'}
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
    </div>
  );
}
