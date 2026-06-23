/**
 * Theme primitives shared by the zustand store, the anti-FOUC <head> script,
 * and the ThemeController. Theming is driven by a `data-theme` attribute on
 * <html> plus CSS custom properties (see src/app/globals.css and
 * AGENTS.md › Theming). Keep this file framework-agnostic — the anti-FOUC
 * script is serialized to a string and runs before React hydrates.
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';

/**
 * localStorage key for the persisted preference. Shared by `useThemeStore`
 * (its zustand-persist `name`) and the anti-FOUC script so they always agree.
 */
export const THEME_STORAGE_KEY = 'hd-theme';

/** `<meta name="theme-color">` content per effective theme (status-bar tint). */
export const THEME_COLORS: Record<EffectiveTheme, string> = {
  light: '#f6f7f9',
  dark: '#09090b',
};

/** Resolve a stored preference + the OS color-scheme into the theme to apply. */
export function resolveEffectiveTheme(
  preference: ThemePreference,
  systemPrefersLight: boolean
): EffectiveTheme {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return systemPrefersLight ? 'light' : 'dark';
}

/**
 * Blocking inline script for the root layout `<head>`. Reads the persisted
 * preference, resolves `system` via `matchMedia`, and sets `data-theme` +
 * `<meta name="theme-color">` before first paint so there is no flash of the
 * wrong theme. Mirrors `resolveEffectiveTheme` and the zustand-persist shape
 * (`{ state: { preference }, version }`). Self-contained and exception-safe.
 */
export function themeInitScript(): string {
  return (
    `(function(){try{` +
    `var k=${JSON.stringify(THEME_STORAGE_KEY)};` +
    `var p='system';var raw=localStorage.getItem(k);` +
    `if(raw){var s=JSON.parse(raw);if(s&&s.state&&s.state.preference){p=s.state.preference;}}` +
    `var light=p==='light'||(p!=='dark'&&window.matchMedia('(prefers-color-scheme: light)').matches);` +
    `var t=light?'light':'dark';` +
    `document.documentElement.setAttribute('data-theme',t);` +
    `var m=document.querySelector('meta[name="theme-color"]');` +
    `if(m){m.setAttribute('content',light?${JSON.stringify(
      THEME_COLORS.light
    )}:${JSON.stringify(THEME_COLORS.dark)});}` +
    `}catch(e){}})();`
  );
}
