'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRoastStore } from '@/stores/use-roast-store';
import { WeeklyRecap } from './weekly-recap';
import { StreakBoard } from './streak-board';
import { GroupRecords } from './group-records';
import Skeleton from '@/components/ui/skeleton';
import type { GroupMember } from '@/types/group';

interface RoastSectionProps {
  groupId: string;
  members: GroupMember[];
}

export function RoastSection({ groupId, members }: RoastSectionProps) {
  const fetchRecaps = useRoastStore((s) => s.fetchRecaps);
  const fetchStreaks = useRoastStore((s) => s.fetchStreaks);
  const fetchRecords = useRoastStore((s) => s.fetchRecords);
  const generateRoast = useRoastStore((s) => s.generateRoast);
  const loading = useRoastStore((s) => s.loading);
  const generating = useRoastStore((s) => s.generating);
  const getRecapsByGroup = useRoastStore((s) => s.getRecapsByGroup);
  const getLastWeekKey = useRoastStore((s) => s.getLastWeekKey);
  const hasRecapForWeek = useRoastStore((s) => s.hasRecapForWeek);
  const streaks = useRoastStore((s) => s.streaks).filter((s) => s.groupId === groupId);
  const records = useRoastStore((s) => s.records).filter((r) => r.groupId === groupId);

  const recaps = getRecapsByGroup(groupId).sort((a, b) => b.weekKey.localeCompare(a.weekKey));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const attemptedRef = useRef(false);

  useEffect(() => {
    fetchRecaps(groupId);
    fetchStreaks(groupId);
    fetchRecords(groupId);
    attemptedRef.current = false;
  }, [groupId, fetchRecaps, fetchStreaks, fetchRecords]);

  // Auto-generate roast for last week if it doesn't exist — one attempt only
  useEffect(() => {
    if (attemptedRef.current || generating || loading) return;
    const lastWeek = getLastWeekKey();
    if (members.length >= 2 && !hasRecapForWeek(groupId, lastWeek)) {
      attemptedRef.current = true;
      generateRoast(groupId, lastWeek, members);
    }
  }, [groupId, members, getLastWeekKey, hasRecapForWeek, generating, loading, generateRoast]);

  const selectedRecap = recaps[selectedIndex];

  if (loading && recaps.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5" />
          Weekly Roast
        </h3>
        <div className="space-y-2.5">
          <Skeleton variant="card" className="h-24" />
          <Skeleton variant="card" className="h-32" />
          <Skeleton variant="card" className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5" />
          Weekly Roast
        </h3>

        {generating && recaps.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-6 text-center"
          >
            <div className="inline-block w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin mb-3" />
            <p className="text-sm text-zinc-400">Tallying the damage...</p>
          </motion.div>
        )}

        {!generating && recaps.length === 0 && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-6 text-center">
            <p className="text-2xl mb-2">🔥</p>
            <p className="text-sm text-zinc-400">No roasts yet</p>
            <p className="text-[10px] text-zinc-600 mt-1">
              Log some drinks and the roast drops next week
            </p>
          </div>
        )}

        {/* Week navigation */}
        {recaps.length > 0 && (
          <>
            {recaps.length > 1 && (
              <div className="flex items-center justify-center gap-4 mb-3">
                <button
                  onClick={() => setSelectedIndex((i) => Math.min(i + 1, recaps.length - 1))}
                  disabled={selectedIndex >= recaps.length - 1}
                  className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-20 transition-opacity"
                >
                  <ChevronLeft className="w-4 h-4 text-zinc-400" />
                </button>
                <span className="text-xs font-mono text-zinc-500 min-w-[5rem] text-center">
                  {selectedRecap?.weekKey}
                </span>
                <button
                  onClick={() => setSelectedIndex((i) => Math.max(i - 1, 0))}
                  disabled={selectedIndex <= 0}
                  className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-20 transition-opacity"
                >
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </button>
              </div>
            )}

            {selectedRecap && (
              <WeeklyRecap recap={selectedRecap} streaks={streaks} />
            )}
          </>
        )}
      </div>

      {/* Streak board */}
      <StreakBoard streaks={streaks} />

      {/* Group records */}
      <GroupRecords records={records} />
    </div>
  );
}
