import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeJSONStorage } from '@/lib/storage/safe-storage';
import { THEME_STORAGE_KEY, type ThemePreference } from '@/lib/theme';

interface ThemeState {
  /** User's appearance choice. `system` follows the OS via prefers-color-scheme. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

// Per-device (single key) — theme is a device choice, not account data, so it
// persists to localStorage via the shared safeJSONStorage pattern (no Supabase
// sync). The anti-FOUC script in the root layout reads this same key/shape.
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: THEME_STORAGE_KEY,
      storage: safeJSONStorage(),
      partialize: (s) => ({ preference: s.preference }),
    }
  )
);
