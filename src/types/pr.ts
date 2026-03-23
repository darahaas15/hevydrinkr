export type PRCategory =
  | 'most_drinks_session'
  | 'most_standard_drinks'
  | 'longest_session'
  | 'most_unique_drinks'
  | 'fastest_drink'
  | 'longest_streak'
  | 'most_sessions_week';

export const PR_LABELS: Record<PRCategory, string> = {
  most_drinks_session: 'Most Drinks in a Session',
  most_standard_drinks: 'Highest Drink Score',
  longest_session: 'Longest Session',
  most_unique_drinks: 'Most Variety',
  fastest_drink: 'Fastest Back-to-Back',
  longest_streak: 'Longest Streak',
  most_sessions_week: 'Most Sessions in a Week',
};

export const PR_EMOJIS: Record<PRCategory, string> = {
  most_drinks_session: '🏆',
  most_standard_drinks: '🥇',
  longest_session: '⏱️',
  most_unique_drinks: '🌈',
  fastest_drink: '⚡',
  longest_streak: '🔥',
  most_sessions_week: '📅',
};

export interface PersonalRecord {
  id: string;
  userId: string;
  category: PRCategory;
  value: number;
  formattedValue: string;
  previousValue: number | null;
  sessionId: string;
  achievedAt: string;
  celebrated: boolean;
}
