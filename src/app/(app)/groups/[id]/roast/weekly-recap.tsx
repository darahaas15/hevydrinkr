'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { AwardCard } from './award-card';
import type { RoastRecap, RoastStreak } from '@/types/roast';

interface WeeklyRecapProps {
  recap: RoastRecap;
  streaks: RoastStreak[];
}

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  e.setDate(e.getDate() - 1); // end is exclusive
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} - ${e.toLocaleDateString('en-US', opts)}`;
}

export function WeeklyRecap({ recap, streaks }: WeeklyRecapProps) {
  const { summary } = recap;
  const wow = summary.weekOverWeekChange;

  return (
    <div className="space-y-3">
      {/* Week header */}
      <div className="text-center">
        <p className="text-[10px] text-zinc-600 uppercase tracking-wider">
          {formatWeekRange(recap.weekStart, recap.weekEnd)}
        </p>
      </div>

      {/* Summary banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4"
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-2xl font-black text-white">
            {Math.round(summary.totalGroupStandardDrinks * 10) / 10}
          </p>
          {wow !== null && wow !== 0 && (
            <div className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
              wow > 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
            }`}>
              {wow > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {wow > 0 ? '+' : ''}{wow}%
            </div>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          standard drinks across {summary.totalGroupSessions} session{summary.totalGroupSessions !== 1 ? 's' : ''}
          {summary.mostActiveDay && ` \u00B7 peak day: ${summary.mostActiveDay}`}
        </p>
        <p className="text-[10px] text-zinc-700 mt-1">
          {summary.participatingMemberCount} of {summary.memberCount} members active
        </p>
      </motion.div>

      {/* Awards */}
      {recap.awards.length > 0 ? (
        <div className="space-y-2.5">
          {recap.awards.map((award, i) => {
            const streak = streaks.find(
              (s) => s.userId === award.userId && s.awardType === award.awardType
            );
            return (
              <AwardCard
                key={award.id}
                award={award}
                index={i}
                streakCount={streak?.currentCount}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-sm text-zinc-600">No awards this week</p>
          <p className="text-[10px] text-zinc-700 mt-1">Everyone was a ghost</p>
        </div>
      )}
    </div>
  );
}
