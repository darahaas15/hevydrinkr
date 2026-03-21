import type { DrinkEntry } from '@/types';
import type { Gender } from '@/types/user';

const ETHANOL_DENSITY = 0.789; // g/mL
const ELIMINATION_RATE = 0.015; // BAC per hour

const WIDMARK_FACTOR: Record<Gender, number> = {
  male: 0.68,
  female: 0.55,
  other: 0.615,
};

export function calculateAlcoholGrams(volumeMl: number, abvPercent: number): number {
  return volumeMl * (abvPercent / 100) * ETHANOL_DENSITY;
}

export function calculateBAC(
  drinks: DrinkEntry[],
  weightKg: number,
  gender: Gender,
  currentTime?: Date
): number {
  if (drinks.length === 0 || weightKg <= 0) return 0;

  const now = currentTime || new Date();
  const r = WIDMARK_FACTOR[gender];

  let totalBac = 0;

  for (const drink of drinks) {
    const alcoholGrams = calculateAlcoholGrams(drink.volumeMl, drink.abvPercent);
    const drinkTime = new Date(drink.timestamp);
    const hoursElapsed = (now.getTime() - drinkTime.getTime()) / (1000 * 60 * 60);

    if (hoursElapsed < 0) continue;

    const bacFromDrink = alcoholGrams / (weightKg * r * 10);
    const elimination = ELIMINATION_RATE * hoursElapsed;
    const netBac = Math.max(0, bacFromDrink - elimination);

    totalBac += netBac;
  }

  return Math.max(0, Math.round(totalBac * 1000) / 1000);
}

export function getBacLevel(bac: number): 'sober' | 'buzzed' | 'tipsy' | 'drunk' | 'wasted' {
  if (bac < 0.04) return 'sober';
  if (bac < 0.08) return 'buzzed';
  if (bac < 0.12) return 'tipsy';
  if (bac < 0.20) return 'drunk';
  return 'wasted';
}

export function getBacColor(bac: number): string {
  const level = getBacLevel(bac);
  const colors = {
    sober: '#22c55e',
    buzzed: '#f59e0b',
    tipsy: '#f97316',
    drunk: '#ef4444',
    wasted: '#dc2626',
  };
  return colors[level];
}

export function getBacLabel(bac: number): string {
  const level = getBacLevel(bac);
  const labels = {
    sober: 'Sober',
    buzzed: 'Buzzed',
    tipsy: 'Tipsy',
    drunk: 'Drunk',
    wasted: 'Wasted',
  };
  return labels[level];
}

export function estimateTimeTillSober(bac: number): number {
  if (bac <= 0) return 0;
  return Math.ceil((bac / ELIMINATION_RATE) * 60);
}
