import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Group,
  GroupMember,
} from '@/types';
import { supabase } from '@/lib/supabase/client';

const GROUPS_STALE_MS = 30_000;
let _groupsLastFetched = 0;

interface GroupsState {
  groups: Group[];
  loading: boolean;

  fetchGroups: (userId: string, force?: boolean) => Promise<void>;
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

export const useGroupsStore = create<GroupsState>()(persist((set, get) => ({
  groups: [],
  loading: true,

  fetchGroups: async (userId, force) => {
    if (!force && Date.now() - _groupsLastFetched < GROUPS_STALE_MS) return;
    _groupsLastFetched = Date.now();
    if (get().groups.length === 0) set({ loading: true });
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

    // Optimistic update
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
    }));

    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      console.error('Failed to delete group:', error);
      // Roll back
      if (prev) {
        set((state) => ({
          groups: [...state.groups, prev],
        }));
      }
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

}), {
  name: 'hd-groups',
  partialize: (s) => ({ groups: s.groups }),
  onRehydrateStorage: () => (state) => {
    if (state && state.groups.length > 0) state.loading = false;
  },
}));
