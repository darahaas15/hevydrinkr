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

import { Trophy, Medal, Timer, Palette, Zap, Flame, Calendar, type LucideIcon } from 'lucide-react';

export const PR_ICONS: Record<PRCategory, LucideIcon> = {
  most_drinks_session: Trophy,
  most_standard_drinks: Medal,
  longest_session: Timer,
  most_unique_drinks: Palette,
  fastest_drink: Zap,
  longest_streak: Flame,
  most_sessions_week: Calendar,
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
