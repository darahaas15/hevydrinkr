import type { DrinkCategory, DrinkDefinition, DrinkEntry } from '@/types';
import type { QuickDrink } from '@/stores/use-drink-prefs-store';
import { DRINK_LIBRARY, getDrinksByCategory } from '@/lib/data/drink-library';
import { DRINK_CATEGORY_COLORS } from '@/lib/constants';
import { calculateStandardDrinks } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';

/**
 * The drink picker's logic, shared by the web picker sheet and the iOS picker
 * screen: the category tabs, custom-drink load/save, validation, filtering,
 * and turning a picked definition into a logged DrinkEntry.
 */

export type PickerCategory = DrinkCategory | 'all' | 'custom' | 'favorites';

export const PICKER_CATEGORIES: { value: PickerCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'favorites', label: '★ Starred' },
  { value: 'custom', label: 'My Drinks' },
  { value: 'beer', label: 'Beer' },
  { value: 'whiskey', label: 'Whiskey' },
  { value: 'vodka', label: 'Vodka' },
  { value: 'rum', label: 'Rum' },
  { value: 'gin', label: 'Gin' },
  { value: 'brandy', label: 'Brandy' },
  { value: 'tequila', label: 'Tequila' },
  { value: 'wine', label: 'Wine' },
  { value: 'cocktail', label: 'Cocktails' },
  { value: 'shot', label: 'Shots' },
  { value: 'desi', label: 'Desi' },
];

export const CUSTOM_DRINK_EMOJI = '🍸';

export interface CustomDrinkRow {
  id: string;
  name: string;
  emoji: string;
  category: string;
  abv_percent: number;
  volume_ml: number;
}

export function validateCustomDrink(name: string, abvStr: string, volStr: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Give your drink a name.';
  if (trimmed.length > 60) return 'Name is too long (max 60 chars).';
  const abv = parseFloat(abvStr);
  if (!Number.isFinite(abv) || abv < 0.1 || abv > 80) {
    return 'ABV must be between 0.1% and 80%.';
  }
  const vol = parseFloat(volStr);
  if (!Number.isFinite(vol) || vol < 10 || vol > 2000) {
    return 'Volume must be between 10 and 2000 ml.';
  }
  return null;
}

export function customDrinkToDefinition(row: CustomDrinkRow): DrinkDefinition {
  return {
    id: `custom-${row.id}`,
    name: row.name,
    emoji: row.emoji,
    category: row.category as DrinkCategory,
    defaultAbvPercent: row.abv_percent,
    defaultVolumeMl: row.volume_ml,
    standardDrinks: calculateStandardDrinks(row.volume_ml, row.abv_percent),
    color: 'var(--fg-secondary)',
    isCustom: true,
  };
}

/**
 * The user's saved custom drinks, newest first, or null when the fetch failed
 * (so callers keep what they already show instead of blanking the list).
 */
export async function fetchCustomDrinks(userId: string): Promise<DrinkDefinition[] | null> {
  const { data } = await supabase
    .from('custom_drinks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data ? (data as CustomDrinkRow[]).map(customDrinkToDefinition) : null;
}

/**
 * Saves a custom drink for future use. Returns the saved row, or null when the
 * insert failed - the drink can still be logged this once without it.
 */
export async function saveCustomDrink(
  userId: string,
  drink: { name: string; abvPercent: number; volumeMl: number },
): Promise<CustomDrinkRow | null> {
  const { data: inserted } = await supabase
    .from('custom_drinks')
    .insert({
      user_id: userId,
      name: drink.name,
      emoji: CUSTOM_DRINK_EMOJI,
      category: 'custom',
      abv_percent: drink.abvPercent,
      volume_ml: drink.volumeMl,
    })
    .select()
    .single();
  return (inserted as CustomDrinkRow | null) ?? null;
}

/** A fresh log entry for a picked drink at its default pour. */
export function entryFromDefinition(def: DrinkDefinition, cost: number | null): DrinkEntry {
  return {
    id: crypto.randomUUID(),
    drinkDefinitionId: def.id,
    drinkName: def.name,
    emoji: def.emoji,
    category: def.category,
    abvPercent: def.defaultAbvPercent,
    volumeMl: def.defaultVolumeMl,
    standardDrinks: calculateStandardDrinks(def.defaultVolumeMl, def.defaultAbvPercent),
    timestamp: new Date().toISOString(),
    roundId: null,
    notes: '',
    cost,
  };
}

/**
 * The entry for a just-created custom drink. Falls back to a throwaway id
 * when the save failed, so the drink is still logged.
 */
export function entryFromCustomDrink(
  saved: CustomDrinkRow | null,
  drink: { name: string; abvPercent: number; volumeMl: number },
): DrinkEntry {
  return {
    id: crypto.randomUUID(),
    drinkDefinitionId: saved ? `custom-${saved.id}` : `custom-${crypto.randomUUID()}`,
    drinkName: drink.name,
    emoji: CUSTOM_DRINK_EMOJI,
    category: 'custom' as DrinkCategory,
    abvPercent: drink.abvPercent,
    volumeMl: drink.volumeMl,
    standardDrinks: calculateStandardDrinks(drink.volumeMl, drink.abvPercent),
    timestamp: new Date().toISOString(),
    roundId: null,
    notes: '',
    cost: null,
  };
}

/**
 * Canonical definition for a remembered drink: the live library/custom row
 * when it still exists, so an edited ABV or volume wins over the snapshot
 * stored in recents.
 */
export function resolveQuickDrink(
  quick: QuickDrink,
  definitionById: Map<string, DrinkDefinition>,
): DrinkDefinition {
  return (
    definitionById.get(quick.definitionId) ?? {
      id: quick.definitionId,
      name: quick.name,
      emoji: quick.emoji,
      category: quick.category,
      defaultAbvPercent: quick.abvPercent,
      defaultVolumeMl: quick.volumeMl,
      standardDrinks: quick.standardDrinks,
      color: DRINK_CATEGORY_COLORS[quick.category] || '#71717a',
      isCustom: quick.definitionId.startsWith('custom-'),
    }
  );
}

export function buildDefinitionIndex(customDrinks: DrinkDefinition[]): Map<string, DrinkDefinition> {
  const map = new Map<string, DrinkDefinition>();
  for (const d of DRINK_LIBRARY) map.set(d.id, d);
  for (const d of customDrinks) map.set(d.id, d);
  return map;
}

/** The list the picker shows for the current search and category tab. */
export function filterPickerDrinks(input: {
  query: string;
  category: PickerCategory;
  customDrinks: DrinkDefinition[];
  favorites: DrinkDefinition[];
}): DrinkDefinition[] {
  const { query, category, customDrinks, favorites } = input;
  const allDrinks = [...customDrinks, ...DRINK_LIBRARY];
  if (query.trim()) {
    const q = query.toLowerCase();
    return allDrinks.filter((d) => d.name.toLowerCase().includes(q));
  }
  if (category === 'all') return allDrinks;
  if (category === 'custom') return customDrinks;
  if (category === 'favorites') return favorites;
  return getDrinksByCategory(category);
}
