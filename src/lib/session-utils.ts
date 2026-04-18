import type { DrinkSession, DrinkEntry, FeedItem } from '@/types';

// Spread N drink timestamps evenly across [startedAt, endedAt]. With 4 drinks
// over 8pm–12am: 8:00, 9:20, 10:40, 12:00. With 1 drink: midpoint. With 0: [].
// Used when a user logs a past session without per-drink timestamps.
export function spreadDrinkTimestamps(
  startedAt: string,
  endedAt: string,
  count: number,
): string[] {
  if (count <= 0) return [];
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (count === 1) return [new Date((start + end) / 2).toISOString()];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) =>
    new Date(start + step * i).toISOString(),
  );
}

// Build the FeedItem.sessionSummary JSONB from a session. Shared between
// createFeedItemFromSession (live flow) and the past-session / edit flows so
// the shape stays identical everywhere.
export function buildSessionSummary(
  session: DrinkSession,
): FeedItem['sessionSummary'] {
  const drinkCounts: Record<string, { count: number; emoji: string }> = {};
  const drinkEmojis: string[] = [];

  for (const drink of session.drinks) {
    drinkEmojis.push(drink.emoji);
    if (drinkCounts[drink.drinkName]) {
      drinkCounts[drink.drinkName].count++;
    } else {
      drinkCounts[drink.drinkName] = { count: 1, emoji: drink.emoji };
    }
  }

  let topDrink = '';
  let topDrinkEmoji = '';
  let maxCount = 0;
  for (const [name, data] of Object.entries(drinkCounts)) {
    if (data.count > maxCount) {
      maxCount = data.count;
      topDrink = name;
      topDrinkEmoji = data.emoji;
    }
  }

  return {
    venue: session.venue,
    totalDrinks: session.drinks.length,
    totalStandardDrinks: session.totalStandardDrinks,
    durationMinutes: session.durationMinutes,
    topDrink,
    topDrinkEmoji,
    drinkEmojis,
    drinks: session.drinks.map((d) => ({
      name: d.drinkName,
      emoji: d.emoji,
      category: d.category,
      abvPercent: d.abvPercent,
      volumeMl: d.volumeMl,
      standardDrinks: d.standardDrinks,
    })),
    mood: session.mood,
    prsAchieved: session.prsAchieved,
  };
}

// ── Datetime-local <-> ISO conversions ────────────────────────────────────
// <input type="datetime-local"> emits "YYYY-MM-DDTHH:mm" in local time, no TZ.
// We parse it as local time and emit an ISO string for storage; on the way
// back we format an ISO string into local wall-clock so edits round-trip.

export function isoToLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function localInputValueToIso(value: string): string {
  // `new Date("YYYY-MM-DDTHH:mm")` is parsed as local time in browsers — what
  // we want. Call .toISOString() to normalize to UTC for storage.
  return new Date(value).toISOString();
}

// ── Validation ────────────────────────────────────────────────────────────

const MAX_BACKFILL_DAYS = 90;

export interface SessionFormInput {
  venue: string;
  startedAt: string; // ISO
  endedAt: string;   // ISO
  drinks: DrinkEntry[];
  mood: DrinkSession['mood'];
}

export function validateSessionForm(input: SessionFormInput): string | null {
  if (!input.venue.trim()) return 'Add a venue';
  const start = new Date(input.startedAt).getTime();
  const end = new Date(input.endedAt).getTime();
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Invalid date';
  if (end - start < 60_000) return 'End must be at least 1 minute after start';
  if (start > now) return 'Start time can\u2019t be in the future';
  if (end > now) return 'End time can\u2019t be in the future';
  const maxPast = now - MAX_BACKFILL_DAYS * 24 * 60 * 60 * 1000;
  if (start < maxPast) return `Start must be within the last ${MAX_BACKFILL_DAYS} days`;
  if (input.drinks.length === 0) return 'Add at least one drink';
  if (!input.mood) return 'Pick a mood';
  return null;
}

export function durationMinutesBetween(startedAt: string, endedAt: string): number {
  return Math.round(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000,
  );
}
