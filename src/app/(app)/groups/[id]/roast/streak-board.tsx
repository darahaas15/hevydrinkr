'use client';

import { motion } from 'framer-motion';
import { Repeat } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { AWARD_ICONS } from './award-icons';
import type { RoastStreak } from '@/types/roast';

interface StreakBoardProps {
  streaks: RoastStreak[];
}

export function StreakBoard({ streaks }: StreakBoardProps) {
  const active = streaks.filter((s) => s.currentCount >= 2);
  if (active.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
        <Repeat className="w-3.5 h-3.5" />
        Active Streaks
      </h3>
      <div className="space-y-1.5">
        {active.map((streak, i) => {
          const visual = AWARD_ICONS[streak.awardType];
          const Icon = visual.icon;
          return (
            <motion.div
              key={streak.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-surface-faint border border-border-faint"
            >
              <Avatar name={streak.userName} size="sm" src={streak.userAvatar} />
              <span className="text-sm flex-1 truncate">{streak.userName}</span>
              <div className="flex items-center gap-1.5">
                <div className={`w-4 h-4 rounded flex items-center justify-center ${visual.bg}`}>
                  <Icon className={`w-2.5 h-2.5 ${visual.color}`} />
                </div>
                <span className="text-xs text-fg-secondary">{streak.awardTitle}</span>
              </div>
              <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                {streak.currentCount}w
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
