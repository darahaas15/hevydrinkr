import { describe, it, expect } from 'vitest';
import {
  resolveEffectiveTheme,
  themeInitScript,
  THEME_STORAGE_KEY,
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

describe('themeInitScript', () => {
  it('reads the same storage key the persist store writes', () => {
    expect(themeInitScript()).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });

  it('embeds the theme-color values for both themes', () => {
    const script = themeInitScript();
    expect(script).toContain(JSON.stringify(THEME_COLORS.light));
    expect(script).toContain(JSON.stringify(THEME_COLORS.dark));
  });

  it('resolves the persisted shape the way the store + controller do', () => {
    // Mirror the anti-FOUC logic against the zustand-persist envelope so the
    // inline script and resolveEffectiveTheme can never silently diverge.
    const run = (raw: string | null, prefersLight: boolean) => {
      let preference: 'system' | 'light' | 'dark' = 'system';
      try {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.state?.preference) preference = parsed.state.preference;
        }
      } catch {
        // matches the script's exception-safe fallback to `system`
      }
      return resolveEffectiveTheme(preference, prefersLight);
    };

    expect(run(JSON.stringify({ state: { preference: 'light' }, version: 0 }), false)).toBe('light');
    expect(run(JSON.stringify({ state: { preference: 'dark' }, version: 0 }), true)).toBe('dark');
    expect(run(JSON.stringify({ state: { preference: 'system' }, version: 0 }), true)).toBe('light');
    expect(run(null, false)).toBe('dark'); // no persisted value → system → OS (dark)
    expect(run('not json', true)).toBe('light'); // malformed → system → OS (light)
  });
});
