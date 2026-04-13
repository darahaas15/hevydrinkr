// Supabase Edge Function: session-reminder
//
// Scheduled to run every 30 minutes via pg_cron.
// Finds active drinking sessions older than 2 hours and inserts a
// "still_drinking" notification row. The existing send-notification
// webhook handles push delivery (Web Push + APNs).
//
// Dedup: only one reminder per session — checks for an existing
// still_drinking notification with the same sessionId before inserting.
//
// Invoke manually:  supabase functions invoke session-reminder
// Schedule via pg_cron:
//   SELECT cron.schedule('session-reminder', '*/30 * * * *',
//     $$SELECT net.http_post(
//       url := '<SUPABASE_URL>/functions/v1/session-reminder',
//       headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb
//     )$$);

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const REMINDER_THRESHOLD_HOURS = 2;

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const cutoff = new Date(
    Date.now() - REMINDER_THRESHOLD_HOURS * 60 * 60 * 1000,
  ).toISOString();

  // Find active sessions that started more than 2 hours ago
  const { data: sessions, error: sessErr } = await supabase
    .from('drink_sessions')
    .select('id, user_id, venue, started_at')
    .eq('status', 'active')
    .lte('started_at', cutoff);

  if (sessErr) {
    console.error('Failed to query sessions:', sessErr);
    return Response.json({ error: sessErr.message }, { status: 500 });
  }

  if (!sessions || sessions.length === 0) {
    return Response.json({ sent: 0, reason: 'no_active_sessions_past_threshold' });
  }

  // Check which sessions already have a still_drinking notification (dedup)
  const sessionIds = sessions.map((s) => s.id);
  const { data: existing } = await supabase
    .from('notifications')
    .select('data')
    .eq('type', 'still_drinking')
    .in('data->>sessionId', sessionIds);

  const alreadyNotified = new Set(
    (existing ?? []).map((n: { data: { sessionId?: string } }) => n.data?.sessionId),
  );

  // Build notification rows for sessions we haven't reminded yet
  const notifications: Array<{
    user_id: string;
    type: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
  }> = [];

  for (const session of sessions) {
    if (alreadyNotified.has(session.id)) continue;

    const hours = Math.round(
      (Date.now() - new Date(session.started_at).getTime()) / (60 * 60 * 1000),
    );
    const venue = session.venue || 'your session';

    notifications.push({
      user_id: session.user_id,
      type: 'still_drinking',
      title: 'Still drinking?',
      body: `You've been at ${venue} for about ${hours} hour${hours !== 1 ? 's' : ''}. Tap to check in.`,
      data: { sessionId: session.id },
    });
  }

  if (notifications.length === 0) {
    return Response.json({ sent: 0, reason: 'all_already_notified' });
  }

  const { error: insertErr } = await supabase
    .from('notifications')
    .insert(notifications);

  if (insertErr) {
    console.error('Failed to insert session reminders:', insertErr);
    return Response.json({ error: insertErr.message }, { status: 500 });
  }

  return Response.json({ sent: notifications.length });
});
