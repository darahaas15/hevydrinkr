import type { DrinkSession, DrinkEntry, FeedItem } from '@/types';
import { sumCosts } from '@/lib/money';
import { normalizeVenue } from '@/lib/venues';

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

// The live session to keep after loading `fetchedUserId`'s sessions. Only your
// own fetch may set it: viewing a friend's profile while they're out must not
// adopt their live session (writes to it are then rejected by RLS). Your own
// fetch is authoritative, so it also clears a session that isn't yours.
export function nextActiveSession(
  current: DrinkSession | null,
  fetchedActive: DrinkSession | null,
  fetchedUserId: string,
  currentUserId: string | undefined,
): DrinkSession | null {
  if (!currentUserId || fetchedUserId !== currentUserId) return current;
  return fetchedActive;
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
    startedAt: session.startedAt,
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
      drinkDefinitionId: d.drinkDefinitionId,
      timestamp: d.timestamp,
      cost: d.cost ?? null,
    })),
    mood: session.mood,
    prsAchieved: session.prsAchieved,
    totalCost: sumCosts(session.drinks),
  };
}

type SummaryDrink = FeedItem['sessionSummary']['drinks'][number];

export interface DrinkGroup<T> {
  key: string;
  // Any one drink from the group, for name/emoji/category.
  template: T;
  quantity: number;
}

// Group drinks by `keyOf`, keeping first-appearance order. The session cart
// and the feed card group the same way; only the key for legacy rows differs.
export function groupDrinks<T>(drinks: T[], keyOf: (drink: T) => string): DrinkGroup<T>[] {
  const groups = new Map<string, DrinkGroup<T>>();
  for (const d of drinks) {
    const key = keyOf(d);
    const existing = groups.get(key);
    if (existing) existing.quantity += 1;
    else groups.set(key, { key, template: d, quantity: 1 });
  }
  return [...groups.values()];
}

// A post's drinks grouped for display, most-drunk first ("Kingfisher x3").
// Legacy rows have no drinkDefinitionId, or the 'edited' sentinel shared by
// unrelated drinks, so those group by name instead.
export function groupPostDrinks(drinks: SummaryDrink[]): DrinkGroup<SummaryDrink>[] {
  const groups = groupDrinks(drinks, (d) =>
    d.drinkDefinitionId && d.drinkDefinitionId !== 'edited' ? d.drinkDefinitionId : `name:${d.name}`,
  );
  // Array.prototype.sort is stable, so ties keep first-appearance order.
  return groups.sort((a, b) => b.quantity - a.quantity);
}

// When a post's session started: the stored start time, else (older posts)
// the earliest drink time, else unknown.
export function postStartTime(summary: FeedItem['sessionSummary']): string | null {
  if (summary.startedAt) return summary.startedAt;
  const stamps = (summary.drinks ?? []).map((d) => d.timestamp).filter((t): t is string => !!t);
  if (stamps.length === 0) return null;
  return stamps.reduce((earliest, t) => (Date.parse(t) < Date.parse(earliest) ? t : earliest));
}

// "Fri · 9:40 PM" within the last week, "12 Sep · 9:40 PM" before that, with
// the year added outside the current one. Local time.
export function formatPostStartTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  let day: string;
  if (daysAgo <= 6) {
    day = date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    day = `${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'short' })}`;
    if (date.getFullYear() !== now.getFullYear()) day += ` ${date.getFullYear()}`;
  }
  return `${day} · ${time}`;
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
  // Same emptiness rule as before, routed through the shared helper so the
  // form and the venue autocomplete agree on what counts as a blank venue.
  if (!normalizeVenue(input.venue)) return 'Add a venue';
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
