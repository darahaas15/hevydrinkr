'use client';

import { use, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Clock, Wine, Droplets, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/stores/use-session-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { PhotoGallery } from '@/components/ui/photo-gallery';
import { formatDuration } from '@/lib/utils';
import { DRINK_CATEGORY_COLORS, DRINK_CATEGORY_ICONS } from '@/lib/constants';
import { DrinkIcon } from '@/components/ui/drink-icon';

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const session = useSessionStore((s) => s.getSessionById(id));
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const currentUser = useAuthStore((s) => s.currentUser);

  useEffect(() => {
    if (currentUser && !session) {
      fetchSessions(currentUser.id);
    }
  }, [currentUser, session, fetchSessions]);

  // Only show your own sessions
  if (!session || (currentUser && session.userId !== currentUser.id)) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-sm text-zinc-500">{session ? 'Not your session' : 'Session not found'}</p>
      </div>
    );
  }

  const categoryCounts: Record<string, number> = {};
  session.drinks.forEach((d) => {
    categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
  });

  return (
    <div className="min-h-full pb-8">
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ChevronLeft className="w-6 h-6 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-lg font-bold">{session.venue}</h1>
            <p className="text-xs text-zinc-500">
              {new Date(session.startedAt).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Wine, label: 'Drinks', value: session.drinks.length.toString(), color: 'text-accent' },
            { icon: Clock, label: 'Duration', value: formatDuration(session.durationMinutes), color: 'text-cyan-400' },
            { icon: Droplets, label: 'Std Drinks', value: session.totalStandardDrinks.toFixed(1), color: 'text-violet-400' },
            { icon: TrendingUp, label: 'Types', value: new Set(session.drinks.map(d => d.drinkDefinitionId)).size.toString(), color: 'text-amber-400' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4 text-center"
            >
              <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-zinc-500">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Photos */}
        {session.photos.length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4">
            <h3 className="text-sm font-medium text-zinc-500 mb-3">Photos</h3>
            <PhotoGallery photos={session.photos} />
          </div>
        )}

        {/* Breakdown */}
        {Object.keys(categoryCounts).length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4">
            <h3 className="text-sm font-medium text-zinc-500 mb-3">Drink Breakdown</h3>
            {Object.entries(categoryCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count]) => (
                <div key={category} className="flex items-center gap-2 py-1.5">
                  {(() => { const Icon = DRINK_CATEGORY_ICONS[category] || DRINK_CATEGORY_ICONS.custom; return <Icon className="w-4 h-4 shrink-0" style={{ color: DRINK_CATEGORY_COLORS[category] || '#71717a' }} stroke={1.5} />; })()}
                  <span className="text-sm capitalize flex-1">{category}</span>
                  <span className="text-sm font-mono text-zinc-400">{count}</span>
                  <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
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
            <h3 className="text-sm font-medium text-zinc-500 mb-3">Timeline</h3>
            <div className="space-y-2">
              {session.drinks.map((drink, i) => (
                <motion.div
                  key={drink.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 flex items-center gap-3"
                >
                  <DrinkIcon category={drink.category} className="w-6 h-6" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{drink.drinkName}</p>
                    <p className="text-[10px] text-zinc-500">
                      {drink.abvPercent}% · {drink.volumeMl}ml · {drink.standardDrinks.toFixed(1)} std
                    </p>
                  </div>
                  <span className="text-xs text-zinc-600">
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
            <p className="text-xs text-zinc-600 mt-1 capitalize">{session.mood}</p>
          </div>
        )}
      </div>
    </div>
  );
}
