import type { DrinkSession } from '@/types/session';
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
  sessions: DrinkSession[],
  metric: LeaderboardMetric
): number {
  switch (metric) {
    case 'total_standard_drinks':
      return sessions.reduce((sum, s) => sum + s.totalStandardDrinks, 0);
    case 'total_sessions':
      return sessions.length;
    case 'longest_session':
      return sessions.reduce((max, s) => Math.max(max, s.durationMinutes), 0);
    case 'most_diverse': {
      const allDrinks = new Set<string>();
      sessions.forEach(s => s.drinks.forEach(d => allDrinks.add(d.drinkDefinitionId)));
      return allDrinks.size;
    }
    case 'most_rounds_bought':
      return sessions.reduce((sum, s) => sum + s.rounds.length, 0);
    case 'longest_streak':
      return 0; // Computed separately
  }
}

export function buildLeaderboard(
  allSessions: DrinkSession[],
  users: UserProfile[],
  metric: LeaderboardMetric,
  timeframe: LeaderboardTimeframe
): LeaderboardEntry[] {
  const start = getTimeframeStart(timeframe);

  const filteredSessions = allSessions.filter(
    s => s.status === 'completed' && new Date(s.startedAt) >= start
  );

  const sessionsByUser = new Map<string, DrinkSession[]>();
  filteredSessions.forEach(s => {
    const existing = sessionsByUser.get(s.userId) || [];
    existing.push(s);
    sessionsByUser.set(s.userId, existing);
  });

  const entries: LeaderboardEntry[] = [];

  for (const user of users) {
    const userSessions = sessionsByUser.get(user.id) || [];
    const value = computeMetric(userSessions, metric);

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
    case 'most_rounds_bought':
      return `${value} rounds`;
    case 'longest_streak':
      return `${value} weeks`;
  }
}
