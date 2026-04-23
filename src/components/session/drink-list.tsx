'use client';

import { useMemo } from 'react';
import type { DrinkEntry } from '@/types';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { DrinkCart, type DrinkCartItem } from '@/components/session/drink-cart';

interface DrinkListProps {
  drinks: DrinkEntry[];
  onRemove: (drink: DrinkEntry) => void;
  onAdd?: (drink: DrinkEntry) => void;
}

interface DrinkGroup extends DrinkCartItem {
  entries: DrinkEntry[];
}

export function DrinkList({ drinks, onRemove, onAdd }: DrinkListProps) {
  // Group drinks by drinkDefinitionId, ordered with most-recent group first.
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
          key: defId,
          template: drink,
          quantity: 1,
          entries: [drink],
        });
      }
    }
    return order.reverse().map((id) => map.get(id)!);
  }, [drinks]);

  if (drinks.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <DrinkIcon category="beer" className="w-10 h-10 mb-3" />
        <p className="text-sm text-zinc-500">No drinks yet</p>
        <p className="text-xs text-zinc-600">Tap + to add your first drink</p>
      </div>
    );
  }

  const groupByKey = (key: string) => groups.find((g) => g.key === key);

  const handleInc = (key: string) => {
    if (!onAdd) return;
    const group = groupByKey(key);
    if (!group) return;
    onAdd({
      ...group.template,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      roundId: null,
    });
  };

  const handleDec = (key: string) => {
    const group = groupByKey(key);
    if (!group) return;
    const latest = group.entries[group.entries.length - 1];
    onRemove(latest);
  };

  const handleRemoveAll = (key: string) => {
    const group = groupByKey(key);
    if (!group) return;
    for (const entry of group.entries) onRemove(entry);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-500">
          Drinks ({drinks.length})
        </h3>
      </div>
      <DrinkCart
        items={groups}
        onInc={handleInc}
        onDec={handleDec}
        onRemove={handleRemoveAll}
        showInc={!!onAdd}
        animate
      />
    </div>
  );
}
