import type { Group, Challenge, GroupMember, ChallengeParticipant, Wager } from '@/types';
import { MOCK_USERS } from './mock-users';
import { getRelativeDate, generateId } from '@/lib/utils';

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

function participant(
  userId: string,
  currentValue: number,
  rank: number,
): ChallengeParticipant {
  const user = MOCK_USERS.find((u) => u.id === userId)!;
  return {
    userId: user.id,
    userName: user.displayName,
    userAvatar: user.avatarUrl,
    currentValue,
    rank,
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

// ── Challenges ──────────────────────────────────────────────

const CHALLENGE_1_ID = generateId();
const CHALLENGE_2_ID = generateId();
const CHALLENGE_3_ID = generateId();

const wager2: Wager = {
  id: generateId(),
  challengeId: CHALLENGE_2_ID,
  createdByUserId: U2,
  description: 'Most sessions this month wins',
  stake: 'Loser buys brunch',
  participants: [
    { userId: U2, userName: 'Party Pete', accepted: true, outcome: 'pending' },
    { userId: DEMO, userName: 'You', accepted: true, outcome: 'pending' },
    { userId: U7, userName: 'Mix Master', accepted: true, outcome: 'pending' },
    { userId: U8, userName: 'Pub Crawler', accepted: true, outcome: 'pending' },
  ],
};

export const MOCK_CHALLENGES: Challenge[] = [
  // Active challenge for Weekend Warriors
  {
    id: CHALLENGE_1_ID,
    groupId: GROUP_1_ID,
    title: 'Weekend Showdown',
    description: 'Most drinks this week wins',
    type: 'individual',
    metric: 'total_drinks',
    targetValue: null,
    startDate: getRelativeDate(3),
    endDate: getRelativeDate(-4), // 4 days from now
    status: 'active',
    participants: [
      participant(DEMO, 7, 2),
      participant(U2, 5, 3),
      participant(U3, 9, 1),
      participant(U4, 4, 4),
      participant(U5, 3, 5),
    ],
    winnerId: null,
    wager: null,
  },

  // Active challenge for College Crew (with wager)
  {
    id: CHALLENGE_2_ID,
    groupId: GROUP_2_ID,
    title: 'Session Marathon',
    description: 'Most drinking sessions this month',
    type: 'individual',
    metric: 'most_sessions',
    targetValue: null,
    startDate: getRelativeDate(20),
    endDate: getRelativeDate(-10), // 10 days from now
    status: 'active',
    participants: [
      participant(U2, 4, 1),
      participant(DEMO, 3, 2),
      participant(U7, 2, 3),
      participant(U8, 2, 4),
    ],
    winnerId: null,
    wager: wager2,
  },

  // Completed challenge for The Regulars
  {
    id: CHALLENGE_3_ID,
    groupId: GROUP_3_ID,
    title: 'March Madness',
    description: 'Most drinks last month',
    type: 'individual',
    metric: 'total_drinks',
    targetValue: null,
    startDate: getRelativeDate(60),
    endDate: getRelativeDate(30),
    status: 'completed',
    participants: [
      participant(DEMO, 12, 1),
      participant(U4, 10, 2),
      participant(U8, 8, 3),
    ],
    winnerId: DEMO,
    wager: null,
  },
];
