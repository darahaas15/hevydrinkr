-- ============================================================================
-- Stale Session Reminder
--
-- A pg_cron job runs every 30 minutes and inserts a "still_drinking"
-- notification for any active session older than 2 hours.  Each session
-- gets at most ONE reminder (NOT EXISTS guard).
--
-- The existing Database Webhook on notifications INSERT calls the
-- send-notification Edge Function to deliver the push.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_stale_sessions()
RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT
    ds.user_id,
    'still_drinking',
    'Still going?',
    'Are you still drinking? Don''t forget to end your session!',
    jsonb_build_object('sessionId', ds.id)
  FROM drink_sessions ds
  WHERE ds.status = 'active'
    AND ds.started_at < now() - interval '2 hours'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = ds.user_id
        AND n.type = 'still_drinking'
        AND n.data->>'sessionId' = ds.id::text
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule: every 30 minutes
-- Requires the pg_cron extension to be enabled on your Supabase project.
-- Enable it in Dashboard > Database > Extensions > pg_cron
SELECT cron.schedule(
  'check-stale-sessions',
  '*/30 * * * *',
  'SELECT check_stale_sessions()'
);
