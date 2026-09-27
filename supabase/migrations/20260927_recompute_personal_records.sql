-- =============================================================
-- Recompute personal records in the database
-- Run AFTER 20260923_pin_function_search_path.sql
--
-- A record must always belong to the best existing completed session.
-- Until now the app wrote records only when a session ended, so deleting a
-- post (which deletes its session) left the record behind with session_id
-- NULLed, and editing drinks away never lowered it.
--
-- recompute_personal_records(user) rebuilds a user's per-session records from
-- their completed sessions: the best session holds each record, the runner-up
-- becomes previous_value, and a record with no qualifying session is deleted.
-- Triggers on drink_sessions and drink_entries run it whenever a completed
-- session or its drinks change, and the backfill at the end repairs existing
-- rows.
--
-- The metrics mirror computeSessionMetric() and formatPrValue() in
-- src/lib/algorithms/pr-detection.ts; tests/integration/records.test.ts checks
-- them against each other. Ties go to the earlier session, so an equal night
-- never steals a record. longest_streak and most_sessions_week are never
-- written by the app and are left alone.
-- =============================================================

CREATE OR REPLACE FUNCTION recompute_personal_records(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH sessions AS (
    SELECT id, started_at, COALESCE(ended_at, started_at) AS ended_at, duration_minutes
    FROM drink_sessions
    WHERE user_id = p_user_id AND status = 'completed'
  ),
  drinks AS (
    SELECT
      e.session_id,
      COUNT(*)::NUMERIC AS n,
      SUM(e.standard_drinks)::NUMERIC AS std,
      COUNT(DISTINCT e.drink_definition_id)::NUMERIC AS kinds
    FROM drink_entries e
    JOIN sessions s ON s.id = e.session_id
    GROUP BY e.session_id
  ),
  gaps AS (
    -- Smallest gap between consecutive drinks, in whole minutes, as the app
    -- rounds it (Math.round of the minimum).
    SELECT session_id, ROUND(MIN(EXTRACT(EPOCH FROM (ts - prev_ts)) / 60)) AS minutes
    FROM (
      SELECT e.session_id, e.timestamp AS ts,
        LAG(e.timestamp) OVER (PARTITION BY e.session_id ORDER BY e.timestamp) AS prev_ts
      FROM drink_entries e
      JOIN sessions s ON s.id = e.session_id
    ) g
    WHERE prev_ts IS NOT NULL
    GROUP BY session_id
  ),
  candidates AS (
    SELECT 'most_drinks_session' AS category, d.session_id, d.n AS value FROM drinks d
    UNION ALL SELECT 'most_standard_drinks', d.session_id, d.std FROM drinks d
    UNION ALL SELECT 'most_unique_drinks', d.session_id, d.kinds FROM drinks d
    UNION ALL SELECT 'longest_session', s.id, s.duration_minutes::NUMERIC FROM sessions s
    UNION ALL SELECT 'fastest_drink', g.session_id, g.minutes FROM gaps g
  ),
  ranked AS (
    SELECT c.category, c.session_id, c.value, s.ended_at,
      ROW_NUMBER() OVER (
        PARTITION BY c.category
        ORDER BY
          CASE WHEN c.category = 'fastest_drink' THEN c.value END ASC,
          CASE WHEN c.category <> 'fastest_drink' THEN c.value END DESC,
          s.ended_at, s.started_at, c.session_id
      ) AS rank
    FROM candidates c
    JOIN sessions s ON s.id = c.session_id
    -- The app never records a zero (an empty session, or two drinks logged
    -- in the same minute).
    WHERE c.value > 0
  ),
  holders AS (
    SELECT h.category, h.session_id, h.value, h.ended_at,
      (SELECT r.value FROM ranked r WHERE r.category = h.category AND r.rank = 2) AS previous_value
    FROM ranked h
    WHERE h.rank = 1
  ),
  cleared AS (
    DELETE FROM personal_records pr
    WHERE pr.user_id = p_user_id
      AND pr.category IN ('most_drinks_session', 'most_standard_drinks', 'longest_session', 'most_unique_drinks', 'fastest_drink')
      AND NOT EXISTS (SELECT 1 FROM holders h WHERE h.category = pr.category)
  )
  INSERT INTO personal_records (user_id, category, value, formatted_value, previous_value, session_id, achieved_at)
  SELECT
    p_user_id,
    h.category,
    h.value,
    CASE h.category
      WHEN 'most_drinks_session' THEN h.value::INT || ' drinks'
      WHEN 'most_standard_drinks' THEN ROUND(h.value, 1) || ' std drinks'
      WHEN 'longest_session' THEN (h.value::INT / 60) || 'h ' || (h.value::INT % 60) || 'm'
      WHEN 'most_unique_drinks' THEN h.value::INT || ' types'
      WHEN 'fastest_drink' THEN h.value::INT || 'm between drinks'
    END,
    h.previous_value,
    h.session_id,
    h.ended_at
  FROM holders h
  ON CONFLICT (user_id, category) DO UPDATE SET
    value = EXCLUDED.value,
    formatted_value = EXCLUDED.formatted_value,
    previous_value = EXCLUDED.previous_value,
    session_id = EXCLUDED.session_id,
    achieved_at = EXCLUDED.achieved_at
  -- Skip no-op writes: an edit re-inserts every drink, so this runs twice.
  WHERE (personal_records.value, personal_records.formatted_value, personal_records.previous_value,
         personal_records.session_id, personal_records.achieved_at)
    IS DISTINCT FROM
        (EXCLUDED.value, EXCLUDED.formatted_value, EXCLUDED.previous_value,
         EXCLUDED.session_id, EXCLUDED.achieved_at);
END;
$$;

-- Only the triggers and the backfill call it. Supabase grants EXECUTE on new
-- functions to anon/authenticated by default, which would also expose it as an
-- RPC.
REVOKE EXECUTE ON FUNCTION recompute_personal_records(UUID) FROM PUBLIC, anon, authenticated;

-- ---- drink_sessions: a completed session appears, changes, or goes ----

CREATE OR REPLACE FUNCTION on_session_change_recompute_records()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_personal_records(OLD.user_id);
    RETURN OLD;
  END IF;
  PERFORM recompute_personal_records(NEW.user_id);
  IF TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    PERFORM recompute_personal_records(OLD.user_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION on_session_change_recompute_records() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_session_insert_recompute_records ON drink_sessions;
CREATE TRIGGER trg_session_insert_recompute_records
  AFTER INSERT ON drink_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION on_session_change_recompute_records();

-- Only the columns records read; the live session's peak-BAC syncs and
-- mood/venue edits don't recompute.
DROP TRIGGER IF EXISTS trg_session_update_recompute_records ON drink_sessions;
CREATE TRIGGER trg_session_update_recompute_records
  AFTER UPDATE ON drink_sessions
  FOR EACH ROW
  WHEN (
    (OLD.status = 'completed' OR NEW.status = 'completed')
    AND (OLD.status, OLD.user_id, OLD.started_at, OLD.ended_at, OLD.duration_minutes)
      IS DISTINCT FROM (NEW.status, NEW.user_id, NEW.started_at, NEW.ended_at, NEW.duration_minutes)
  )
  EXECUTE FUNCTION on_session_change_recompute_records();

DROP TRIGGER IF EXISTS trg_session_delete_recompute_records ON drink_sessions;
CREATE TRIGGER trg_session_delete_recompute_records
  AFTER DELETE ON drink_sessions
  FOR EACH ROW
  WHEN (OLD.status = 'completed')
  EXECUTE FUNCTION on_session_change_recompute_records();

-- ---- drink_entries: drinks of a completed session change ----
-- Statement-level with transition tables: logging a past session or saving
-- an edit writes every drink in one statement, which should recompute once
-- per owner, not once per drink. Drinks added to a live session are skipped by
-- the status filter. When a session is deleted, its cascaded drinks no longer
-- join to a session here; the session trigger above covers that case.

CREATE OR REPLACE FUNCTION on_drinks_change_recompute_records()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR owner IN
      SELECT DISTINCT s.user_id FROM new_rows c JOIN drink_sessions s ON s.id = c.session_id WHERE s.status = 'completed'
    LOOP
      PERFORM recompute_personal_records(owner);
    END LOOP;
  ELSIF TG_OP = 'DELETE' THEN
    FOR owner IN
      SELECT DISTINCT s.user_id FROM old_rows c JOIN drink_sessions s ON s.id = c.session_id WHERE s.status = 'completed'
    LOOP
      PERFORM recompute_personal_records(owner);
    END LOOP;
  ELSE
    FOR owner IN
      SELECT DISTINCT s.user_id
      FROM (SELECT session_id FROM new_rows UNION SELECT session_id FROM old_rows) c
      JOIN drink_sessions s ON s.id = c.session_id
      WHERE s.status = 'completed'
    LOOP
      PERFORM recompute_personal_records(owner);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION on_drinks_change_recompute_records() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_drinks_insert_recompute_records ON drink_entries;
CREATE TRIGGER trg_drinks_insert_recompute_records
  AFTER INSERT ON drink_entries
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION on_drinks_change_recompute_records();

DROP TRIGGER IF EXISTS trg_drinks_update_recompute_records ON drink_entries;
CREATE TRIGGER trg_drinks_update_recompute_records
  AFTER UPDATE ON drink_entries
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION on_drinks_change_recompute_records();

DROP TRIGGER IF EXISTS trg_drinks_delete_recompute_records ON drink_entries;
CREATE TRIGGER trg_drinks_delete_recompute_records
  AFTER DELETE ON drink_entries
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION on_drinks_change_recompute_records();

-- ---- Backfill: repair records orphaned by deleted or edited sessions ----

SELECT recompute_personal_records(id) FROM profiles;
