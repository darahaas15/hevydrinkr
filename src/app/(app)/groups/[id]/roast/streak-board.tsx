'use client';

import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import type { RoastStreak } from '@/types/roast';

interface StreakBoardProps {
  streaks: RoastStreak[];
}

export function StreakBoard({ streaks }: StreakBoardProps) {
  const active = streaks.filter((s) => s.currentCount >= 2);
  if (active.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
        <Flame className="w-3.5 h-3.5" />
        Active Streaks
      </h3>
      <div className="space-y-1.5">
        {active.map((streak, i) => (
          <motion.div
            key={streak.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
          >
            <Avatar name={streak.userName} size="sm" src={streak.userAvatar} />
            <span className="text-sm flex-1 truncate">{streak.userName}</span>
            <span className="text-xs text-zinc-500">{streak.awardTitle}</span>
            <span className="text-xs font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
              {streak.currentCount}w
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
