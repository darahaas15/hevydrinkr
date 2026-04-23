import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile, Gender, FollowRequest } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { hapticMedium } from '@/lib/haptics';
import { useUIStore } from '@/stores/use-ui-store';
import { safeJSONStorage } from '@/lib/storage/safe-storage';

interface AuthState {
  currentUser: UserProfile | null;
  allUsers: UserProfile[];
  isAuthenticated: boolean;
  isLoading: boolean;
  followRequests: FollowRequest[];
  outgoingRequests: FollowRequest[];

  initialize: () => Promise<void>;
  signup: (email: string, password: string, username: string, displayName: string, gender?: Gender, weightKg?: number, heightCm?: number) => Promise<string | null>;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<UserProfile, 'displayName' | 'bio' | 'gender' | 'weightKg' | 'heightCm' | 'avatarUrl' | 'isPrivate'>>) => Promise<void>;
  getUserById: (id: string) => UserProfile | undefined;
  fetchAllUsers: (force?: boolean) => Promise<void>;
  toggleFollow: (userId: string) => Promise<void>;
  fetchFollowRequests: () => Promise<void>;
  fetchOutgoingRequests: () => Promise<void>;
  sendFollowRequest: (targetId: string) => Promise<void>;
  cancelFollowRequest: (targetId: string) => Promise<void>;
  acceptFollowRequest: (requestId: string) => Promise<void>;
  rejectFollowRequest: (requestId: string) => Promise<void>;
  removeFollower: (followerId: string) => Promise<void>;
}

// Guard against rapid follow/unfollow taps causing conflicting DB operations
const followInFlight = new Set<string>();
const USERS_STALE_MS = 30_000;
let _usersLastFetched = 0;

function profileFromRow(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    username: row.username as string,
    displayName: row.display_name as string,
    avatarUrl: (row.avatar_url as string) || null,
    bio: (row.bio as string) || '',
    gender: (row.gender as 'male' | 'female' | 'other') || 'other',
    weightKg: (row.weight_kg as number) || 70,
    heightCm: (row.height_cm as number) ?? null,
    joinedAt: row.created_at as string,
    isDemo: false,
    isPrivate: (row.is_private as boolean) || false,
    followers: (row.followers as string[]) || [],
    following: (row.following as string[]) || [],
  };
}

export const useAuthStore = create<AuthState>()(persist((set, get) => ({
  currentUser: null,
  allUsers: [],
  isAuthenticated: false,
  isLoading: true,
  followRequests: [],
  outgoingRequests: [],

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        // Fetch follow data
        const [{ data: followers }, { data: following }] = await Promise.all([
          supabase.from('follows').select('follower_id').eq('following_id', session.user.id),
          supabase.from('follows').select('following_id').eq('follower_id', session.user.id),
        ]);

        const user = profileFromRow({
          ...profile,
          followers: (followers || []).map((f: { follower_id: string }) => f.follower_id),
          following: (following || []).map((f: { following_id: string }) => f.following_id),
        });

        set({ currentUser: user, isAuthenticated: true, isLoading: false });
        get().fetchAllUsers();
        get().fetchFollowRequests();
        get().fetchOutgoingRequests();
        supabase
          .channel('follow-requests')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'follow_requests',
              filter: `target_id=eq.${session.user.id}`,
            },
            () => {
              get().fetchFollowRequests();
            }
          )
          .subscribe();
        return;
      }
    }
    set({ currentUser: null, isAuthenticated: false, isLoading: false });
  },

  signup: async (email, password, username, displayName, gender, weightKg, heightCm) => {
    // Check username availability (uses RPC to bypass RLS for anon users)
    const sanitized = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const { data: taken } = await supabase.rpc('is_username_taken', { p_username: sanitized });

    if (taken) return 'Username already taken';

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
            username: sanitized,
            display_name: displayName,
            ...(gender && { gender }),
            ...(weightKg && { weight_kg: weightKg }),
            ...(heightCm && { height_cm: heightCm }),
          },
      },
    });

    if (error) return error.message;
    if (!data.user) return 'Signup failed';

    // Poll for the profile to be created by the trigger (up to 5s)
    const userId = data.user.id;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      if (profile) break;
    }

    await get().initialize();
    return null;
  },

  login: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    await get().initialize();
    return null;
  },

  logout: async () => {
    supabase.removeChannel(supabase.channel('follow-requests'));
    await supabase.auth.signOut();
    set({ currentUser: null, allUsers: [], isAuthenticated: false, followRequests: [], outgoingRequests: [] });
  },

  updateProfile: async (updates) => {
    const { currentUser } = get();
    if (!currentUser) return;

    const prevUser = currentUser;
    const prevAllUsers = get().allUsers;

    // Optimistic update
    const updated = { ...currentUser, ...updates };
    set({
      currentUser: updated,
      allUsers: get().allUsers.map((u) => (u.id === currentUser.id ? updated : u)),
    });

    const dbUpdates: Record<string, unknown> = {};
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
    if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
    if (updates.weightKg !== undefined) dbUpdates.weight_kg = updates.weightKg;
    if (updates.heightCm !== undefined) dbUpdates.height_cm = updates.heightCm;
    if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
    if (updates.isPrivate !== undefined) dbUpdates.is_private = updates.isPrivate;
    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', currentUser.id);

    if (error) {
      console.error('Failed to update profile:', error);
      set({ currentUser: prevUser, allUsers: prevAllUsers });
      useUIStore.getState().addToast('Something went wrong', 'error');
    }
  },

  getUserById: (id) => get().allUsers.find((u) => u.id === id),

  fetchAllUsers: async (force?: boolean) => {
    if (!force && Date.now() - _usersLastFetched < USERS_STALE_MS) return;
    _usersLastFetched = Date.now();
    const [{ data: profiles }, { data: allFollows }] = await Promise.all([
      supabase.from('profiles').select('id, username, display_name, avatar_url, bio, is_private, created_at').limit(500),
      supabase.from('follows').select('follower_id, following_id').limit(5000),
    ]);
    if (!profiles) return;

    const followsData = allFollows || [];
    // Pre-index follows into Maps for O(1) lookup instead of O(n) per user
    const followersMap = new Map<string, string[]>();
    const followingMap = new Map<string, string[]>();
    for (const f of followsData) {
      const fArr = followersMap.get(f.following_id);
      if (fArr) fArr.push(f.follower_id);
      else followersMap.set(f.following_id, [f.follower_id]);
      const gArr = followingMap.get(f.follower_id);
      if (gArr) gArr.push(f.following_id);
      else followingMap.set(f.follower_id, [f.following_id]);
    }
    const users = profiles.map((p) => {
      const id = p.id as string;
      return profileFromRow({
        ...p,
        followers: followersMap.get(id) || [],
        following: followingMap.get(id) || [],
      });
    });
    set({ allUsers: users });
  },

  toggleFollow: async (userId) => {
    const { currentUser, allUsers } = get();
    if (!currentUser || followInFlight.has(userId)) return;
    if (userId === currentUser.id) return;
    followInFlight.add(userId);
    hapticMedium();

    const isFollowing = currentUser.following.includes(userId);
    const targetUser = allUsers.find((u) => u.id === userId);

    if (isFollowing) {
      const prevCurrentUser = currentUser;
      const prevAllUsers = allUsers;
      const updatedFollowing = currentUser.following.filter((id) => id !== userId);
      const updatedCurrentUser = { ...currentUser, following: updatedFollowing };
      const updatedAllUsers = allUsers.map((user) => {
        if (user.id === currentUser.id) return updatedCurrentUser;
        if (user.id === userId) {
          return { ...user, followers: user.followers.filter((id) => id !== currentUser.id) };
        }
        return user;
      });
      set({ currentUser: updatedCurrentUser, allUsers: updatedAllUsers });

      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUser.id)
        .eq('following_id', userId);

      if (error) {
        console.error('Failed to unfollow:', error);
        set({ currentUser: prevCurrentUser, allUsers: prevAllUsers });
      }
    } else if (targetUser?.isPrivate) {
      await get().sendFollowRequest(userId);
    } else {
      const prevCurrentUser = currentUser;
      const prevAllUsers = allUsers;
      const updatedFollowing = [...currentUser.following, userId];
      const updatedCurrentUser = { ...currentUser, following: updatedFollowing };
      const updatedAllUsers = allUsers.map((user) => {
        if (user.id === currentUser.id) return updatedCurrentUser;
        if (user.id === userId) {
          return { ...user, followers: [...user.followers, currentUser.id] };
        }
        return user;
      });
      set({ currentUser: updatedCurrentUser, allUsers: updatedAllUsers });

      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: currentUser.id, following_id: userId });

      if (error) {
        console.error('Failed to follow:', error);
        set({ currentUser: prevCurrentUser, allUsers: prevAllUsers });
      }
    }
    followInFlight.delete(userId);
  },

  fetchFollowRequests: async () => {
    const { currentUser } = get();
    if (!currentUser) return;
    const { data } = await supabase
      .from('follow_requests')
      .select('id, requester_id, target_id, status, created_at, updated_at, requester:profiles!follow_requests_requester_id_fkey(display_name, avatar_url, username)')
      .eq('target_id', currentUser.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (data) {
      set({
        followRequests: data.map((r) => ({
          id: r.id,
          requesterId: r.requester_id,
          targetId: r.target_id,
          status: r.status as 'pending',
          createdAt: r.created_at,
          requesterProfile: r.requester ? {
            displayName: (r.requester as Record<string, string>).display_name,
            avatarUrl: (r.requester as Record<string, string>).avatar_url,
            username: (r.requester as Record<string, string>).username,
          } : undefined,
        })),
      });
    }
  },

  fetchOutgoingRequests: async () => {
    const { currentUser } = get();
    if (!currentUser) return;
    const { data } = await supabase
      .from('follow_requests')
      .select('id, requester_id, target_id, status, created_at')
      .eq('requester_id', currentUser.id)
      .eq('status', 'pending');

    if (data) {
      set({
        outgoingRequests: data.map((r) => ({
          id: r.id,
          requesterId: r.requester_id,
          targetId: r.target_id,
          status: r.status as 'pending',
          createdAt: r.created_at,
        })),
      });
    }
  },

  sendFollowRequest: async (targetId) => {
    const { currentUser, outgoingRequests } = get();
    if (!currentUser) return;

    await supabase
      .from('follow_requests')
      .delete()
      .eq('requester_id', currentUser.id)
      .eq('target_id', targetId)
      .in('status', ['accepted', 'rejected']);

    const optimistic: FollowRequest = {
      id: crypto.randomUUID(),
      requesterId: currentUser.id,
      targetId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    set({ outgoingRequests: [...outgoingRequests, optimistic] });

    const { data, error } = await supabase
      .from('follow_requests')
      .insert({ requester_id: currentUser.id, target_id: targetId })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to send follow request:', error);
      set({ outgoingRequests: outgoingRequests.filter((r) => r.targetId !== targetId) });
      useUIStore.getState().addToast('Failed to send request', 'error');
    } else if (data) {
      set({
        outgoingRequests: get().outgoingRequests.map((r) =>
          r.targetId === targetId ? { ...r, id: data.id } : r
        ),
      });
    }
      try {
        const { currentUser: cu } = get();
        if (cu) {
          await supabase.functions.invoke('send-notification', {
            body: {
              recipientId: targetId,
              type: 'follow_request',
              title: 'Follow Request',
              body: `@${cu.username} requested to follow you`,
              data: { userId: cu.id },
            },
          });
        }
      } catch { /* notification failure is non-critical */ }
  },

  cancelFollowRequest: async (targetId) => {
    const { outgoingRequests } = get();
    const prev = outgoingRequests;
    set({ outgoingRequests: outgoingRequests.filter((r) => r.targetId !== targetId) });

    const { error } = await supabase
      .from('follow_requests')
      .delete()
      .eq('requester_id', get().currentUser?.id ?? '')
      .eq('target_id', targetId);

    if (error) {
      console.error('Failed to cancel follow request:', error);
      set({ outgoingRequests: prev });
    }
  },

  acceptFollowRequest: async (requestId) => {
    const { followRequests, currentUser, allUsers } = get();
    const request = followRequests.find((r) => r.id === requestId);
    if (!request || !currentUser) return;

    set({
      followRequests: followRequests.filter((r) => r.id !== requestId),
      currentUser: { ...currentUser, followers: [...currentUser.followers, request.requesterId] },
      allUsers: allUsers.map((u) => {
        if (u.id === currentUser.id) return { ...u, followers: [...u.followers, request.requesterId] };
        if (u.id === request.requesterId) return { ...u, following: [...u.following, currentUser.id] };
        return u;
      }),
    });

    const { error } = await supabase
      .from('follow_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId);

    if (error) {
      console.error('Failed to accept follow request:', error);
      set({ followRequests, currentUser, allUsers });
      useUIStore.getState().addToast('Failed to accept request', 'error');
    }
    try {
      const { currentUser: cu } = get();
      if (cu && request.requesterId) {
        await supabase.functions.invoke('send-notification', {
          body: {
            recipientId: request.requesterId,
            type: 'follow_request_accepted',
            title: 'Follow Request Accepted',
            body: `@${cu.username} accepted your follow request`,
            data: { userId: cu.id },
          },
        });
      }
    } catch { /* notification failure is non-critical */ }
  },

  rejectFollowRequest: async (requestId) => {
    const { followRequests } = get();
    const prev = followRequests;
    set({ followRequests: followRequests.filter((r) => r.id !== requestId) });

    const { error } = await supabase
      .from('follow_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);

    if (error) {
      console.error('Failed to reject follow request:', error);
      set({ followRequests: prev });
    }
  },

  removeFollower: async (followerId) => {
    const { currentUser, allUsers } = get();
    if (!currentUser) return;

    const prevCurrentUser = currentUser;
    const prevAllUsers = allUsers;
    set({
      currentUser: { ...currentUser, followers: currentUser.followers.filter((id) => id !== followerId) },
      allUsers: allUsers.map((u) => {
        if (u.id === currentUser.id) return { ...u, followers: u.followers.filter((id) => id !== followerId) };
        if (u.id === followerId) return { ...u, following: u.following.filter((id) => id !== currentUser.id) };
        return u;
      }),
    });

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', currentUser.id);

    if (error) {
      console.error('Failed to remove follower:', error);
      set({ currentUser: prevCurrentUser, allUsers: prevAllUsers });
      useUIStore.getState().addToast('Failed to remove follower', 'error');
    }
  },
}), {
  name: 'hd-auth',
  storage: safeJSONStorage(),
  partialize: (s) => ({ currentUser: s.currentUser, isAuthenticated: s.isAuthenticated }),
}));
