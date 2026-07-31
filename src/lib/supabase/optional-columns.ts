/**
 * Graceful degradation for columns added by a migration that may not have
 * been applied yet.
 *
 * PROD is the only database (no staging), so app code and migrations can land
 * out of order. A `select('..., cost')` against a database missing `cost`
 * fails the WHOLE query with Postgres 42703 — which would take out session
 * loading and drink logging entirely, not just the new feature.
 *
 * An `OptionalColumn` starts optimistic (assume the migration ran) and latches
 * off the first time the database says the column doesn't exist. Callers retry
 * once without it. Once latched off, the feature simply stays hidden until the
 * migration is applied and the app is reloaded. No probe query, no extra
 * round-trip on the happy path, and no way to break the core flow.
 */

const MISSING_COLUMN_CODE = '42703';
// PostgREST reports an unknown column in a `select=` list as a schema-cache
// miss (PGRST204) rather than a raw Postgres error, so match both.
const SCHEMA_CACHE_MISS_CODE = 'PGRST204';

export interface OptionalColumn {
  /** Column name, for building select lists. */
  readonly name: string;
  /** False once the database has told us the column doesn't exist. */
  isSupported(): boolean;
  /**
   * Inspect a failed query. If the failure was caused by this column being
   * absent, latch support off and return true so the caller retries without
   * it. Any other error returns false and should be handled normally.
   */
  disableIfMissing(error: unknown): boolean;
}

function mentionsColumn(error: { message?: string; details?: string }, name: string): boolean {
  const haystack = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return haystack.includes(name.toLowerCase());
}

export function optionalColumn(name: string): OptionalColumn {
  let supported = true;

  return {
    name,
    isSupported: () => supported,
    disableIfMissing(error: unknown): boolean {
      if (!supported) return false;
      if (!error || typeof error !== 'object') return false;

      const err = error as { code?: string; message?: string; details?: string };
      const isMissing =
        (err.code === MISSING_COLUMN_CODE || err.code === SCHEMA_CACHE_MISS_CODE) &&
        mentionsColumn(err, name);

      if (!isMissing) return false;

      supported = false;
      console.warn(
        `[optional-columns] "${name}" is not present in the database — ` +
          'falling back and hiding the dependent UI. Apply the pending migration to enable it.',
      );
      return true;
    },
  };
}

/**
 * `drink_entries.cost` — added by supabase/migrations/20260731_drink_cost.sql.
 * Shared module-level instance so every write path (session store, feed edit)
 * agrees on whether cost round-trips.
 */
export const drinkCostColumn = optionalColumn('cost');
