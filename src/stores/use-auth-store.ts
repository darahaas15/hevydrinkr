import { create } from 'zustand';
import type { UserProfile } from '@/types';
import { supabase } from '@/lib/supabase/client';

interface AuthState {
  currentUser: UserProfile | null;
  allUsers: UserProfile[];
  isAuthenticated: boolean;
  isLoading: boolean;

  initialize: () => Promise<void>;
  signup: (email: string, password: string, username: string, displayName: string) => Promise<string | null>;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<UserProfile, 'displayName' | 'bio' | 'gender' | 'weightKg' | 'avatarUrl'>>) => Promise<void>;
  getUserById: (id: string) => UserProfile | undefined;
  fetchAllUsers: () => Promise<void>;
  toggleFollow: (userId: string) => Promise<void>;
}

function profileFromRow(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    username: row.username as string,
    displayName: row.display_name as string,
    avatarUrl: (row.avatar_url as string) || null,
    bio: (row.bio as string) || '',
    gender: (row.gender as 'male' | 'female' | 'other') || 'other',
    weightKg: (row.weight_kg as number) || 70,
    joinedAt: row.created_at as string,
    isDemo: false,
    followers: (row.followers as string[]) || [],
    following: (row.following as string[]) || [],
  };
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  currentUser: null,
  allUsers: [],
  isAuthenticated: false,
  isLoading: true,

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
        return;
      }
    }
    set({ currentUser: null, isAuthenticated: false, isLoading: false });
  },

  signup: async (email, password, username, displayName) => {
    // Check username availability
    const sanitized = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', sanitized)
      .maybeSingle();

    if (existing) return 'Username already taken';

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: sanitized, display_name: displayName },
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
    await supabase.auth.signOut();
    set({ currentUser: null, allUsers: [], isAuthenticated: false });
  },

  updateProfile: async (updates) => {
    const { currentUser } = get();
    if (!currentUser) return;

    const dbUpdates: Record<string, unknown> = {};
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
    if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
    if (updates.weightKg !== undefined) dbUpdates.weight_kg = updates.weightKg;
    if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
    dbUpdates.updated_at = new Date().toISOString();

    await supabase.from('profiles').update(dbUpdates).eq('id', currentUser.id);

    const updated = { ...currentUser, ...updates };
    set({
      currentUser: updated,
      allUsers: get().allUsers.map((u) => (u.id === currentUser.id ? updated : u)),
    });
  },

  getUserById: (id) => get().allUsers.find((u) => u.id === id),

  fetchAllUsers: async () => {
    const [{ data: profiles }, { data: allFollows }] = await Promise.all([
      supabase.from('profiles').select('id, username, display_name, avatar_url, bio, created_at'),
      supabase.from('follows').select('follower_id, following_id'),
    ]);
    if (!profiles) return;

    const followsData = allFollows || [];
    const users = profiles.map((p) => {
      const id = p.id as string;
      return profileFromRow({
        ...p,
        followers: followsData.filter((f) => f.following_id === id).map((f) => f.follower_id),
        following: followsData.filter((f) => f.follower_id === id).map((f) => f.following_id),
      });
    });
    set({ allUsers: users });
  },

  toggleFollow: async (userId) => {
    const { currentUser, allUsers } = get();
    if (!currentUser) return;

    const isFollowing = currentUser.following.includes(userId);
    const prevCurrentUser = currentUser;
    const prevAllUsers = allUsers;

    // Optimistic update
    const updatedFollowing = isFollowing
      ? currentUser.following.filter((id) => id !== userId)
      : [...currentUser.following, userId];

    const updatedCurrentUser = { ...currentUser, following: updatedFollowing };

    const updatedAllUsers = allUsers.map((user) => {
      if (user.id === currentUser.id) return updatedCurrentUser;
      if (user.id === userId) {
        return {
          ...user,
          followers: isFollowing
            ? user.followers.filter((id) => id !== currentUser.id)
            : [...user.followers, currentUser.id],
        };
      }
      return user;
    });

    set({ currentUser: updatedCurrentUser, allUsers: updatedAllUsers });

    // Sync to DB
    const { error } = isFollowing
      ? await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId)
      : await supabase
          .from('follows')
          .insert({ follower_id: currentUser.id, following_id: userId });

    if (error) {
      console.error('Failed to toggle follow:', error);
      set({ currentUser: prevCurrentUser, allUsers: prevAllUsers });
    }
  },
}));
