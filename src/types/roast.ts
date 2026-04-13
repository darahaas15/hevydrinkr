export type AwardType =
  | 'freight_train'
  | 'lightweight'
  | 'one_trick_pony'
  | 'ghost'
  | 'mixologist'
  | 'marathon_runner'
  | 'sprinter'
  | 'social_butterfly'
  | 'solo_artist'
  | 'early_bird'
  | 'night_owl'
  | 'broken_clock'
  | 'weekday_warrior'
  | 'snowball'
  | 'all_or_nothing'
  | 'clockwork'
  | 'category_locked';

export type GroupRecordType =
  | 'highest_weekly_std_drinks'
  | 'most_weekly_sessions'
  | 'longest_single_session'
  | 'highest_single_session_std_drinks'
  | 'most_weekly_unique_drinks';

export interface RoastAward {
  id: string;
  recapId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  awardType: AwardType;
  title: string;
  roastLine: string;
  statValue: number | null;
  statLabel: string | null;
  emoji: string;
}

export interface RoastRecapSummary {
  totalGroupDrinks: number;
  totalGroupSessions: number;
  totalGroupStandardDrinks: number;
  mostActiveDay: string | null;
  memberCount: number;
  participatingMemberCount: number;
  weekOverWeekChange: number | null;
}

export interface RoastRecap {
  id: string;
  groupId: string;
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  awards: RoastAward[];
  summary: RoastRecapSummary;
  createdAt: string;
}

export interface RoastStreak {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  awardType: AwardType;
  awardTitle: string;
  currentCount: number;
  longestCount: number;
  lastWeekKey: string;
}

export interface GroupRecord {
  id: string;
  groupId: string;
  recordType: GroupRecordType;
  userId: string;
  userName: string;
  userAvatar: string | null;
  value: number;
  formattedValue: string;
  weekKey: string;
  achievedAt: string;
}
