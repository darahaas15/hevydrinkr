import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeJSONStorage } from '@/lib/storage/safe-storage';
import {
  DEFAULT_THEME,
  isTheme,
  LEGACY_EFFECTIVE_THEME_KEY,
  migrateThemeSettings,
  THEME_STORAGE_KEY,
  type Theme,
  type ThemeSettings,
} from '@/lib/theme';

interface ThemeState extends ThemeSettings {
  /** Saves the device's theme. Also ends a pending pin (see ThemeSettings). */
  setPreference: (preference: Theme) => void;
}

/** The theme the anti-FOUC script put on screen before this store loaded. */
function paintedTheme(): Theme {
  const painted = document.documentElement.getAttribute('data-theme');
  return isTheme(painted) ? painted : DEFAULT_THEME;
}

function hasLegacyCache(): boolean {
  try {
    return isTheme(window.localStorage.getItem(LEGACY_EFFECTIVE_THEME_KEY));
  } catch {
    return false;
  }
}

/**
 * Settings before anything saved is read. React also renders with these while
 * hydrating (they are zustand's server snapshot), so the preference must be
 * what is already on screen: otherwise ThemeController paints the default for
 * a moment and fades back to the saved theme.
 * With nothing saved, these are also the result, since zustand-persist skips
 * `migrate`. The anti-FOUC script painted the default, or what a device that
 * followed its phone last showed; the legacy cache marks the latter for
 * pinning. This matches `migrateThemeSettings(undefined, ...)`.
 */
function initialSettings(): ThemeSettings {
  if (typeof window === 'undefined') return { preference: DEFAULT_THEME, pinPending: false };
  return { preference: paintedTheme(), pinPending: hasLegacyCache() };
}

// Per-device (single key) - theme is a device choice, not account data, so it
// persists to localStorage via the shared safeJSONStorage pattern (no Supabase
// sync). The anti-FOUC script in the root layout reads this same key/shape.
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      ...initialSettings(),
      setPreference: (preference) => set({ preference, pinPending: false }),
    }),
    {
      name: THEME_STORAGE_KEY,
      storage: safeJSONStorage(),
      // Version 0 allowed preference 'system'; version 1 drops it.
      version: 1,
      migrate: (saved) =>
        migrateThemeSettings(
          (saved as { preference?: unknown } | null)?.preference,
          hasLegacyCache(),
          paintedTheme()
        ),
      // Saved settings that aren't valid (corrupted or hand-edited) are ignored,
      // like the anti-FOUC script ignores them, so the store keeps what it painted.
      merge: (saved, current) => {
        const s = saved as Partial<ThemeSettings> | undefined;
        if (!isTheme(s?.preference)) return current;
        return { ...current, preference: s.preference, pinPending: s.pinPending === true };
      },
      partialize: (s) => ({ preference: s.preference, pinPending: s.pinPending }),
    }
  )
);
