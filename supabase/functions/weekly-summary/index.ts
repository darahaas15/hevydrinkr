// Supabase Edge Function: weekly-summary
//
// Scheduled to run Friday at 6pm (via pg_cron or external cron).
// Calculates each user's weekly stats and inserts a notification row.
// The existing send-notification webhook handles APNs delivery.
//
// Invoke manually:  supabase functions invoke weekly-summary
// Schedule via pg_cron:
//   SELECT cron.schedule('weekly-summary', '0 18 * * 5',
//     $$SELECT net.http_post(
//       url := '<SUPABASE_URL>/functions/v1/weekly-summary',
//       headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb
//     )$$);

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  // Allow GET (cron) and POST (manual invoke)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Get all users who have at least one device token (i.e., can receive push)
  const { data: tokenUsers } = await supabase
    .from('device_tokens')
    .select('user_id')
    .order('user_id');

  if (!tokenUsers || tokenUsers.length === 0) {
    return Response.json({ sent: 0, reason: 'no_users_with_tokens' });
  }

  const userIds = [...new Set(tokenUsers.map((t: { user_id: string }) => t.user_id))];

  // Fetch this week's feed items for these users
  const { data: thisWeekItems } = await supabase
    .from('feed_items')
    .select('user_id, session_summary')
    .in('user_id', userIds)
    .gte('created_at', oneWeekAgo.toISOString());

  // Fetch last week's feed items for comparison
  const { data: lastWeekItems } = await supabase
    .from('feed_items')
    .select('user_id, session_summary')
    .in('user_id', userIds)
    .gte('created_at', twoWeeksAgo.toISOString())
    .lt('created_at', oneWeekAgo.toISOString());

  // Build stats per user
  type WeekStats = { sessions: number; drinks: number; prs: number };

  function buildStats(items: typeof thisWeekItems): Map<string, WeekStats> {
    const map = new Map<string, WeekStats>();
    for (const item of items ?? []) {
      const uid = item.user_id as string;
      const summary = item.session_summary as { totalDrinks?: number; prsAchieved?: unknown[] };
      const prev = map.get(uid) ?? { sessions: 0, drinks: 0, prs: 0 };
      map.set(uid, {
        sessions: prev.sessions + 1,
        drinks: prev.drinks + (summary.totalDrinks ?? 0),
        prs: prev.prs + (summary.prsAchieved?.length ?? 0),
      });
    }
    return map;
  }

  const thisWeek = buildStats(thisWeekItems);
  const lastWeek = buildStats(lastWeekItems);

  // Insert notifications for each user
  const notifications: Array<{
    user_id: string;
    type: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
  }> = [];

  for (const userId of userIds) {
    const stats = thisWeek.get(userId) ?? { sessions: 0, drinks: 0, prs: 0 };
    const prev = lastWeek.get(userId) ?? { sessions: 0, drinks: 0, prs: 0 };

    // Skip users with no activity this week
    if (stats.sessions === 0) continue;

    // Build comparison text
    let comparison = '';
    if (prev.sessions > 0) {
      const pct = Math.round(((stats.drinks - prev.drinks) / prev.drinks) * 100);
      if (pct > 0) comparison = `. Up ${pct}%!`;
      else if (pct < 0) comparison = `. Down ${Math.abs(pct)}%`;
    }

    const prText = stats.prs > 0 ? `, ${stats.prs} new PR${stats.prs > 1 ? 's' : ''}` : '';

    notifications.push({
      user_id: userId,
      type: 'weekly_summary',
      title: 'Your Week in Review',
      body: `${stats.sessions} sesh, ${stats.drinks} drink${stats.drinks > 1 ? 's' : ''}${prText}${comparison}`,
      data: { weekOf: oneWeekAgo.toISOString().slice(0, 10) },
    });
  }

  if (notifications.length > 0) {
    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) {
      console.error('Failed to insert weekly summary notifications:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  return Response.json({ sent: notifications.length, totalUsers: userIds.length });
});
