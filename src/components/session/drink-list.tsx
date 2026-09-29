'use client';

import { useMemo } from 'react';
import type { DrinkEntry } from '@/types';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { DrinkCart } from '@/components/session/drink-cart';
import { groupDrinksByDefinition, latestEntry, repeatDrink } from '@/lib/drink-groups';

interface DrinkListProps {
  drinks: DrinkEntry[];
  onRemove: (drink: DrinkEntry) => void;
  onAdd?: (drink: DrinkEntry) => void;
}

export function DrinkList({ drinks, onRemove, onAdd }: DrinkListProps) {
  // Group drinks by drinkDefinitionId, ordered with most-recent group first.
  const groups = useMemo(() => groupDrinksByDefinition(drinks), [drinks]);

  if (drinks.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <DrinkIcon category="beer" className="w-10 h-10 mb-3" />
        <p className="text-sm text-fg-secondary">No drinks yet</p>
        <p className="text-xs text-muted">Tap + to add your first drink</p>
      </div>
    );
  }

  const groupByKey = (key: string) => groups.find((g) => g.key === key);

  const handleInc = (key: string) => {
    if (!onAdd) return;
    const group = groupByKey(key);
    if (!group) return;
    onAdd(repeatDrink(group.template));
  };

  const handleDec = (key: string) => {
    const group = groupByKey(key);
    if (!group) return;
    onRemove(latestEntry(group));
  };

  const handleRemoveAll = (key: string) => {
    const group = groupByKey(key);
    if (!group) return;
    for (const entry of group.entries) onRemove(entry);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-fg-secondary">
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
