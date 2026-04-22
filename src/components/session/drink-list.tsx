'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Trash2 } from 'lucide-react';
import type { DrinkEntry } from '@/types';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { hapticLight, hapticWarning } from '@/lib/haptics';

interface DrinkListProps {
  drinks: DrinkEntry[];
  onRemove: (drinkId: string) => void;
  onAdd?: (drink: DrinkEntry) => void;
}

interface DrinkGroup {
  defId: string;
  template: DrinkEntry;
  entries: DrinkEntry[];
  quantity: number;
}

export function DrinkList({ drinks, onRemove, onAdd }: DrinkListProps) {
  if (drinks.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <DrinkIcon category="beer" className="w-10 h-10 mb-3" />
        <p className="text-sm text-zinc-500">No drinks yet</p>
        <p className="text-xs text-zinc-600">Tap + to add your first drink</p>
      </div>
    );
  }

  // Group drinks by drinkDefinitionId, ordered by most recent addition
  const groups = useMemo<DrinkGroup[]>(() => {
    const map = new Map<string, DrinkGroup>();
    const order: string[] = [];
    for (const drink of drinks) {
      const defId = drink.drinkDefinitionId;
      const existing = map.get(defId);
      if (existing) {
        existing.entries.push(drink);
        existing.quantity += 1;
      } else {
        order.push(defId);
        map.set(defId, {
          defId,
          template: drink,
          entries: [drink],
          quantity: 1,
        });
      }
    }
    // Reverse so most recently added group is first
    return order.reverse().map((id) => map.get(id)!);
  }, [drinks]);

  const handleAdd = (group: DrinkGroup) => {
    if (!onAdd) return;
    hapticLight();
    // Create a new drink entry based on the template
    const newDrink: DrinkEntry = {
      ...group.template,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      roundId: null,
    };
    onAdd(newDrink);
  };

  const handleRemoveOne = (group: DrinkGroup) => {
    hapticLight();
    // Remove the most recently added entry in this group
    const latest = group.entries[group.entries.length - 1];
    onRemove(latest.id);
  };

  const handleRemoveAll = (group: DrinkGroup) => {
    hapticWarning();
    // Remove all entries in this group
    for (const entry of group.entries) {
      onRemove(entry.id);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-500">
          Drinks ({drinks.length})
        </h3>
      </div>

      <AnimatePresence initial={false}>
        {groups.map((group) => (
          <motion.div
            key={group.defId}
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, x: 100 }}
            transition={{ duration: 0.2 }}
            className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 flex items-center gap-3"
          >
            <DrinkIcon category={group.template.category} className="w-6 h-6" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{group.template.drinkName}</p>
              <p className="text-[10px] text-zinc-500">
                {group.template.abvPercent}% · {group.template.volumeMl}ml · {(group.template.standardDrinks * group.quantity).toFixed(1)} std
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleRemoveOne(group)}
                className="w-7 h-7 rounded-lg bg-white/[0.05] active:bg-white/[0.1] flex items-center justify-center"
              >
                <Minus className="w-3.5 h-3.5 text-zinc-400" />
              </button>
              <span className="w-6 text-center text-sm font-mono font-semibold">{group.quantity}</span>
              {onAdd && (
                <button
                  onClick={() => handleAdd(group)}
                  className="w-7 h-7 rounded-lg bg-white/[0.05] active:bg-white/[0.1] flex items-center justify-center"
                >
                  <Plus className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              )}
              <button
                onClick={() => handleRemoveAll(group)}
                className="w-7 h-7 rounded-lg active:bg-red-500/10 flex items-center justify-center"
                aria-label={`Remove all ${group.template.drinkName}`}
              >
                <Trash2 className="w-3.5 h-3.5 text-zinc-600" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
