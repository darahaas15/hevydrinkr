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

/**
 * localStorage key caching the last *effective* theme this device resolved
 * (a plain 'light' | 'dark' string, written by ThemeController on every
 * apply). While preference is `system`, boot paints from this cache instead
 * of `matchMedia`: iOS home-screen PWAs report a wrong `prefers-color-scheme`
 * for the first moments after launch (it settles a beat later), which used to
 * flash the wrong theme on every cold start.
 */
export const THEME_EFFECTIVE_STORAGE_KEY = 'hd-theme-effective';

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
 * Resolve the theme to paint at boot, before the OS color-scheme can be
 * trusted. An explicit preference wins; `system` prefers the cached last
 * effective theme (see THEME_EFFECTIVE_STORAGE_KEY) and only falls back to
 * the live `matchMedia` value on a first-ever visit. ThemeController
 * reconciles with the real OS value once it has settled after launch.
 */
export function resolveBootTheme(
  preference: ThemePreference,
  cachedEffective: string | null,
  systemPrefersLight: boolean
): EffectiveTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  if (cachedEffective === 'light' || cachedEffective === 'dark') return cachedEffective;
  return systemPrefersLight ? 'light' : 'dark';
}

/**
 * Blocking inline script for the root layout `<head>`. Reads the persisted
 * preference, resolves it via `resolveBootTheme` (cached last effective theme
 * first, `matchMedia` as the first-visit fallback), and sets `data-theme` +
 * `<meta name="theme-color">` before first paint so there is no flash of the
 * wrong theme. Mirrors `resolveBootTheme` and the zustand-persist shape
 * (`{ state: { preference }, version }`). Self-contained and exception-safe.
 */
export function themeInitScript(): string {
  return (
    `(function(){try{` +
    `var k=${JSON.stringify(THEME_STORAGE_KEY)};` +
    `var p='system';var raw=localStorage.getItem(k);` +
    `if(raw){var s=JSON.parse(raw);if(s&&s.state&&s.state.preference){p=s.state.preference;}}` +
    `var t;` +
    `if(p==='light'||p==='dark'){t=p;}` +
    `else{var c=localStorage.getItem(${JSON.stringify(THEME_EFFECTIVE_STORAGE_KEY)});` +
    `t=(c==='light'||c==='dark')?c:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');}` +
    `var light=t==='light';` +
    `document.documentElement.setAttribute('data-theme',t);` +
    `var m=document.querySelector('meta[name="theme-color"]');` +
    `if(m){m.setAttribute('content',light?${JSON.stringify(
      THEME_COLORS.light
    )}:${JSON.stringify(THEME_COLORS.dark)});}` +
    `}catch(e){}})();`
  );
}
