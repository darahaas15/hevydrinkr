import { create } from 'zustand';
import type {
  Group,
  GroupMember,
  Challenge,
  ChallengeParticipant,
  Wager,
  WagerParticipant,
} from '@/types';
import { supabase } from '@/lib/supabase/client';

interface GroupsState {
  groups: Group[];
  challenges: Challenge[];
  loading: boolean;

  fetchGroups: (userId: string) => Promise<void>;
  addGroup: (group: Group) => Promise<void>;
  updateGroup: (
    groupId: string,
    updates: Partial<Pick<Group, 'name' | 'description' | 'emoji' | 'iconUrl'>>
  ) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  joinGroup: (inviteCode: string, member: GroupMember) => Promise<boolean>;
  leaveGroup: (groupId: string, userId: string) => Promise<void>;
  removeMember: (groupId: string, userId: string) => Promise<void>;
  getGroupById: (id: string) => Group | undefined;
  getUserGroups: (userId: string) => Group[];

  fetchChallenges: (groupId: string) => Promise<void>;
  addChallenge: (challenge: Challenge) => Promise<void>;
  deleteChallenge: (challengeId: string) => Promise<void>;
  refreshChallengeProgress: (challengeId: string) => Promise<void>;
  updateChallengeProgress: (
    challengeId: string,
    userId: string,
    value: number
  ) => Promise<void>;
  getChallengesByGroup: (groupId: string) => Challenge[];
}

function mapDbGroupToGroup(
  dbGroup: Record<string, unknown>
): Group {
  const members: GroupMember[] = (
    (dbGroup.group_members as Record<string, unknown>[]) ?? []
  ).map((gm) => {
    const profile = gm.profile as
      | { display_name: string; avatar_url: string | null }
      | null;
    return {
      userId: gm.user_id as string,
      userName: profile?.display_name ?? 'Unknown',
      userAvatar: profile?.avatar_url ?? null,
      role: gm.role as 'admin' | 'member',
      joinedAt: gm.joined_at as string,
    };
  });

  return {
    id: dbGroup.id as string,
    name: dbGroup.name as string,
    emoji: dbGroup.emoji as string,
    description: dbGroup.description as string,
    createdByUserId: dbGroup.created_by as string,
    members,
    iconUrl: (dbGroup.icon_url as string) ?? null,
    inviteCode: dbGroup.invite_code as string,
    createdAt: dbGroup.created_at as string,
    isActive: dbGroup.is_active as boolean,
  };
}

function mapDbChallengeToChallenge(
  dbChallenge: Record<string, unknown>
): Challenge {
  const participants: ChallengeParticipant[] = (
    (dbChallenge.challenge_participants as Record<string, unknown>[]) ?? []
  ).map((cp) => {
    const profile = cp.profile as
      | { display_name: string; avatar_url: string | null }
      | null;
    return {
      userId: cp.user_id as string,
      userName: profile?.display_name ?? 'Unknown',
      userAvatar: profile?.avatar_url ?? null,
      currentValue: cp.current_value as number,
      rank: cp.rank as number,
    };
  });

  let wager: Wager | null = null;
  const dbWagers = dbChallenge.wagers as Record<string, unknown>[] | null;
  if (dbWagers && dbWagers.length > 0) {
    const w = dbWagers[0];
    const wagerParticipants: WagerParticipant[] = (
      (w.wager_participants as Record<string, unknown>[]) ?? []
    ).map((wp) => {
      const profile = wp.profile as
        | { display_name: string }
        | null;
      return {
        userId: wp.user_id as string,
        userName: profile?.display_name ?? 'Unknown',
        accepted: wp.accepted as boolean,
        outcome: wp.outcome as WagerParticipant['outcome'],
      };
    });

    wager = {
      id: w.id as string,
      challengeId: w.challenge_id as string,
      createdByUserId: w.created_by as string,
      description: w.description as string,
      stake: w.stake as string,
      participants: wagerParticipants,
    };
  }

  return {
    id: dbChallenge.id as string,
    groupId: dbChallenge.group_id as string,
    title: dbChallenge.title as string,
    description: dbChallenge.description as string,
    type: dbChallenge.type as Challenge['type'],
    metric: dbChallenge.metric as Challenge['metric'],
    targetValue: (dbChallenge.target_value as number) ?? null,
    startDate: dbChallenge.start_date as string,
    endDate: dbChallenge.end_date as string,
    status: dbChallenge.status as Challenge['status'],
    participants,
    winnerId: (dbChallenge.winner_id as string) ?? null,
    wager,
  };
}

export const useGroupsStore = create<GroupsState>()((set, get) => ({
  groups: [],
  challenges: [],
  loading: true,

  fetchGroups: async (userId) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('groups')
      .select(
        `*, group_members(*, profile:profiles!group_members_user_id_fkey(display_name, avatar_url))`
      )
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch groups:', error);
      set({ loading: false });
      return;
    }

    const allGroups = (data ?? []).map(mapDbGroupToGroup);
    // Only keep groups the user is a member of
    const userGroups = allGroups.filter((g) =>
      g.members.some((m) => m.userId === userId)
    );

    set({ groups: userGroups, loading: false });
  },

  addGroup: async (group) => {
    // Optimistic update
    set((state) => ({ groups: [...state.groups, group] }));

    const { error: groupError } = await supabase.from('groups').insert({
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      description: group.description,
      created_by: group.createdByUserId,
      icon_url: group.iconUrl,
      invite_code: group.inviteCode,
      is_active: group.isActive,
    });

    if (groupError) {
      console.error('Failed to create group:', groupError);
      // Roll back
      set((state) => ({
        groups: state.groups.filter((g) => g.id !== group.id),
      }));
      return;
    }

    // Add creator as admin member
    const creator = group.members.find(
      (m) => m.userId === group.createdByUserId
    );
    if (creator) {
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: creator.userId,
          role: 'admin',
        });

      if (memberError) {
        console.error('Failed to add creator as member:', memberError);
      }
    }
  },

  updateGroup: async (groupId, updates) => {
    const prev = get().groups.find((g) => g.id === groupId);
    // Optimistic update
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, ...updates } : g
      ),
    }));

    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined)
      dbUpdates.description = updates.description;
    if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji;
    if (updates.iconUrl !== undefined) dbUpdates.icon_url = updates.iconUrl;

    const { error } = await supabase
      .from('groups')
      .update(dbUpdates)
      .eq('id', groupId);

    if (error) {
      console.error('Failed to update group:', error);
      if (prev) {
        set((state) => ({
          groups: state.groups.map((g) => (g.id === groupId ? prev : g)),
        }));
      }
    }
  },

  deleteGroup: async (groupId) => {
    const prev = get().groups.find((g) => g.id === groupId);
    const prevChallenges = get().challenges.filter(
      (c) => c.groupId === groupId
    );

    // Optimistic update
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
      challenges: state.challenges.filter((c) => c.groupId !== groupId),
    }));

    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      console.error('Failed to delete group:', error);
      // Roll back
      set((state) => ({
        groups: prev ? [...state.groups, prev] : state.groups,
        challenges: [...state.challenges, ...prevChallenges],
      }));
    }
  },

  joinGroup: async (inviteCode, member) => {
    // Look up group by invite code
    const { data, error: lookupError } = await supabase
      .from('groups')
      .select(
        `*, group_members(*, profile:profiles!group_members_user_id_fkey(display_name, avatar_url))`
      )
      .eq('invite_code', inviteCode)
      .eq('is_active', true)
      .single();

    if (lookupError || !data) {
      console.error('Group not found for invite code:', lookupError);
      return false;
    }

    const group = mapDbGroupToGroup(data);

    // Already a member?
    if (group.members.some((m) => m.userId === member.userId)) {
      return false;
    }

    // Insert membership
    const { error: joinError } = await supabase
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: member.userId,
        role: member.role,
      });

    if (joinError) {
      console.error('Failed to join group:', joinError);
      return false;
    }

    // Update local state
    const updatedGroup: Group = {
      ...group,
      members: [...group.members, member],
    };

    set((state) => {
      const exists = state.groups.some((g) => g.id === group.id);
      return {
        groups: exists
          ? state.groups.map((g) => (g.id === group.id ? updatedGroup : g))
          : [...state.groups, updatedGroup],
      };
    });

    return true;
  },

  leaveGroup: async (groupId, userId) => {
    // Optimistic update
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId
          ? { ...g, members: g.members.filter((m) => m.userId !== userId) }
          : g
      ),
    }));

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to leave group:', error);
    }
  },

  removeMember: async (groupId, userId) => {
    // Optimistic update
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId
          ? { ...g, members: g.members.filter((m) => m.userId !== userId) }
          : g
      ),
    }));

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to remove member:', error);
    }
  },

  getGroupById: (id) => get().groups.find((g) => g.id === id),

  getUserGroups: (userId) =>
    get().groups.filter((g) => g.members.some((m) => m.userId === userId)),

  fetchChallenges: async (groupId) => {
    const { data, error } = await supabase
      .from('challenges')
      .select(
        `*, challenge_participants(*, profile:profiles!challenge_participants_user_id_fkey(display_name, avatar_url)), wagers(*, wager_participants(*, profile:profiles!wager_participants_user_id_fkey(display_name)))`
      )
      .eq('group_id', groupId);

    if (error) {
      console.error('Failed to fetch challenges:', error);
      return;
    }

    const fetched = (data ?? []).map(mapDbChallengeToChallenge);

    set((state) => {
      // Replace challenges for this group, keep others
      const other = state.challenges.filter((c) => c.groupId !== groupId);
      return { challenges: [...other, ...fetched] };
    });
  },

  addChallenge: async (challenge) => {
    // Optimistic update
    set((state) => ({ challenges: [...state.challenges, challenge] }));

    const { error: challengeError } = await supabase
      .from('challenges')
      .insert({
        id: challenge.id,
        group_id: challenge.groupId,
        title: challenge.title,
        description: challenge.description,
        type: challenge.type,
        metric: challenge.metric,
        target_value: challenge.targetValue,
        start_date: challenge.startDate,
        end_date: challenge.endDate,
        status: challenge.status,
        winner_id: challenge.winnerId,
      });

    if (challengeError) {
      console.error('Failed to create challenge:', challengeError);
      set((state) => ({
        challenges: state.challenges.filter((c) => c.id !== challenge.id),
      }));
      return;
    }

    // Insert participants
    if (challenge.participants.length > 0) {
      const rows = challenge.participants.map((p) => ({
        challenge_id: challenge.id,
        user_id: p.userId,
        current_value: p.currentValue,
        rank: p.rank,
      }));

      const { error: partError } = await supabase
        .from('challenge_participants')
        .insert(rows);

      if (partError) {
        console.error('Failed to add challenge participants:', partError);
      }
    }

    // Insert wager if present
    if (challenge.wager) {
      const w = challenge.wager;
      const { error: wagerError } = await supabase.from('wagers').insert({
        id: w.id,
        challenge_id: w.challengeId,
        created_by: w.createdByUserId,
        description: w.description,
        stake: w.stake,
      });

      if (wagerError) {
        console.error('Failed to create wager:', wagerError);
      } else if (w.participants.length > 0) {
        const wagerRows = w.participants.map((wp) => ({
          wager_id: w.id,
          user_id: wp.userId,
          accepted: wp.accepted,
          outcome: wp.outcome,
        }));

        const { error: wpError } = await supabase
          .from('wager_participants')
          .insert(wagerRows);

        if (wpError) {
          console.error('Failed to add wager participants:', wpError);
        }
      }
    }
  },

  deleteChallenge: async (challengeId) => {
    const prev = get().challenges.find((c) => c.id === challengeId);

    // Optimistic update
    set((state) => ({
      challenges: state.challenges.filter((c) => c.id !== challengeId),
    }));

    const { error } = await supabase
      .from('challenges')
      .delete()
      .eq('id', challengeId);

    if (error) {
      console.error('Failed to delete challenge:', error);
      if (prev) {
        set((state) => ({ challenges: [...state.challenges, prev] }));
      }
    }
  },

  refreshChallengeProgress: async (challengeId) => {
    const challenge = get().challenges.find((c) => c.id === challengeId);
    if (!challenge || challenge.status !== 'active') return;

    // Fetch sessions for all participants within the challenge timeframe
    const participantIds = challenge.participants.map((p) => p.userId);
    const { data: sessions } = await supabase
      .from('drink_sessions')
      .select('user_id, drinks:drink_entries(standard_drinks), duration_minutes, rounds(id)')
      .in('user_id', participantIds)
      .eq('status', 'completed')
      .gte('started_at', challenge.startDate)
      .lte('started_at', challenge.endDate);

    if (!sessions) return;

    // Compute values per participant based on metric
    const values: Record<string, number> = {};
    for (const s of sessions) {
      const uid = s.user_id as string;
      if (!values[uid]) values[uid] = 0;
      const drinks = (s.drinks as { standard_drinks: number }[]) || [];
      const totalStd = drinks.reduce((sum, d) => sum + d.standard_drinks, 0);
      const rounds = (s.rounds as { id: string }[]) || [];

      switch (challenge.metric) {
        case 'total_drinks':
          values[uid] += drinks.length;
          break;
        case 'total_standard_drinks':
          values[uid] += totalStd;
          break;
        case 'most_sessions':
          values[uid] += 1;
          break;
        case 'session_duration':
          values[uid] = Math.max(values[uid], (s.duration_minutes as number) || 0);
          break;
        case 'unique_drinks':
          values[uid] += drinks.length; // approximation
          break;
        case 'most_rounds_bought':
          values[uid] += rounds.length;
          break;
      }
    }

    // Update each participant
    for (const p of challenge.participants) {
      const val = values[p.userId] || 0;
      if (val !== p.currentValue) {
        await supabase
          .from('challenge_participants')
          .update({ current_value: val })
          .eq('challenge_id', challengeId)
          .eq('user_id', p.userId);
      }
    }

    // Update local state with re-ranking
    set((state) => ({
      challenges: state.challenges.map((c) => {
        if (c.id !== challengeId) return c;
        const updated = c.participants.map((p) => ({
          ...p,
          currentValue: values[p.userId] || 0,
        }));
        const sorted = [...updated].sort((a, b) => b.currentValue - a.currentValue);
        return { ...c, participants: sorted.map((p, i) => ({ ...p, rank: i + 1 })) };
      }),
    }));
  },

  updateChallengeProgress: async (challengeId, userId, value) => {
    // Optimistic update with re-ranking
    set((state) => ({
      challenges: state.challenges.map((c) => {
        if (c.id !== challengeId) return c;
        const updated = c.participants.map((p) =>
          p.userId === userId ? { ...p, currentValue: value } : p
        );
        const sorted = [...updated].sort(
          (a, b) => b.currentValue - a.currentValue
        );
        return {
          ...c,
          participants: sorted.map((p, i) => ({ ...p, rank: i + 1 })),
        };
      }),
    }));

    const { error } = await supabase
      .from('challenge_participants')
      .update({ current_value: value })
      .eq('challenge_id', challengeId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to update challenge progress:', error);
    }
  },

  getChallengesByGroup: (groupId) =>
    get().challenges.filter((c) => c.groupId === groupId),
}));
