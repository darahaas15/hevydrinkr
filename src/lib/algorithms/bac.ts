import type { DrinkEntry } from '@/types';
import { BAC_LEVELS, BAC_COLORS, BAC_LEGAL_LIMIT, BAC_LEVEL_LABELS } from '@/lib/constants';

export type SafetyLevel = 'sober' | 'buzzed' | 'tipsy' | 'drunk' | 'wasted';

export interface BacEstimate {
  currentBac: number;
  peakBac: number;
  safetyLevel: SafetyLevel;
  hoursUntilSober: number;
  hoursUntilDriveSafe: number;
  impairmentLabel: string;
  impairmentDescription: string;
}

const DISTRIBUTION_RATIO: Record<string, number> = {
  male: 0.68,
  female: 0.55,
  other: 0.615,
};

const ELIMINATION_RATE = 0.015; // BAC per hour
const ALCOHOL_DENSITY = 0.789; // g/mL
const ABSORPTION_HOURS = 0.5; // 30 minutes to fully absorb

function absorptionFraction(hoursElapsed: number): number {
  if (hoursElapsed <= 0) return 0;
  if (hoursElapsed >= ABSORPTION_HOURS) return 1;
  return hoursElapsed / ABSORPTION_HOURS;
}

function computeBacAtTime(
  drinks: DrinkEntry[],
  bodyWeightGrams: number,
  r: number,
  atMs: number,
): number {
  let totalAbsorbed = 0;
  let earliestDrinkMs = Infinity;

  for (const drink of drinks) {
    const drinkTimeMs = new Date(drink.timestamp).getTime();
    const hoursElapsed = (atMs - drinkTimeMs) / 3_600_000;
    if (hoursElapsed < 0) continue;

    if (drinkTimeMs < earliestDrinkMs) earliestDrinkMs = drinkTimeMs;

    const alcoholGrams = drink.volumeMl * (drink.abvPercent / 100) * ALCOHOL_DENSITY;
    // × 100 converts g/mL to g/dL (standard BAC unit, e.g. 0.08 = legal limit)
    const fullBac = (alcoholGrams / (bodyWeightGrams * r)) * 100;
    totalAbsorbed += fullBac * absorptionFraction(hoursElapsed);
  }

  if (totalAbsorbed === 0 || earliestDrinkMs === Infinity) return 0;

  // Elimination is a single constant rate on total BAC, not per-drink
  const hoursSinceFirstDrink = (atMs - earliestDrinkMs) / 3_600_000;
  const totalEliminated = ELIMINATION_RATE * hoursSinceFirstDrink;

  return Math.max(0, totalAbsorbed - totalEliminated);
}

function getSafetyLevel(bac: number): SafetyLevel {
  if (bac < BAC_LEVELS.BUZZED) return 'sober';
  if (bac < BAC_LEVELS.TIPSY) return 'buzzed';
  if (bac < BAC_LEVELS.DRUNK) return 'tipsy';
  if (bac < BAC_LEVELS.WASTED) return 'drunk';
  return 'wasted';
}

const LEVEL_KEY_MAP: Record<SafetyLevel, string> = {
  sober: 'SOBER',
  buzzed: 'BUZZED',
  tipsy: 'TIPSY',
  drunk: 'DRUNK',
  wasted: 'WASTED',
};

export function calculateBac(
  drinks: DrinkEntry[],
  params: { weightKg: number; gender: string },
  nowMs: number = Date.now(),
): BacEstimate {
  const r = DISTRIBUTION_RATIO[params.gender] ?? 0.615;
  const bodyWeightGrams = params.weightKg * 1000;

  const sorted = [...drinks].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const currentBac = computeBacAtTime(sorted, bodyWeightGrams, r, nowMs);

  // Peak BAC: occurs ~30 min after last drink due to absorption
  let peakBac = 0;
  if (sorted.length > 0) {
    const lastDrinkTimeMs = new Date(sorted[sorted.length - 1].timestamp).getTime();
    const peakTimeMs = lastDrinkTimeMs + ABSORPTION_HOURS * 3_600_000;
    // If peak time hasn't been reached yet, use current time as candidate
    const candidateMs = Math.min(peakTimeMs, nowMs);
    const peakCandidate = computeBacAtTime(sorted, bodyWeightGrams, r, candidateMs);
    peakBac = Math.max(peakCandidate, currentBac);
  }

  const safetyLevel = getSafetyLevel(currentBac);
  const levelKey = LEVEL_KEY_MAP[safetyLevel];
  const labels = BAC_LEVEL_LABELS[levelKey];

  const hoursUntilSober = currentBac > 0 ? currentBac / ELIMINATION_RATE : 0;
  const hoursUntilDriveSafe = currentBac > BAC_LEGAL_LIMIT
    ? (currentBac - BAC_LEGAL_LIMIT) / ELIMINATION_RATE
    : 0;

  return {
    currentBac,
    peakBac,
    safetyLevel,
    hoursUntilSober,
    hoursUntilDriveSafe,
    impairmentLabel: labels.label,
    impairmentDescription: labels.description,
  };
}

export function getSafetyColor(level: SafetyLevel): string {
  switch (level) {
    case 'sober': return BAC_COLORS.SOBER;
    case 'buzzed': return BAC_COLORS.BUZZED;
    case 'tipsy': return BAC_COLORS.TIPSY;
    case 'drunk': return BAC_COLORS.DRUNK;
    case 'wasted': return BAC_COLORS.WASTED;
  }
}
