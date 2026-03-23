export type ChallengeStatus = 'pending' | 'active' | 'completed' | 'expired';
export type WagerOutcome = 'pending' | 'won' | 'lost' | 'draw' | 'cancelled';
export type ChallengeType = 'individual' | 'team' | 'head-to-head';
export type ChallengeMetric =
  | 'total_drinks'
  | 'total_standard_drinks'
  | 'unique_drinks'
  | 'session_duration'
  | 'most_sessions';

export interface Group {
  id: string;
  name: string;
  emoji: string;
  description: string;
  createdByUserId: string;
  members: GroupMember[];
  iconUrl: string | null;
  inviteCode: string;
  createdAt: string;
  isActive: boolean;
}

export interface GroupMember {
  userId: string;
  userName: string;
  userAvatar: string | null;
  role: 'admin' | 'member';
  joinedAt: string;
}

export interface Challenge {
  id: string;
  groupId: string;
  title: string;
  description: string;
  type: ChallengeType;
  metric: ChallengeMetric;
  targetValue: number | null;
  startDate: string;
  endDate: string;
  status: ChallengeStatus;
  participants: ChallengeParticipant[];
  winnerId: string | null;
  wager: Wager | null;
}

export interface ChallengeParticipant {
  userId: string;
  userName: string;
  userAvatar: string | null;
  currentValue: number;
  rank: number;
}

export interface Wager {
  id: string;
  challengeId: string;
  createdByUserId: string;
  description: string;
  stake: string;
  participants: WagerParticipant[];
}

export interface WagerParticipant {
  userId: string;
  userName: string;
  accepted: boolean;
  outcome: WagerOutcome;
}

export interface PartySession {
  id: string;
  groupId: string;
  hostUserId: string;
  name: string;
  status: 'waiting' | 'active' | 'ended';
  startedAt: string | null;
  endedAt: string | null;
  participants: PartyParticipant[];
  liveDrinkFeed: PartyDrinkEvent[];
}

export interface PartyParticipant {
  userId: string;
  userName: string;
  userAvatar: string | null;
  sessionId: string;
  totalStandardDrinks: number;
  isActive: boolean;
}

export interface PartyDrinkEvent {
  id: string;
  userId: string;
  userName: string;
  drinkName: string;
  drinkEmoji: string;
  timestamp: string;
}
