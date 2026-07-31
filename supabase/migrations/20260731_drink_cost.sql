-- ============================================================================
-- Optional per-drink cost tracking.
--
-- Adds a single nullable column. Nothing else changes: existing rows keep
-- NULL (meaning "no price recorded"), and every read path treats NULL as
-- "unknown" rather than zero, so sessions logged before this migration are
-- unaffected and the spend UI stays hidden for them.
--
-- The app is written to survive this migration NOT being applied — see
-- src/lib/supabase/optional-columns.ts. It drops `cost` from its selects and
-- inserts the first time Postgres reports the column missing, so shipping the
-- client ahead of this file degrades to "no spend tracking" rather than
-- breaking session loading or drink logging.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

ALTER TABLE drink_entries
  ADD COLUMN IF NOT EXISTS cost NUMERIC(10, 2);

-- Reject nonsense prices at the database boundary too, not just in the client.
-- The ceiling matches MAX_DRINK_COST in src/lib/money.ts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drink_entries_cost_range'
  ) THEN
    ALTER TABLE drink_entries
      ADD CONSTRAINT drink_entries_cost_range
      CHECK (cost IS NULL OR (cost >= 0 AND cost <= 100000));
  END IF;
END $$;

COMMENT ON COLUMN drink_entries.cost IS
  'What this drink cost, in the logger''s own display currency. NULL = not recorded. No FX conversion is applied anywhere.';

-- No RLS change needed: drink_entries policies already scope every operation
-- to the owning session, and this column inherits them.
