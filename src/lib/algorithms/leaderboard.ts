import type { FeedItem } from '@/types/feed';
import type { LeaderboardEntry, LeaderboardMetric, LeaderboardTimeframe } from '@/types/leaderboard';
import type { UserProfile } from '@/types/user';

function getTimeframeStart(timeframe: LeaderboardTimeframe): Date {
  const now = new Date();
  switch (timeframe) {
    case 'week':
      return new Date(now.getTime() - 7 * 86400000);
    case 'month':
      return new Date(now.getTime() - 30 * 86400000);
    case 'all-time':
      return new Date(0);
  }
}

function computeMetric(
  posts: FeedItem[],
  metric: LeaderboardMetric
): number {
  switch (metric) {
    case 'total_standard_drinks':
      return posts.reduce((sum, p) => sum + (p.sessionSummary.totalStandardDrinks ?? 0), 0);
    case 'total_sessions':
      return posts.length;
    case 'longest_session':
      return posts.reduce((max, p) => Math.max(max, p.sessionSummary.durationMinutes ?? 0), 0);
    case 'most_diverse': {
      const allDrinks = new Set<string>();
      posts.forEach(p => (p.sessionSummary.drinks ?? []).forEach(d => allDrinks.add(d.name)));
      return allDrinks.size;
    }
  }
}

export function buildLeaderboard(
  allPosts: FeedItem[],
  users: UserProfile[],
  metric: LeaderboardMetric,
  timeframe: LeaderboardTimeframe
): LeaderboardEntry[] {
  const start = getTimeframeStart(timeframe);

  const filteredPosts = allPosts.filter(
    p => new Date(p.createdAt) >= start
  );

  const postsByUser = new Map<string, FeedItem[]>();
  filteredPosts.forEach(p => {
    const existing = postsByUser.get(p.userId) || [];
    existing.push(p);
    postsByUser.set(p.userId, existing);
  });

  const entries: LeaderboardEntry[] = [];

  for (const user of users) {
    const userPosts = postsByUser.get(user.id) || [];
    const value = computeMetric(userPosts, metric);

    entries.push({
      rank: 0,
      userId: user.id,
      userName: user.displayName,
      userAvatar: user.avatarUrl,
      value,
      formattedValue: formatMetricValue(metric, value),
      trend: 'same',
      trendDelta: 0,
    });
  }

  entries.sort((a, b) => b.value - a.value);
  entries.forEach((entry, i) => {
    entry.rank = i + 1;
  });

  // Handle ties
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].value === entries[i - 1].value) {
      entries[i].rank = entries[i - 1].rank;
    }
  }

  return entries;
}

function formatMetricValue(metric: LeaderboardMetric, value: number): string {
  switch (metric) {
    case 'total_standard_drinks':
      return `${value.toFixed(1)} drinks`;
    case 'total_sessions':
      return `${value} sessions`;
    case 'longest_session': {
      const hrs = Math.floor(value / 60);
      const mins = value % 60;
      return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    }
    case 'most_diverse':
      return `${value} types`;
  }
}
