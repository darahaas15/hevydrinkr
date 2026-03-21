import type { DrinkSession, DrinkEntry, DrinkDefinition, SessionMood } from '@/types';
import { DRINK_LIBRARY } from './drink-library';
import { MOCK_USERS } from './mock-users';
import { generateId, getRelativeDate } from '@/lib/utils';

// ── Helpers ─────────────────────────────────────────────────

function makeDrinkEntry(
  drink: DrinkDefinition,
  timestamp: string,
): DrinkEntry {
  return {
    id: generateId(),
    drinkDefinitionId: drink.id,
    drinkName: drink.name,
    emoji: drink.emoji,
    category: drink.category,
    abvPercent: drink.defaultAbvPercent,
    volumeMl: drink.defaultVolumeMl,
    standardDrinks: drink.standardDrinks,
    timestamp,
    roundId: null,
    notes: '',
  };
}

function offsetMinutes(baseIso: string, minutes: number): string {
  const d = new Date(baseIso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function drinkById(id: string): DrinkDefinition {
  return DRINK_LIBRARY.find((dl) => dl.id === id)!;
}

const MOODS: SessionMood[] = ['legendary', 'great', 'good', 'meh', 'rough'];

function pickMood(index: number): SessionMood {
  return MOODS[index % MOODS.length];
}

function buildSession(
  userId: string,
  daysAgo: number,
  hourOfDay: number,
  venue: string,
  drinkIds: string[],
  mood: SessionMood,
  peakBac: number,
): DrinkSession {
  const baseDate = new Date(getRelativeDate(daysAgo));
  baseDate.setHours(hourOfDay, 0, 0, 0);
  const startedAt = baseDate.toISOString();

  let offsetMin = 0;
  const drinks: DrinkEntry[] = drinkIds.map((did, i) => {
    if (i > 0) offsetMin += 15 + Math.floor((i * 7) % 31); // 15-45 min gaps
    return makeDrinkEntry(drinkById(did), offsetMinutes(startedAt, offsetMin));
  });

  const totalStandardDrinks = Math.round(
    drinks.reduce((sum, de) => sum + de.standardDrinks, 0) * 10,
  ) / 10;
  const totalVolumeMl = drinks.reduce((sum, de) => sum + de.volumeMl, 0);
  const durationMinutes = offsetMin + 30;

  const lastDrinkTime = drinks[drinks.length - 1].timestamp;
  const endedAt = offsetMinutes(lastDrinkTime, 30);

  return {
    id: generateId(),
    userId,
    status: 'completed',
    startedAt,
    endedAt,
    venue,
    drinks,
    rounds: [],
    totalStandardDrinks,
    totalVolumeMl,
    peakBacEstimate: peakBac,
    durationMinutes,
    isPartyMode: false,
    partyId: null,
    prsAchieved: [],
    mood,
    notes: '',
    photos: [],
  };
}

// ── Sessions ────────────────────────────────────────────────

const U1 = MOCK_USERS[0].id; // demo-user-001

export const MOCK_SESSIONS: DrinkSession[] = [
  // ── Demo user sessions ────────────────────────────────────
  buildSession(U1, 1, 20, "O'Malley's Pub", [
    'beer-ipa', 'beer-ipa', 'beer-pale-ale', 'shot-tequila', 'beer-lager',
  ], 'great', 0.09),

  buildSession(U1, 3, 18, 'Happy Hour', [
    'ck-old-fashioned', 'ck-old-fashioned', 'wh-neat',
  ], 'good', 0.07),

  buildSession(U1, 5, 21, 'Club Neon', [
    'vk-soda', 'vk-soda', 'shot-tequila', 'shot-jagerbomb',
    'ck-long-island', 'vk-soda', 'shot-tequila',
  ], 'legendary', 0.14),

  buildSession(U1, 8, 19, "Jake's House Party", [
    'beer-ipa', 'beer-lager', 'beer-pale-ale', 'shot-fireball',
    'beer-kf-premium', 'shot-kamikaze',
  ], 'great', 0.10),

  buildSession(U1, 12, 17, 'Backyard BBQ', [
    'beer-lager', 'beer-lager', 'beer-light', 'seltzer-hard',
  ], 'good', 0.05),

  buildSession(U1, 15, 21, 'The Rooftop Bar', [
    'ck-margarita', 'ck-margarita', 'ck-mojito',
    'ck-aperol-spritz', 'shot-tequila',
  ], 'legendary', 0.11),

  buildSession(U1, 20, 19, 'Wine Bar Downtown', [
    'wine-red', 'wine-red', 'wine-white',
  ], 'good', 0.06),

  buildSession(U1, 25, 12, 'Brunch at Mimi\'s', [
    'ck-mojito', 'wine-prosecco', 'ck-aperol-spritz',
  ], 'great', 0.05),
];
