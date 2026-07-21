import { describe, it, expect } from 'vitest';
import {
  resolveBootTheme,
  resolveEffectiveTheme,
  themeInitScript,
  THEME_STORAGE_KEY,
  THEME_EFFECTIVE_STORAGE_KEY,
  THEME_COLORS,
} from './theme';

describe('resolveEffectiveTheme', () => {
  it('honors an explicit light/dark preference regardless of the OS', () => {
    expect(resolveEffectiveTheme('light', false)).toBe('light');
    expect(resolveEffectiveTheme('light', true)).toBe('light');
    expect(resolveEffectiveTheme('dark', true)).toBe('dark');
    expect(resolveEffectiveTheme('dark', false)).toBe('dark');
  });

  it('follows the OS color-scheme when preference is system', () => {
    expect(resolveEffectiveTheme('system', true)).toBe('light');
    expect(resolveEffectiveTheme('system', false)).toBe('dark');
  });
});

describe('resolveBootTheme', () => {
  it('honors an explicit preference over both the cache and the OS', () => {
    expect(resolveBootTheme('dark', 'light', true)).toBe('dark');
    expect(resolveBootTheme('light', 'dark', false)).toBe('light');
  });

  it('prefers the cached effective theme over the OS while on system', () => {
    // The OS value cannot be trusted at launch (iOS PWA quirk) - the cache
    // must win even when matchMedia disagrees.
    expect(resolveBootTheme('system', 'dark', true)).toBe('dark');
    expect(resolveBootTheme('system', 'light', false)).toBe('light');
  });

  it('falls back to the OS when the cache is missing or garbage', () => {
    expect(resolveBootTheme('system', null, false)).toBe('dark');
    expect(resolveBootTheme('system', null, true)).toBe('light');
    expect(resolveBootTheme('system', 'nonsense', false)).toBe('dark');
  });
});

describe('themeInitScript', () => {
  it('reads the same storage key the persist store writes', () => {
    expect(themeInitScript()).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });

  it('reads the effective-theme cache the ThemeController writes', () => {
    expect(themeInitScript()).toContain(JSON.stringify(THEME_EFFECTIVE_STORAGE_KEY));
  });

  it('embeds the theme-color values for both themes', () => {
    const script = themeInitScript();
    expect(script).toContain(JSON.stringify(THEME_COLORS.light));
    expect(script).toContain(JSON.stringify(THEME_COLORS.dark));
  });

  it('resolves the persisted shape the way the store + controller do', () => {
    // Mirror the anti-FOUC logic against the zustand-persist envelope so the
    // inline script and resolveBootTheme can never silently diverge.
    const run = (raw: string | null, cached: string | null, prefersLight: boolean) => {
      let preference: 'system' | 'light' | 'dark' = 'system';
      try {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.state?.preference) preference = parsed.state.preference;
        }
      } catch {
        // matches the script's exception-safe fallback to `system`
      }
      return resolveBootTheme(preference, cached, prefersLight);
    };

    expect(run(JSON.stringify({ state: { preference: 'light' }, version: 0 }), 'dark', false)).toBe('light');
    expect(run(JSON.stringify({ state: { preference: 'dark' }, version: 0 }), 'light', true)).toBe('dark');
    // system + cache: the cache wins over a disagreeing (untrustworthy) OS value
    expect(run(JSON.stringify({ state: { preference: 'system' }, version: 0 }), 'dark', true)).toBe('dark');
    expect(run(JSON.stringify({ state: { preference: 'system' }, version: 0 }), null, true)).toBe('light');
    expect(run(null, null, false)).toBe('dark'); // first visit → system → OS (dark)
    expect(run('not json', null, true)).toBe('light'); // malformed → system → OS (light)
  });
});
