import type { DrinkCategory, DrinkEntry } from '@/types';

/**
 * The live-session drink gauge: the standard-drinks arc with its level label,
 * flanked by spirits and beer volume arcs. Shared by the web and iOS gauges;
 * colours are returned as the `--gauge-N` token number so each platform maps it
 * to its own theme.
 */

export const GAUGE_MAX_STANDARD_DRINKS = 15;
export const SPIRITS_GAUGE_MAX_ML = 300;
export const BEER_GAUGE_MAX_ML = 3000;

export type GaugeLevel = 1 | 2 | 3 | 4 | 5;

export function drinkLevel(standardDrinks: number): { label: string; level: GaugeLevel } {
  if (standardDrinks < 2) return { label: 'Getting Started', level: 1 };
  if (standardDrinks < 4) return { label: 'Warming Up', level: 2 };
  if (standardDrinks < 7) return { label: 'In The Zone', level: 3 };
  if (standardDrinks < 10) return { label: 'Going Hard', level: 4 };
  return { label: 'Beast Mode', level: 5 };
}

const SPIRITS = new Set<DrinkCategory>(['whiskey', 'vodka', 'rum', 'gin', 'brandy', 'tequila', 'shot', 'desi']);
const BEERS = new Set<DrinkCategory>(['beer', 'cider', 'seltzer']);

function volumeOf(drinks: DrinkEntry[], categories: Set<DrinkCategory>): number {
  return drinks.filter((d) => categories.has(d.category)).reduce((sum, d) => sum + d.volumeMl, 0);
}

export function spiritsVolumeMl(drinks: DrinkEntry[]): number {
  return volumeOf(drinks, SPIRITS);
}

export function beerVolumeMl(drinks: DrinkEntry[]): number {
  return volumeOf(drinks, BEERS);
}

/** Share of an arc to fill, clamped to [0, 1]. */
export function gaugeProgress(value: number, max: number): number {
  return Math.min(Math.max(value / max, 0), 1);
}

/** The number and unit printed inside a volume arc: ml, or litres from 1000 ml. */
export function gaugeVolumeLabel(ml: number): { value: string; unit: 'ml' | 'litres' } {
  if (ml >= 1000) return { value: (ml / 1000).toFixed(1), unit: 'litres' };
  return { value: String(Math.round(ml)), unit: 'ml' };
}
