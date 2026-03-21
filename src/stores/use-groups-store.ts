import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Group, GroupMember, Challenge } from '@/types';

interface GroupsState {
  groups: Group[];
  challenges: Challenge[];

  addGroup: (group: Group) => void;
  updateGroup: (groupId: string, updates: Partial<Pick<Group, 'name' | 'description' | 'emoji' | 'iconUrl'>>) => void;
  deleteGroup: (groupId: string) => void;
  joinGroup: (inviteCode: string, member: GroupMember) => boolean;
  leaveGroup: (groupId: string, userId: string) => void;
  removeMember: (groupId: string, userId: string) => void;
  getGroupById: (id: string) => Group | undefined;
  getUserGroups: (userId: string) => Group[];

  addChallenge: (challenge: Challenge) => void;
  deleteChallenge: (challengeId: string) => void;
  updateChallengeProgress: (challengeId: string, userId: string, value: number) => void;
  getChallengesByGroup: (groupId: string) => Challenge[];
}

export const useGroupsStore = create<GroupsState>()(
  persist(
    (set, get) => ({
      groups: [],
      challenges: [],

      addGroup: (group) =>
        set((state) => ({ groups: [...state.groups, group] })),

      updateGroup: (groupId, updates) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, ...updates } : g
          ),
        })),

      deleteGroup: (groupId) =>
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== groupId),
          challenges: state.challenges.filter((c) => c.groupId !== groupId),
        })),

      joinGroup: (inviteCode, member) => {
        const group = get().groups.find((g) => g.inviteCode === inviteCode);
        if (!group) return false;
        if (group.members.some((m) => m.userId === member.userId)) return false;

        set((state) => ({
          groups: state.groups.map((g) =>
            g.inviteCode === inviteCode
              ? { ...g, members: [...g.members, member] }
              : g
          ),
        }));
        return true;
      },

      leaveGroup: (groupId, userId) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId
              ? { ...g, members: g.members.filter((m) => m.userId !== userId) }
              : g
          ),
        })),

      removeMember: (groupId, userId) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId
              ? { ...g, members: g.members.filter((m) => m.userId !== userId) }
              : g
          ),
        })),

      getGroupById: (id) => get().groups.find((g) => g.id === id),

      getUserGroups: (userId) =>
        get().groups.filter((g) => g.members.some((m) => m.userId === userId)),

      addChallenge: (challenge) =>
        set((state) => ({ challenges: [...state.challenges, challenge] })),

      deleteChallenge: (challengeId) =>
        set((state) => ({
          challenges: state.challenges.filter((c) => c.id !== challengeId),
        })),

      updateChallengeProgress: (challengeId, userId, value) =>
        set((state) => ({
          challenges: state.challenges.map((c) => {
            if (c.id !== challengeId) return c;
            const updated = c.participants.map((p) =>
              p.userId === userId ? { ...p, currentValue: value } : p
            );
            const sorted = [...updated].sort((a, b) => b.currentValue - a.currentValue);
            return { ...c, participants: sorted.map((p, i) => ({ ...p, rank: i + 1 })) };
          }),
        })),

      getChallengesByGroup: (groupId) =>
        get().challenges.filter((c) => c.groupId === groupId),
    }),
    { name: 'hevydrinkr-groups' }
  )
);
