import { supabase } from '@/lib/supabase/client';
import { drinkCostColumn } from '@/lib/supabase/optional-columns';

/**
 * Shared read/write helpers for `drink_entries`.
 *
 * Both the session store (live logging, backfill) and the feed store (post
 * edits, which rewrite a session's drinks) go through here so they agree on
 * the column list and on how to degrade when the optional `cost` column
 * hasn't been migrated in yet.
 */

/** Attach `cost` to a row only when the column is available. */
export function withOptionalCost(
  row: Record<string, unknown>,
  cost: number | null | undefined,
): Record<string, unknown> {
  if (!drinkCostColumn.isSupported()) return row;
  return { ...row, cost: cost ?? null };
}

export interface DrinkEntryRowsResult {
  data: Record<string, unknown>[];
  error: unknown;
}

/**
 * Read drink entries for a set of sessions, oldest first.
 * Retries once without `cost` if the database reports the column missing,
 * so an un-migrated database still loads sessions rather than failing.
 */
export async function selectDrinkEntries(
  sessionIds: string[],
): Promise<DrinkEntryRowsResult> {
  if (sessionIds.length === 0) return { data: [], error: null };

  // The two column lists are written out as literals rather than composed from
  // a constant so the static contract extractor
  // (tests/contract/extract-db-contract.ts) can still see which drink_entries
  // columns the app depends on — it regex-matches `.select('<literal>')`.
  // Keep the lists identical apart from the trailing `cost`.
  const withCost = () =>
    supabase
      .from('drink_entries')
      .select(
        'id, session_id, drink_definition_id, drink_name, emoji, category, abv_percent, volume_ml, standard_drinks, timestamp, round_id, notes, cost',
      )
      .in('session_id', sessionIds)
      .order('timestamp', { ascending: true });

  const withoutCost = () =>
    supabase
      .from('drink_entries')
      .select(
        'id, session_id, drink_definition_id, drink_name, emoji, category, abv_percent, volume_ml, standard_drinks, timestamp, round_id, notes',
      )
      .in('session_id', sessionIds)
      .order('timestamp', { ascending: true });

  let result = drinkCostColumn.isSupported() ? await withCost() : await withoutCost();
  if (result.error && drinkCostColumn.disableIfMissing(result.error)) {
    result = await withoutCost();
  }
  // The dynamic select string widens PostgREST's row type; these are plain
  // JSON rows and every consumer reads them through `rowToDrinkEntry`.
  return {
    data: (result.data ?? []) as unknown as Record<string, unknown>[],
    error: result.error,
  };
}

/**
 * Insert drink entries, retrying once without `cost` if the column is absent.
 * Logging a drink must never fail just because the price column isn't there.
 */
export async function insertDrinkEntries(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return { error: null };
  const { error } = await supabase.from('drink_entries').insert(rows);
  if (error && drinkCostColumn.disableIfMissing(error)) {
    const stripped = rows.map((row) => {
      const copy = { ...row };
      delete copy.cost;
      return copy;
    });
    return supabase.from('drink_entries').insert(stripped);
  }
  return { error };
}
