export type DrinkCategory =
  | 'beer'
  | 'wine'
  | 'cocktail'
  | 'whiskey'
  | 'vodka'
  | 'rum'
  | 'gin'
  | 'brandy'
  | 'tequila'
  | 'shot'
  | 'cider'
  | 'seltzer'
  | 'desi'
  | 'custom';

export interface DrinkDefinition {
  id: string;
  name: string;
  emoji: string;
  category: DrinkCategory;
  defaultAbvPercent: number;
  defaultVolumeMl: number;
  standardDrinks: number;
  color: string;
  isCustom: boolean;
}

export interface DrinkEntry {
  id: string;
  drinkDefinitionId: string;
  drinkName: string;
  emoji: string;
  category: DrinkCategory;
  abvPercent: number;
  volumeMl: number;
  standardDrinks: number;
  timestamp: string;
  roundId: string | null;
  notes: string;
  // What this drink cost, in the user's display currency. Optional at every
  // layer: undefined means "never recorded" (spend UI stays hidden), whereas
  // 0 is a real recorded price. Backed by the nullable `drink_entries.cost`
  // column, which the app degrades gracefully without — see
  // lib/supabase/optional-columns.ts.
  cost?: number | null;
}
