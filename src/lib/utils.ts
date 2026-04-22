import type { DrinkCategory, DrinkEntry } from '@/types';

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatNumber(n: number, decimals = 1): string {
  if (n >= 1000) return `${(n / 1000).toFixed(decimals)}k`;
  return decimals > 0 ? n.toFixed(decimals) : n.toString();
}

export function calculateStandardDrinks(volumeMl: number, abvPercent: number): number {
  const alcoholGrams = volumeMl * (abvPercent / 100) * 0.789;
  return Math.round((alcoholGrams / 14) * 10) / 10;
}

// Normal serving size per category. Oversized entries are split into pieces of
// roughly this size so one DrinkEntry ≈ one serving (pint of beer, glass of
// wine, shot of spirit, etc.). `custom` is omitted — we infer its unit from
// ABV, since custom drinks don't carry a real category.
export const DRINK_CATEGORY_UNIT_ML: Partial<Record<DrinkCategory, number>> = {
  beer: 500,
  cider: 500,
  seltzer: 500,
  wine: 150,
  cocktail: 60,
  whiskey: 30,
  vodka: 30,
  rum: 30,
  gin: 30,
  brandy: 30,
  tequila: 30,
  shot: 30,
  desi: 30,
};

// 10% tolerance lets common sizes stay as one entry (e.g. a 330ml beer can
// doesn't get compared against the 500ml pint unit and split).
const SPLIT_TOLERANCE = 1.1;

function unitForEntry(entry: DrinkEntry): number | null {
  const fixed = DRINK_CATEGORY_UNIT_ML[entry.category];
  if (fixed) return fixed;
  // Custom drinks: size the unit from ABV so a 500ml 5% beer doesn't split
  // against a shot unit, and a 300ml 40% spirit doesn't stay as one entry.
  if (entry.abvPercent >= 20) return 30;
  if (entry.abvPercent >= 8) return 150;
  return 500;
}

export function splitOversizedDrink(entry: DrinkEntry): DrinkEntry[] {
  const unit = unitForEntry(entry);
  if (!unit || entry.volumeMl <= unit * SPLIT_TOLERANCE) return [entry];

  const n = Math.max(2, Math.round(entry.volumeMl / unit));
  const subVolume = Math.round(entry.volumeMl / n);
  const subStd = calculateStandardDrinks(subVolume, entry.abvPercent);

  return Array.from({ length: n }, () => ({
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    volumeMl: subVolume,
    standardDrinks: subStd,
  }));
}

export function getRelativeDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

export function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
