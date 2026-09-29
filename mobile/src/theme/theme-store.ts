import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeJSONStorage } from '@/lib/storage/safe-storage';

export type ThemePreference = 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

/**
 * The Light/Dark choice, device-local like the web app's (and, like it,
 * deliberately without a "System" option, so the app always opens in the
 * theme you picked). Defaults to Dark, the original look.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'dark',
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: 'hd-theme',
      version: 1,
      storage: safeJSONStorage(),
      partialize: (s) => ({ preference: s.preference }),
      // Drop anything but a valid choice, as the web store does.
      merge: (persisted, current) => {
        const preference = (persisted as { preference?: unknown } | undefined)?.preference;
        return preference === 'light' || preference === 'dark' ? { ...current, preference } : current;
      },
    },
  ),
);
