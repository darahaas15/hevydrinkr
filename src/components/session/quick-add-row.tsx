'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import type { DrinkEntry } from '@/types';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { useAuthStore } from '@/stores/use-auth-store';
import {
  useDrinkPrefsStore,
  selectPrefs,
  selectQuickPicks,
  selectCost,
  entryFromQuickDrink,
} from '@/stores/use-drink-prefs-store';
import { formatCost } from '@/lib/money';
import { hapticMedium } from '@/lib/haptics';

/**
 * One-tap logging for the drinks you actually order.
 *
 * The core loop used to be: open sheet → scroll ~400 library rows → tap. For
 * anyone drinking the same two things all night that is three interactions per
 * drink. Starred drinks come first, then most-recent, so the row stabilises
 * around a regular order within a session or two.
 */
export function QuickAddRow({ onAdd }: { onAdd: (drink: DrinkEntry) => void }) {
  const userId = useAuthStore((s) => s.currentUser?.id);
  const byUser = useDrinkPrefsStore((s) => s.byUser);
  const currency = useDrinkPrefsStore((s) => s.currency);
  const recordUse = useDrinkPrefsStore((s) => s.recordUse);

  const prefs = useMemo(() => selectPrefs(byUser, userId), [byUser, userId]);
  const picks = useMemo(() => selectQuickPicks(prefs, 6), [prefs]);

  if (picks.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] font-semibold text-fg-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
        <Zap className="w-3 h-3" />
        Quick add
      </p>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide [&::-webkit-scrollbar]:hidden -mx-1 px-1 pb-0.5">
        {picks.map((quick) => {
          const cost = selectCost(prefs, quick.definitionId);
          return (
            <motion.button
              key={quick.definitionId}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                hapticMedium();
                // Bump recency so the row reorders toward the current order.
                if (userId) recordUse(userId, quick);
                onAdd(entryFromQuickDrink(quick, cost));
              }}
              aria-label={`Add ${quick.name}`}
              className="shrink-0 flex items-center gap-1.5 pl-2.5 pr-3 py-2 rounded-xl bg-card border border-hairline active:bg-surface-subtle transition-colors"
            >
              <DrinkIcon category={quick.category} className="w-4 h-4" />
              <span className="text-xs font-medium max-w-[110px] truncate">{quick.name}</span>
              {cost !== null && (
                <span className="text-[10px] text-muted">{formatCost(cost, currency)}</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
