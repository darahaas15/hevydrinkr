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
}
