import type { UserProfile } from '@/types';
import { getRelativeDate } from '@/lib/utils';

export const MOCK_USERS: UserProfile[] = [
  {
    id: 'demo-user-001',
    username: 'you',
    displayName: 'You',
    avatarUrl: null,
    bio: 'Just here to party',
    gender: 'male',
    weightKg: 80,
    joinedAt: getRelativeDate(180),
    isDemo: true,
    followers: [],
    following: [],
  },
];

export const DEMO_USER: UserProfile = MOCK_USERS[0];
