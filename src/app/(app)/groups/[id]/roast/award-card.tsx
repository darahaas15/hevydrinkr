'use client';

import { motion } from 'framer-motion';
import { Avatar } from '@/components/ui/avatar';
import type { RoastAward } from '@/types/roast';

interface AwardCardProps {
  award: RoastAward;
  index: number;
  streakCount?: number;
}

export function AwardCard({ award, index, streakCount }: AwardCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4 space-y-3"
    >
      <div className="flex items-center gap-3">
        <Avatar name={award.userName} size="md" src={award.userAvatar} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{award.userName}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-base">{award.emoji}</span>
            <span className="text-xs font-bold text-accent">{award.title}</span>
            {streakCount && streakCount >= 2 && (
              <span className="text-[10px] bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded-full font-bold">
                x{streakCount}
              </span>
            )}
          </div>
        </div>
        {award.statLabel && (
          <div className="shrink-0 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <span className="text-[11px] font-mono font-bold text-zinc-400">{award.statLabel}</span>
          </div>
        )}
      </div>

      <p className="text-sm text-zinc-400 leading-relaxed italic">
        &ldquo;{award.roastLine}&rdquo;
      </p>
    </motion.div>
  );
}
