import type { DrinkEntry } from '@/types';

/** One row of the live drink list: every entry of the same drink, collapsed. */
export interface DrinkGroup {
  /** The shared drinkDefinitionId. */
  key: string;
  /** Any one entry from the group, used for name/icon/abv/volume display. */
  template: DrinkEntry;
  quantity: number;
  /** Oldest first, so the last one is the most recently logged. */
  entries: DrinkEntry[];
}

/** Groups drinks by definition, with the most recently started group first. */
export function groupDrinksByDefinition(drinks: DrinkEntry[]): DrinkGroup[] {
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
      map.set(defId, { key: defId, template: drink, quantity: 1, entries: [drink] });
    }
  }
  return order.reverse().map((id) => map.get(id)!);
}

/** A fresh entry for another one of the same drink, logged now. */
export function repeatDrink(template: DrinkEntry): DrinkEntry {
  return {
    ...template,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    roundId: null,
  };
}

/** The entry the "-" button removes: the group's most recently logged one. */
export function latestEntry(group: DrinkGroup): DrinkEntry {
  return group.entries[group.entries.length - 1];
}
