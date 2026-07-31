/**
 * Venue helpers.
 *
 * `drink_sessions.venue` is free text typed fresh every session, so the same
 * bar accumulates as "Toit", "toit", and "Toit  Bangalore ". These helpers
 * give us a stable comparison key without destroying the user's own casing:
 * we display whatever spelling they used most recently, and dedupe on the key.
 */

/** Trim and collapse internal whitespace. Display-safe, casing preserved. */
export function normalizeVenue(venue: string): string {
  return venue.trim().replace(/\s+/g, ' ');
}

/** Case/punctuation-insensitive identity key. Not shown to users. */
export function venueKey(venue: string): string {
  return normalizeVenue(venue)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export interface VenueStat {
  /** The display spelling — the one used in the most recent session. */
  name: string;
  key: string;
  visits: number;
  totalDrinks: number;
  lastVisitedAt: string;
}

interface VenueSourceSession {
  venue: string;
  startedAt: string;
  drinks: unknown[];
}

/**
 * Aggregate a user's sessions into per-venue stats, most-recent-visit first.
 * Sessions with a blank venue are skipped rather than bucketed into "".
 */
export function buildVenueStats(sessions: VenueSourceSession[]): VenueStat[] {
  const byKey = new Map<string, VenueStat>();

  for (const session of sessions) {
    const name = normalizeVenue(session.venue ?? '');
    if (!name) continue;
    const key = venueKey(name);
    if (!key) continue;

    const existing = byKey.get(key);
    const startedAt = session.startedAt;
    const drinkCount = session.drinks?.length ?? 0;

    if (!existing) {
      byKey.set(key, {
        name,
        key,
        visits: 1,
        totalDrinks: drinkCount,
        lastVisitedAt: startedAt,
      });
      continue;
    }

    existing.visits += 1;
    existing.totalDrinks += drinkCount;
    // Keep the spelling from the most recent visit so the suggestion list
    // tracks how the user currently writes it.
    if (new Date(startedAt).getTime() > new Date(existing.lastVisitedAt).getTime()) {
      existing.lastVisitedAt = startedAt;
      existing.name = name;
    }
  }

  return [...byKey.values()].sort(
    (a, b) => new Date(b.lastVisitedAt).getTime() - new Date(a.lastVisitedAt).getTime(),
  );
}

/**
 * Suggestions for the venue input. With an empty query this is the user's
 * recent venues; with a query it's a case-insensitive substring match,
 * prefix matches first. An exact match is omitted — offering to autocomplete
 * what the user has already fully typed is just noise.
 */
export function suggestVenues(
  stats: VenueStat[],
  query: string,
  limit = 6,
): VenueStat[] {
  const trimmed = normalizeVenue(query);
  if (!trimmed) return stats.slice(0, limit);

  const q = trimmed.toLowerCase();
  const exactKey = venueKey(trimmed);

  const matches = stats.filter((v) => {
    if (v.key === exactKey) return false;
    return v.name.toLowerCase().includes(q);
  });

  matches.sort((a, b) => {
    const aPrefix = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return new Date(b.lastVisitedAt).getTime() - new Date(a.lastVisitedAt).getTime();
  });

  return matches.slice(0, limit);
}

/**
 * Snap a typed venue onto an existing spelling when they're the same place.
 * "toit " typed against a history containing "Toit" returns "Toit", so the
 * user's history doesn't fragment. Unknown venues pass through normalized.
 */
export function canonicalizeVenue(input: string, stats: VenueStat[]): string {
  const normalized = normalizeVenue(input);
  if (!normalized) return normalized;
  const key = venueKey(normalized);
  if (!key) return normalized;
  const match = stats.find((v) => v.key === key);
  return match ? match.name : normalized;
}
