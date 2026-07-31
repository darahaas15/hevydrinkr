import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DrinkCategory, DrinkEntry } from '@/types';
import { safeJSONStorage } from '@/lib/storage/safe-storage';
import { DEFAULT_CURRENCY } from '@/lib/money';

/**
 * Per-device drink preferences: what you log most, what you starred, and what
 * each drink costs you.
 *
 * Device-local (zustand persist) rather than account data, matching the theme
 * store: this is ergonomics for *this* phone, it needs zero-latency reads on
 * every picker open, and syncing it would add Supabase round-trips to the
 * hottest path in the app. Keyed by user id so a shared device doesn't leak
 * one person's habits into another's picker.
 */

/** The minimum needed to re-log a drink without consulting the library. */
export interface QuickDrink {
  definitionId: string;
  name: string;
  emoji: string;
  category: DrinkCategory;
  abvPercent: number;
  volumeMl: number;
  standardDrinks: number;
}

export interface UserDrinkPrefs {
  /** Definition ids, most recently logged first. */
  recentIds: string[];
  favoriteIds: string[];
  /** Remembered price per definition id, in the display currency. */
  costById: Record<string, number>;
  /** Enough of each drink to rebuild a DrinkEntry, incl. custom drinks. */
  templates: Record<string, QuickDrink>;
}

// Recents are a shortcut row, not an archive — a handful is the useful size.
const MAX_RECENTS = 12;
// Templates outlive recents slightly so a starred drink that fell out of the
// recents window can still be one-tap logged.
const MAX_TEMPLATES = 60;

const EMPTY_PREFS: UserDrinkPrefs = Object.freeze({
  recentIds: [],
  favoriteIds: [],
  costById: {},
  templates: {},
});

const emptyPrefs = (): UserDrinkPrefs => ({
  recentIds: [],
  favoriteIds: [],
  costById: {},
  templates: {},
});

// ── Pure selectors ─────────────────────────────────────────────────────────
// Components subscribe to the stable `byUser` slice and derive through these
// inside a useMemo. Calling a store method inside a selector would return a
// fresh array on every render, which useSyncExternalStore flags as an
// uncached snapshot.

/** Never returns undefined, so callers can read fields unconditionally. */
export function selectPrefs(
  byUser: Record<string, UserDrinkPrefs>,
  userId: string | undefined,
): UserDrinkPrefs {
  return (userId ? byUser[userId] : undefined) ?? EMPTY_PREFS;
}

export function selectRecents(prefs: UserDrinkPrefs, limit = MAX_RECENTS): QuickDrink[] {
  return prefs.recentIds
    .map((id) => prefs.templates[id])
    .filter((d): d is QuickDrink => Boolean(d))
    .slice(0, limit);
}

export function selectFavorites(prefs: UserDrinkPrefs): QuickDrink[] {
  return prefs.favoriteIds
    .map((id) => prefs.templates[id])
    .filter((d): d is QuickDrink => Boolean(d));
}

/** Favourites first, then recents, deduped — the one-tap row. */
export function selectQuickPicks(prefs: UserDrinkPrefs, limit = 6): QuickDrink[] {
  const seen = new Set<string>();
  const out: QuickDrink[] = [];
  for (const id of [...prefs.favoriteIds, ...prefs.recentIds]) {
    if (seen.has(id)) continue;
    seen.add(id);
    const template = prefs.templates[id];
    if (template) out.push(template);
    if (out.length >= limit) break;
  }
  return out;
}

export function selectCost(prefs: UserDrinkPrefs, definitionId: string): number | null {
  const cost = prefs.costById[definitionId];
  return typeof cost === 'number' && Number.isFinite(cost) ? cost : null;
}

interface DrinkPrefsState {
  byUser: Record<string, UserDrinkPrefs>;
  /** Display currency. Device-wide, not per-user — it follows the phone. */
  currency: string;

  recordUse: (userId: string, drink: QuickDrink) => void;
  toggleFavorite: (userId: string, definitionId: string) => void;
  setCost: (userId: string, definitionId: string, cost: number | null) => void;
  setCurrency: (currency: string) => void;

  getPrefs: (userId: string) => UserDrinkPrefs;
  getRecents: (userId: string, limit?: number) => QuickDrink[];
  getFavorites: (userId: string) => QuickDrink[];
  /** Recents with favourites hoisted to the front, deduped. */
  getQuickPicks: (userId: string, limit?: number) => QuickDrink[];
  getCost: (userId: string, definitionId: string) => number | null;
  isFavorite: (userId: string, definitionId: string) => boolean;
  getLastDrink: (userId: string) => QuickDrink | null;
}

/**
 * Drop templates that are neither recent nor starred, keeping the map bounded.
 * Recents are walked first so that if the cap bites, it trims the entries
 * furthest from the user's current habits.
 */
function pruneTemplates(prefs: UserDrinkPrefs): Record<string, QuickDrink> {
  const pruned: Record<string, QuickDrink> = {};
  let kept = 0;
  for (const id of [...prefs.recentIds, ...prefs.favoriteIds]) {
    if (pruned[id]) continue;
    if (kept >= MAX_TEMPLATES) break;
    const template = prefs.templates[id];
    if (!template) continue;
    pruned[id] = template;
    kept++;
  }
  return pruned;
}

function updateUser(
  state: DrinkPrefsState,
  userId: string,
  fn: (prefs: UserDrinkPrefs) => UserDrinkPrefs,
): Pick<DrinkPrefsState, 'byUser'> {
  const current = state.byUser[userId] ?? emptyPrefs();
  return { byUser: { ...state.byUser, [userId]: fn(current) } };
}

export const useDrinkPrefsStore = create<DrinkPrefsState>()(
  persist(
    (set, get) => ({
      byUser: {},
      currency: DEFAULT_CURRENCY,

      recordUse: (userId, drink) => {
        if (!userId || !drink.definitionId) return;
        set((state) =>
          updateUser(state, userId, (prefs) => {
            const recentIds = [
              drink.definitionId,
              ...prefs.recentIds.filter((id) => id !== drink.definitionId),
            ].slice(0, MAX_RECENTS);
            const next: UserDrinkPrefs = {
              ...prefs,
              recentIds,
              templates: { ...prefs.templates, [drink.definitionId]: drink },
            };
            return { ...next, templates: pruneTemplates(next) };
          }),
        );
      },

      toggleFavorite: (userId, definitionId) => {
        if (!userId || !definitionId) return;
        set((state) =>
          updateUser(state, userId, (prefs) => {
            const isFav = prefs.favoriteIds.includes(definitionId);
            const favoriteIds = isFav
              ? prefs.favoriteIds.filter((id) => id !== definitionId)
              : [definitionId, ...prefs.favoriteIds];
            return { ...prefs, favoriteIds };
          }),
        );
      },

      setCost: (userId, definitionId, cost) => {
        if (!userId || !definitionId) return;
        set((state) =>
          updateUser(state, userId, (prefs) => {
            const costById = { ...prefs.costById };
            if (cost === null) delete costById[definitionId];
            else costById[definitionId] = cost;
            return { ...prefs, costById };
          }),
        );
      },

      setCurrency: (currency) => set({ currency }),

      getPrefs: (userId) => selectPrefs(get().byUser, userId),

      getRecents: (userId, limit = MAX_RECENTS) =>
        selectRecents(selectPrefs(get().byUser, userId), limit),

      getFavorites: (userId) => selectFavorites(selectPrefs(get().byUser, userId)),

      getQuickPicks: (userId, limit = 6) =>
        selectQuickPicks(selectPrefs(get().byUser, userId), limit),

      getCost: (userId, definitionId) =>
        selectCost(selectPrefs(get().byUser, userId), definitionId),

      isFavorite: (userId, definitionId) =>
        selectPrefs(get().byUser, userId).favoriteIds.includes(definitionId),

      getLastDrink: (userId) =>
        selectRecents(selectPrefs(get().byUser, userId), 1)[0] ?? null,
    }),
    {
      name: 'hd-drink-prefs',
      version: 1,
      storage: safeJSONStorage(),
      // Only the data, never the action closures.
      partialize: (s) => ({ byUser: s.byUser, currency: s.currency }),
    },
  ),
);

/** Build the QuickDrink shape from a logged entry. */
export function quickDrinkFromEntry(entry: DrinkEntry): QuickDrink {
  return {
    definitionId: entry.drinkDefinitionId,
    name: entry.drinkName,
    emoji: entry.emoji,
    category: entry.category,
    abvPercent: entry.abvPercent,
    volumeMl: entry.volumeMl,
    standardDrinks: entry.standardDrinks,
  };
}

/** Build a fresh DrinkEntry from a QuickDrink, ready to log. */
export function entryFromQuickDrink(
  drink: QuickDrink,
  cost: number | null = null,
): DrinkEntry {
  return {
    id: crypto.randomUUID(),
    drinkDefinitionId: drink.definitionId,
    drinkName: drink.name,
    emoji: drink.emoji,
    category: drink.category,
    abvPercent: drink.abvPercent,
    volumeMl: drink.volumeMl,
    standardDrinks: drink.standardDrinks,
    timestamp: new Date().toISOString(),
    roundId: null,
    notes: '',
    cost,
  };
}
