'use client';

import { motion } from 'framer-motion';
import { Clock, Wine, Droplets, TrendingUp } from 'lucide-react';
import { formatDuration } from '@/lib/utils';
import { DRINK_CATEGORY_COLORS, DRINK_CATEGORY_ICONS } from '@/lib/constants';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { PhotoGallery } from '@/components/ui/photo-gallery';
import type { DrinkSession } from '@/types';

interface SessionSummaryProps {
  session: DrinkSession;
  onDone: () => void;
}

export function SessionSummary({ session, onDone }: SessionSummaryProps) {
  // Calculate category breakdown
  const categoryCounts: Record<string, number> = {};
  session.drinks.forEach((d) => {
    categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
  });

  const sortedCategories = Object.entries(categoryCounts).sort(([, a], [, b]) => b - a);
  const uniqueDrinks = new Set(session.drinks.map((d) => d.drinkDefinitionId)).size;

  return (
    <div className="fixed inset-0 z-[55] bg-[#09090b] overflow-y-auto">
      <div className="min-h-full px-5 py-8 pb-12">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center max-w-lg mx-auto"
      >
        {/* Header */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="text-6xl mb-4"
        >
          {session.mood === 'legendary' ? '🤩' : session.mood === 'great' ? '😄' : session.mood === 'good' ? '🙂' : session.mood === 'meh' ? '😐' : '🤢'}
        </motion.div>

        <h1 className="text-2xl font-bold mb-1">Session Complete!</h1>
        <p className="text-sm text-zinc-500 mb-6">{session.venue}</p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 w-full mb-6">
          {[
            { icon: Wine, label: 'Drinks', value: session.drinks.length.toString(), color: 'text-accent' },
            { icon: Clock, label: 'Duration', value: formatDuration(session.durationMinutes), color: 'text-cyan-400' },
            { icon: Droplets, label: 'Std Drinks', value: session.totalStandardDrinks.toFixed(1), color: 'text-violet-400' },
            { icon: TrendingUp, label: 'Types', value: new Set(session.drinks.map(d => d.drinkDefinitionId)).size.toString(), color: 'text-amber-400' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4 text-center"
            >
              <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-zinc-500">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Drink Breakdown */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="w-full bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4 mb-6"
        >
          <h3 className="text-sm font-medium text-zinc-500 mb-3">What You Had</h3>

          {/* Emoji row */}
          <div className="flex flex-wrap gap-0.5 mb-3">
            {session.drinks.map((d) => (
              <DrinkIcon key={d.id} category={d.category} className="w-5 h-5" />
            ))}
          </div>

          {/* Categories */}
          <div className="space-y-2">
            {sortedCategories.map(([category, count]) => (
              <div key={category} className="flex items-center gap-2">
                {(() => { const Icon = DRINK_CATEGORY_ICONS[category] || DRINK_CATEGORY_ICONS.custom; return <Icon className="w-4 h-4 shrink-0" style={{ color: DRINK_CATEGORY_COLORS[category] || '#71717a' }} stroke={1.5} />; })()}
                <span className="text-sm capitalize flex-1">{category}</span>
                <span className="text-sm font-mono text-zinc-400">{count}</span>
                <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(count / session.drinks.length) * 100}%`,
                      backgroundColor: DRINK_CATEGORY_COLORS[category] || '#71717a',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-zinc-600 mt-3">
            {uniqueDrinks} unique drink{uniqueDrinks !== 1 ? 's' : ''} tried
          </p>
        </motion.div>

        {/* Photos */}
        {session.photos.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="w-full bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4 mb-6"
          >
            <h3 className="text-sm font-medium text-zinc-500 mb-3">Photos</h3>
            <PhotoGallery photos={session.photos} />
          </motion.div>
        )}

        {/* Done Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          whileTap={{ scale: 0.97 }}
          onClick={onDone}
          className="w-full py-4 rounded-2xl bg-accent text-black font-semibold text-lg"
        >
          Done
        </motion.button>
      </motion.div>
      </div>
    </div>
  );
}
