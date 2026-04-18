-- Add backfill flag to feed_items so past-session posts can be distinguished
-- in the UI ("Past session" pill). Set by the client at create time based on
-- which flow the post originated from (live vs log-past). Not derived from
-- elapsed time — a forgotten live session ended 5h late is not a backfill.

ALTER TABLE feed_items
  ADD COLUMN is_backfilled BOOLEAN NOT NULL DEFAULT false;

-- One-time retroactive classification for existing rows: if the session ended
-- more than 3 hours before the feed item was created, treat it as a backfill.
-- Best-effort only; the client flag is authoritative going forward.
UPDATE feed_items fi
SET is_backfilled = true
FROM drink_sessions ds
WHERE fi.session_id = ds.id
  AND ds.ended_at IS NOT NULL
  AND fi.created_at - ds.ended_at > INTERVAL '3 hours';
