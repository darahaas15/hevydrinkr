'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { DrinkEntry } from '@/types';
import { DrinkIcon } from '@/components/ui/drink-icon';

interface DrinkListProps {
  drinks: DrinkEntry[];
  onRemove: (drinkId: string) => void;
}

export function DrinkList({ drinks, onRemove }: DrinkListProps) {
  if (drinks.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <DrinkIcon category="beer" className="w-10 h-10 mb-3" />
        <p className="text-sm text-zinc-500">No drinks yet</p>
        <p className="text-xs text-zinc-600">Tap + to add your first drink</p>
      </div>
    );
  }

  const reversedDrinks = [...drinks].reverse();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-500">
          Drinks ({drinks.length})
        </h3>
      </div>

      <AnimatePresence initial={false}>
        {reversedDrinks.map((drink, i) => {
          const time = new Date(drink.timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          });

          return (
            <motion.div
              key={drink.id}
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, x: 100 }}
              transition={{ duration: 0.2 }}
              className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 flex items-center gap-3"
            >
              <DrinkIcon category={drink.category} className="w-6 h-6" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{drink.drinkName}</p>
                <p className="text-[10px] text-zinc-500">
                  {drink.abvPercent}% · {drink.volumeMl}ml · {drink.standardDrinks} std
                </p>
              </div>
              <span className="text-xs text-zinc-600 shrink-0">{time}</span>
              <motion.button
                whileTap={{ scale: 0.8 }}
                onClick={() => onRemove(drink.id)}
                className="p-1.5 rounded-lg hover:bg-white/5"
              >
                <X className="w-4 h-4 text-zinc-600" />
              </motion.button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
