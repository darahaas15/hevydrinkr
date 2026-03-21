import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile } from '@/types';
import { generateId } from '@/lib/utils';

interface AuthState {
  currentUser: UserProfile | null;
  allUsers: UserProfile[];
  isAuthenticated: boolean;

  signup: (username: string, displayName: string, gender: 'male' | 'female' | 'other', weightKg: number) => void;
  login: (username: string) => boolean;
  loginWithUser: (user: UserProfile) => void;
  logout: () => void;
  updateProfile: (updates: Partial<Pick<UserProfile, 'displayName' | 'bio' | 'gender' | 'weightKg' | 'avatarUrl'>>) => void;
  setUsers: (users: UserProfile[]) => void;
  getUserById: (id: string) => UserProfile | undefined;
  toggleFollow: (userId: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      allUsers: [],
      isAuthenticated: false,

      signup: (username, displayName, gender, weightKg) => {
        const newUser: UserProfile = {
          id: generateId(),
          username: username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
          displayName,
          avatarUrl: null,
          bio: '',
          gender,
          weightKg,
          joinedAt: new Date().toISOString(),
          isDemo: false,
          followers: [],
          following: [],
        };

        set((state) => ({
          currentUser: newUser,
          allUsers: [...state.allUsers, newUser],
          isAuthenticated: true,
        }));
      },

      login: (username) => {
        const user = get().allUsers.find(
          (u) => u.username.toLowerCase() === username.toLowerCase()
        );
        if (user) {
          set({ currentUser: user, isAuthenticated: true });
          return true;
        }
        return false;
      },

      loginWithUser: (user) =>
        set({ currentUser: user, isAuthenticated: true }),

      logout: () =>
        set({ currentUser: null, isAuthenticated: false }),

      updateProfile: (updates) => {
        const { currentUser, allUsers } = get();
        if (!currentUser) return;

        const updated = { ...currentUser, ...updates };
        set({
          currentUser: updated,
          allUsers: allUsers.map((u) => (u.id === currentUser.id ? updated : u)),
        });
      },

      setUsers: (users) => set({ allUsers: users }),

      getUserById: (id) => get().allUsers.find((u) => u.id === id),

      toggleFollow: (userId) => {
        const { currentUser, allUsers } = get();
        if (!currentUser) return;

        const isFollowing = currentUser.following.includes(userId);

        const updatedCurrentUser: UserProfile = {
          ...currentUser,
          following: isFollowing
            ? currentUser.following.filter((id) => id !== userId)
            : [...currentUser.following, userId],
        };

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
      },
    }),
    { name: 'hevydrinkr-auth' }
  )
);
