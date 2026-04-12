import type { DrinkEntry } from '@/types';
import { BAC_LEVELS, BAC_COLORS } from '@/lib/constants';

export type SafetyLevel = 'safe' | 'caution' | 'danger';

export interface BacEstimate {
  currentBac: number;
  peakBac: number;
  safetyLevel: SafetyLevel;
  hoursUntilSober: number;
}

const DISTRIBUTION_RATIO: Record<string, number> = {
  male: 0.68,
  female: 0.55,
  other: 0.615,
};

const ELIMINATION_RATE = 0.015; // BAC per hour
const ALCOHOL_DENSITY = 0.789; // g/mL

export function calculateBac(
  drinks: DrinkEntry[],
  params: { weightKg: number; gender: string; heightCm: number | null },
  nowMs: number = Date.now(),
): BacEstimate {
  const r = DISTRIBUTION_RATIO[params.gender] ?? 0.615;
  const bodyWeightGrams = params.weightKg * 1000;

  let currentBac = 0;

  const sorted = [...drinks].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  for (const drink of sorted) {
    const drinkTimeMs = new Date(drink.timestamp).getTime();
    const hoursElapsed = (nowMs - drinkTimeMs) / 3_600_000;
    if (hoursElapsed < 0) continue;

    const alcoholGrams = drink.volumeMl * (drink.abvPercent / 100) * ALCOHOL_DENSITY;
    const bacFromDrink = alcoholGrams / (bodyWeightGrams * r);
    currentBac += Math.max(0, bacFromDrink - ELIMINATION_RATE * hoursElapsed);
  }

  // Peak BAC: compute as of the last drink's timestamp
  let peakBac = 0;
  if (sorted.length > 0) {
    const lastDrinkTimeMs = new Date(sorted[sorted.length - 1].timestamp).getTime();
    let peakCalc = 0;
    for (const drink of sorted) {
      const drinkTimeMs = new Date(drink.timestamp).getTime();
      const hours = (lastDrinkTimeMs - drinkTimeMs) / 3_600_000;
      const alcoholGrams = drink.volumeMl * (drink.abvPercent / 100) * ALCOHOL_DENSITY;
      const bacFromDrink = alcoholGrams / (bodyWeightGrams * r);
      peakCalc += Math.max(0, bacFromDrink - ELIMINATION_RATE * hours);
    }
    peakBac = Math.max(peakCalc, currentBac);
  }

  currentBac = Math.max(0, currentBac);

  const safetyLevel: SafetyLevel =
    currentBac < BAC_LEVELS.BUZZED ? 'safe' :
    currentBac < BAC_LEVELS.TIPSY ? 'caution' :
    'danger';

  const hoursUntilSober = currentBac > 0 ? currentBac / ELIMINATION_RATE : 0;

  return { currentBac, peakBac, safetyLevel, hoursUntilSober };
}

export function getSafetyColor(level: SafetyLevel): string {
  switch (level) {
    case 'safe': return BAC_COLORS.SOBER;
    case 'caution': return BAC_COLORS.BUZZED;
    case 'danger': return BAC_COLORS.DRUNK;
  }
}
