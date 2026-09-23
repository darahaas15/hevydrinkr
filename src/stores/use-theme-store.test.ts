import { describe, it, expect, afterEach, vi } from 'vitest';
import { LEGACY_EFFECTIVE_THEME_KEY, THEME_STORAGE_KEY } from '@/lib/theme';

/**
 * Loads a fresh store against a stubbed browser: `stored` is localStorage as
 * the device left it, `painted` is what the anti-FOUC script put on <html>.
 * The store reads both while it is created, so each case re-imports it.
 */
async function loadStore(stored: Record<string, string>, painted: 'light' | 'dark') {
  const storage = new Map(Object.entries(stored));
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, String(v)),
      removeItem: (k: string) => void storage.delete(k),
    },
  });
  vi.stubGlobal('document', {
    documentElement: { getAttribute: (name: string) => (name === 'data-theme' ? painted : null) },
  });
  vi.resetModules();
  const { useThemeStore } = await import('./use-theme-store');
  const saved = () => {
    const raw = storage.get(THEME_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  };
  const settings = () => {
    const { preference, pinPending } = useThemeStore.getState();
    return { preference, pinPending };
  };
  return { useThemeStore, saved, settings };
}

const v0 = (preference: string) => JSON.stringify({ state: { preference }, version: 0 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useThemeStore after the System option was removed', () => {
  it('opens a fresh device in Dark without saving anything', async () => {
    const { settings, saved } = await loadStore({}, 'dark');
    expect(settings()).toEqual({ preference: 'dark', pinPending: false });
    expect(saved()).toBeNull();
  });

  it('keeps an untouched System-era device on its current look until it is pinned', async () => {
    const { settings, saved } = await loadStore({ [LEGACY_EFFECTIVE_THEME_KEY]: 'light' }, 'light');
    expect(settings()).toEqual({ preference: 'light', pinPending: true });
    // Nothing saved yet, so a force-quit before the pin retries it next launch.
    expect(saved()).toBeNull();
  });

  it('converts a saved System choice to the look on screen and marks it for pinning', async () => {
    const { settings, saved } = await loadStore(
      { [THEME_STORAGE_KEY]: v0('system'), [LEGACY_EFFECTIVE_THEME_KEY]: 'dark' },
      'dark'
    );
    expect(settings()).toEqual({ preference: 'dark', pinPending: true });
    expect(saved()).toEqual({ state: { preference: 'dark', pinPending: true }, version: 1 });
  });

  it('keeps a saved Light or Dark choice through the upgrade', async () => {
    const light = await loadStore({ [THEME_STORAGE_KEY]: v0('light'), [LEGACY_EFFECTIVE_THEME_KEY]: 'light' }, 'light');
    expect(light.settings()).toEqual({ preference: 'light', pinPending: false });
    expect(light.saved()).toEqual({ state: { preference: 'light', pinPending: false }, version: 1 });

    const dark = await loadStore({ [THEME_STORAGE_KEY]: v0('dark') }, 'dark');
    expect(dark.settings()).toEqual({ preference: 'dark', pinPending: false });
  });

  it('reads current settings as they are', async () => {
    const stored = JSON.stringify({ state: { preference: 'light', pinPending: false }, version: 1 });
    // A stale System-era cache must not matter once a choice is saved.
    const { settings } = await loadStore({ [THEME_STORAGE_KEY]: stored, [LEGACY_EFFECTIVE_THEME_KEY]: 'dark' }, 'light');
    expect(settings()).toEqual({ preference: 'light', pinPending: false });
  });

  it('ignores invalid saved settings and keeps what is on screen', async () => {
    const bogus = JSON.stringify({ state: { preference: 'blue', pinPending: 'yes' }, version: 1 });
    // The anti-FOUC script ignores an invalid preference and paints the default.
    const { settings } = await loadStore({ [THEME_STORAGE_KEY]: bogus }, 'dark');
    expect(settings()).toEqual({ preference: 'dark', pinPending: false });
  });

  it('hydrates React with the theme already on screen', async () => {
    // React renders with getInitialState() while hydrating. If it disagreed with
    // the saved theme, the controller would flash the default and fade back.
    const stored = JSON.stringify({ state: { preference: 'light', pinPending: false }, version: 1 });
    const { useThemeStore } = await loadStore({ [THEME_STORAGE_KEY]: stored }, 'light');
    expect(useThemeStore.getInitialState().preference).toBe('light');
    expect(useThemeStore.getState().preference).toBe('light');
  });

  it('saves a chosen theme and ends a pending pin', async () => {
    const { useThemeStore, settings, saved } = await loadStore({ [LEGACY_EFFECTIVE_THEME_KEY]: 'light' }, 'light');
    useThemeStore.getState().setPreference('dark');
    expect(settings()).toEqual({ preference: 'dark', pinPending: false });
    expect(saved()).toEqual({ state: { preference: 'dark', pinPending: false }, version: 1 });
  });
});
