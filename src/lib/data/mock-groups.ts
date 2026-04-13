import type { Group, GroupMember } from '@/types';
import { MOCK_USERS } from './mock-users';
import { getRelativeDate } from '@/lib/utils';

// ── Helpers ─────────────────────────────────────────────────

function member(
  userId: string,
  role: 'admin' | 'member',
  daysAgoJoined: number,
): GroupMember {
  const user = MOCK_USERS.find((u) => u.id === userId)!;
  return {
    userId: user.id,
    userName: user.displayName,
    userAvatar: user.avatarUrl,
    role,
    joinedAt: getRelativeDate(daysAgoJoined),
  };
}

// ── Groups ──────────────────────────────────────────────────

const DEMO = 'demo-user-001';
const U2 = 'user-002';
const U3 = 'user-003';
const U4 = 'user-004';
const U5 = 'user-005';
const U7 = 'user-007';
const U8 = 'user-008';

const GROUP_1_ID = 'group-weekend-warriors';
const GROUP_2_ID = 'group-college-crew';
const GROUP_3_ID = 'group-the-regulars';

export const MOCK_GROUPS: Group[] = [
  {
    id: GROUP_1_ID,
    name: 'Weekend Warriors',
    emoji: '\u2694\uFE0F',
    description: 'We only drink on days that end in Y',
    createdByUserId: DEMO,
    members: [
      member(DEMO, 'admin', 90),
      member(U2, 'member', 88),
      member(U3, 'member', 85),
      member(U4, 'member', 80),
      member(U5, 'member', 75),
    ],
    iconUrl: null,
    inviteCode: 'WW2024',
    createdAt: getRelativeDate(90),
    isActive: true,
  },
  {
    id: GROUP_2_ID,
    name: 'College Crew',
    emoji: '\u{1F393}',
    description: 'Reliving the glory days one drink at a time',
    createdByUserId: U2,
    members: [
      member(U2, 'admin', 60),
      member(DEMO, 'member', 58),
      member(U7, 'member', 55),
      member(U8, 'member', 50),
    ],
    iconUrl: null,
    inviteCode: 'CC2024',
    createdAt: getRelativeDate(60),
    isActive: true,
  },
  {
    id: GROUP_3_ID,
    name: 'The Regulars',
    emoji: '\u{1F37A}',
    description: 'Same bar, same seats, same crew',
    createdByUserId: DEMO,
    members: [
      member(DEMO, 'admin', 45),
      member(U4, 'member', 42),
      member(U8, 'member', 40),
    ],
    iconUrl: null,
    inviteCode: 'REG24',
    createdAt: getRelativeDate(45),
    isActive: true,
  },
];
