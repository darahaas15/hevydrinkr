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
  drinkCategory: string;
  timestamp: string;
}
