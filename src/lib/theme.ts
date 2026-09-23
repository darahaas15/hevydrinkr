/**
 * Theme primitives shared by the zustand store, the anti-FOUC <head> script,
 * and the ThemeController. Theming is driven by a `data-theme` attribute on
 * <html> plus CSS custom properties (see src/app/globals.css and
 * AGENTS.md › Theming). Keep this file framework-agnostic - the anti-FOUC
 * script is serialized to a string and runs before React hydrates.
 */

/**
 * The two themes. There is deliberately no "follow the phone" option: see
 * SYSTEM_SETTLE_MS for why the phone's appearance can't be trusted.
 */
export type Theme = 'light' | 'dark';

/** Theme for a device with no saved choice. Dark is the app's original look. */
export const DEFAULT_THEME: Theme = 'dark';

/**
 * localStorage key for the persisted theme settings. Shared by `useThemeStore`
 * (its zustand-persist `name`) and the anti-FOUC script so they always agree.
 */
export const THEME_STORAGE_KEY = 'hd-theme';

/**
 * Last applied theme, written by the ThemeController while the app still had
 * a System option. Only read now to recognise a device that followed its
 * phone without ever saving a choice, and deleted once that device is pinned.
 */
export const LEGACY_EFFECTIVE_THEME_KEY = 'hd-theme-effective';

/**
 * How long after launch the phone's appearance is trusted. Used only to pin a
 * device that followed its phone before the System option was removed.
 * iOS home-screen apps report the appearance wrong for the first moments after
 * launch, and fake a light/dark switch while the app goes to the app switcher
 * (to snapshot it in both looks). Following those reports opened the app in
 * the wrong theme and faded it over after a force-quit, which is why System
 * was removed.
 */
export const SYSTEM_SETTLE_MS = 2000;

/** `<meta name="theme-color">` content per theme (status-bar tint). */
export const THEME_COLORS: Record<Theme, string> = {
  light: '#f6f7f9',
  dark: '#09090b',
};

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** Persisted theme settings: the `hd-theme` zustand state, version 1. */
export interface ThemeSettings {
  preference: Theme;
  /**
   * The device followed its phone's appearance before System was removed and
   * has not been pinned yet. ThemeController saves the settled phone
   * appearance as its choice, once, then clears this.
   */
  pinPending: boolean;
}

/**
 * Converts theme settings saved before the System option was removed
 * (`hd-theme` version 0, or nothing saved) into version-1 settings.
 * A saved Light/Dark choice is kept. A device that followed its phone (it
 * saved 'system', or saved nothing but ran the System-era app) keeps the
 * theme on screen until its phone's appearance is pinned. Anything else gets
 * the default.
 *
 * @param savedPreference version-0 `preference`, or undefined if nothing was saved
 * @param hasLegacyCache whether LEGACY_EFFECTIVE_THEME_KEY holds a theme
 * @param painted the theme the anti-FOUC script put on screen
 */
export function migrateThemeSettings(
  savedPreference: unknown,
  hasLegacyCache: boolean,
  painted: Theme
): ThemeSettings {
  if (isTheme(savedPreference)) return { preference: savedPreference, pinPending: false };
  if (savedPreference === 'system' || hasLegacyCache) return { preference: painted, pinPending: true };
  return { preference: DEFAULT_THEME, pinPending: false };
}

/**
 * Theme to paint before first paint. A saved choice wins. A device that
 * followed its phone and hasn't been pinned yet repaints what it last showed,
 * or asks the phone if it never recorded that. Everything else gets the
 * default. Mirrored verbatim by `themeInitScript`.
 *
 * @param savedPreference `state.preference` from `hd-theme`, any version
 * @param legacyCache value of LEGACY_EFFECTIVE_THEME_KEY
 */
export function resolveBootTheme(
  savedPreference: unknown,
  legacyCache: unknown,
  systemPrefersLight: boolean
): Theme {
  if (isTheme(savedPreference)) return savedPreference;
  if (isTheme(legacyCache)) return legacyCache;
  if (savedPreference === 'system') return systemPrefersLight ? 'light' : 'dark';
  return DEFAULT_THEME;
}

/**
 * Blocking inline script for the root layout `<head>`. Resolves the theme per
 * `resolveBootTheme` from the persisted zustand envelope
 * (`{ state: { preference, pinPending }, version }`) and the legacy cache, and
 * sets `data-theme` + `<meta name="theme-color">` before first paint so there
 * is no flash of the wrong theme. Self-contained and exception-safe: storage
 * that can't be read or parsed is treated as absent.
 */
export function themeInitScript(): string {
  return (
    `(function(){try{` +
    `var t=${JSON.stringify(DEFAULT_THEME)},p,c;` +
    `try{var raw=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});` +
    `if(raw){var s=JSON.parse(raw).state;if(s){p=s.preference;}}}catch(e){}` +
    `try{c=localStorage.getItem(${JSON.stringify(LEGACY_EFFECTIVE_THEME_KEY)});}catch(e){}` +
    `if(p==='light'||p==='dark'){t=p;}` +
    `else if(c==='light'||c==='dark'){t=c;}` +
    `else if(p==='system'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}` +
    `document.documentElement.setAttribute('data-theme',t);` +
    `var m=document.querySelector('meta[name="theme-color"]');` +
    `if(m){m.setAttribute('content',t==='light'?${JSON.stringify(
      THEME_COLORS.light
    )}:${JSON.stringify(THEME_COLORS.dark)});}` +
    `}catch(e){}})();`
  );
}
