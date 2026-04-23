export type Gender = 'male' | 'female' | 'other';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  gender: Gender;
  weightKg: number;
  heightCm: number | null;
  joinedAt: string;
  isDemo: boolean;
  isPrivate: boolean;
  followers: string[];
  following: string[];
}

export interface UserSettings {
  userId: string;
  hydrationReminderEnabled: boolean;
  hydrationIntervalMinutes: number;
  bacWarningThreshold: number;
  theme: 'dark' | 'neon';
}

export interface FollowRequest {
  id: string;
  requesterId: string;
  targetId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  requesterProfile?: {
    displayName: string;
    avatarUrl: string | null;
    username: string;
  };
}
