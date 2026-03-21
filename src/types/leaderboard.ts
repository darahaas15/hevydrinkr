export type LeaderboardTimeframe = 'week' | 'month' | 'all-time';
export type LeaderboardScope = 'friends' | 'global' | 'group';
export type LeaderboardMetric =
  | 'total_standard_drinks'
  | 'total_sessions'
  | 'longest_session'
  | 'most_diverse'
  | 'most_rounds_bought'
  | 'longest_streak';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatar: string | null;
  value: number;
  formattedValue: string;
  trend: 'up' | 'down' | 'same';
  trendDelta: number;
}
