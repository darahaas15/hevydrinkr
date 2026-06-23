'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Trash2 } from 'lucide-react';
import type { DrinkEntry } from '@/types';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { hapticLight, hapticWarning } from '@/lib/haptics';

export interface DrinkCartItem {
  // Stable identity for this group row (e.g. drinkDefinitionId).
  key: string;
  // Any one drink from the group — used for name/emoji/abv/volume display.
  template: DrinkEntry;
  quantity: number;
}

interface DrinkCartProps {
  items: DrinkCartItem[];
  onInc: (key: string) => void;
  onDec: (key: string) => void;
  onRemove: (key: string) => void;
  // Optional: show the "+ Add" (inc) button. Off when the caller doesn't
  // support adding new drinks of the same type from the row (rare).
  showInc?: boolean;
  // Optional trailing std-drinks total line.
  totalStandardDrinks?: number;
  // Animate list on mount (for live session). Off by default so form usage
  // doesn't animate the cart initializing from existing drinks.
  animate?: boolean;
}

export function DrinkCart({
  items,
  onInc,
  onDec,
  onRemove,
  showInc = true,
  totalStandardDrinks,
  animate = false,
}: DrinkCartProps) {
  const rows = items.map((item) => (
    <motion.div
      key={item.key}
      {...(animate
        ? {
            initial: { opacity: 0, height: 0, y: -10 },
            animate: { opacity: 1, height: 'auto', y: 0 },
            exit: { opacity: 0, height: 0, x: 100 },
            transition: { duration: 0.2 },
          }
        : {})}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card border border-hairline"
    >
      <DrinkIcon category={item.template.category} className="w-5 h-5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.template.drinkName}</p>
        <p className="text-[10px] text-muted">
          {item.template.abvPercent}% · {item.template.volumeMl}ml ·{' '}
          {(item.template.standardDrinks * item.quantity).toFixed(1)} std
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => { hapticLight(); onDec(item.key); }}
          className="w-7 h-7 rounded-lg bg-surface-subtle active:bg-surface-hover-strong flex items-center justify-center"
          aria-label={`Remove one ${item.template.drinkName}`}
        >
          <Minus className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <span className="w-6 text-center text-sm font-mono font-semibold">
          {item.quantity}
        </span>
        {showInc && (
          <button
            onClick={() => { hapticLight(); onInc(item.key); }}
            className="w-7 h-7 rounded-lg bg-surface-subtle active:bg-surface-hover-strong flex items-center justify-center"
            aria-label={`Add one ${item.template.drinkName}`}
          >
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
        <button
          onClick={() => { hapticWarning(); onRemove(item.key); }}
          className="w-7 h-7 rounded-lg active:bg-red-500/10 flex items-center justify-center"
          aria-label={`Remove all ${item.template.drinkName}`}
        >
          <Trash2 className="w-3.5 h-3.5 text-muted" />
        </button>
      </div>
    </motion.div>
  ));

  return (
    <div className="space-y-1.5">
      {animate ? <AnimatePresence initial={false}>{rows}</AnimatePresence> : rows}
      {typeof totalStandardDrinks === 'number' && (
        <p className="text-[10px] text-muted text-center pt-1">
          {totalStandardDrinks.toFixed(1)} std drinks total
        </p>
      )}
    </div>
  );
}
