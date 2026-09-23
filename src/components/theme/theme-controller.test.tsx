// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement, StrictMode } from 'react';
import { LEGACY_EFFECTIVE_THEME_KEY, THEME_COLORS, THEME_STORAGE_KEY, themeInitScript, type Theme } from '@/lib/theme';

const v0 = (preference: string) => JSON.stringify({ state: { preference }, version: 0 });
const v1 = (preference: string, pinPending = false) => JSON.stringify({ state: { preference, pinPending }, version: 1 });

const cleanups: Array<() => unknown> = [];

/**
 * Launches the app the way a browser does: the real anti-FOUC script paints
 * from localStorage, then ThemeController hydrates (React first renders with
 * zustand's initial state). Records every later `data-theme` write and fade.
 */
async function launch(
  stored: Record<string, string>,
  phone: Theme,
  opts: { strict?: boolean; bootScript?: boolean } = {}
) {
  vi.useFakeTimers();
  localStorage.clear();
  for (const [k, v] of Object.entries(stored)) localStorage.setItem(k, v);
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  document.head.innerHTML = `<meta name="theme-color" content="${THEME_COLORS.dark}">`;

  let phoneLook = phone;
  const listeners = new Set<() => void>();
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query.includes('light') === (phoneLook === 'light');
    },
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  })) as unknown as typeof window.matchMedia;
  let visibility: DocumentVisibilityState = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });

  if (opts.bootScript !== false) new Function(themeInitScript())();
  const painted = root.getAttribute('data-theme');

  const writes: string[] = [];
  let fades = 0;
  const setAttribute = root.setAttribute.bind(root);
  root.setAttribute = (name: string, value: string) => {
    if (name === 'data-theme') writes.push(value);
    setAttribute(name, value);
  };
  const addClass = root.classList.add.bind(root.classList);
  root.classList.add = (...tokens: string[]) => {
    if (tokens.includes('theme-transition')) fades++;
    addClass(...tokens);
  };

  vi.resetModules();
  const { act } = await import('react');
  const { hydrateRoot } = await import('react-dom/client');
  const { useThemeStore } = await import('@/stores/use-theme-store');
  const { ThemeController } = await import('./theme-controller');

  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.body.appendChild(document.createElement('div'));
  const element = createElement(ThemeController);
  let reactRoot: ReturnType<typeof hydrateRoot> | undefined;
  await act(async () => {
    reactRoot = hydrateRoot(container, opts.strict ? createElement(StrictMode, null, element) : element);
  });
  cleanups.push(() => act(() => reactRoot?.unmount()));

  const saved = () => {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw ? JSON.parse(raw).state : null;
  };
  return {
    painted,
    writes,
    fades: () => fades,
    useThemeStore,
    act,
    saved,
    legacy: () => localStorage.getItem(LEGACY_EFFECTIVE_THEME_KEY),
    theme: () => root.getAttribute('data-theme'),
    themeColor: () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    wait: (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms)),
    setPhone: (look: Theme) =>
      act(async () => {
        phoneLook = look;
        listeners.forEach((cb) => cb());
      }),
    setVisible: (visible: boolean) =>
      act(async () => {
        visibility = visible ? 'visible' : 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));
      }),
  };
}

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  const root = document.documentElement as unknown as Record<string, unknown>;
  delete root.setAttribute;
  delete (document.documentElement.classList as unknown as Record<string, unknown>).add;
  delete (document as unknown as Record<string, unknown>).visibilityState;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('ThemeController', () => {
  it('hydrates onto the boot paint without repainting it, for every saved state', async () => {
    const states: Record<string, string>[] = [
      {},
      { [THEME_STORAGE_KEY]: v1('light') },
      { [THEME_STORAGE_KEY]: v1('dark') },
      { [THEME_STORAGE_KEY]: v1('light', true) },
      { [THEME_STORAGE_KEY]: v1('blue') },
      { [THEME_STORAGE_KEY]: v0('light'), [LEGACY_EFFECTIVE_THEME_KEY]: 'dark' },
      { [THEME_STORAGE_KEY]: v0('dark') },
      { [THEME_STORAGE_KEY]: v0('system'), [LEGACY_EFFECTIVE_THEME_KEY]: 'light' },
      { [THEME_STORAGE_KEY]: v0('system') },
      { [LEGACY_EFFECTIVE_THEME_KEY]: 'light' },
      { [THEME_STORAGE_KEY]: 'not json', [LEGACY_EFFECTIVE_THEME_KEY]: 'dark' },
    ];
    for (const stored of states) {
      for (const phone of ['light', 'dark'] as const) {
        const app = await launch(stored, phone);
        const label = JSON.stringify({ stored, phone });
        expect(app.writes, label).toEqual([]);
        expect(app.useThemeStore.getState().preference, label).toBe(app.painted);
        expect(app.themeColor(), label).toBe(THEME_COLORS[app.painted as Theme]);
        for (const cleanup of cleanups.splice(0)) await cleanup();
      }
    }
  });

  it('keeps a saved choice whatever the phone does', async () => {
    const app = await launch({ [THEME_STORAGE_KEY]: v1('light') }, 'dark');
    await app.setPhone('light');
    await app.setPhone('dark');
    await app.wait(10_000);
    expect(app.writes).toEqual([]);
    expect(app.fades()).toBe(0);
    expect(app.saved()).toEqual({ preference: 'light', pinPending: false });
  });

  it('opens a fresh device in Dark on a light phone and saves nothing', async () => {
    const app = await launch({}, 'light');
    await app.wait(10_000);
    expect(app.painted).toBe('dark');
    expect(app.writes).toEqual([]);
    expect(app.saved()).toBeNull();
  });

  it('pins a device that followed its phone to the settled look, once', async () => {
    // The old bug left 'light' saved as the last look on a dark phone.
    const app = await launch({ [LEGACY_EFFECTIVE_THEME_KEY]: 'light' }, 'dark');
    expect(app.painted).toBe('light');
    await app.wait(1999);
    expect(app.writes).toEqual([]);
    await app.wait(1);
    expect(app.writes).toEqual(['dark']);
    expect(app.fades()).toBe(1);
    expect(app.saved()).toEqual({ preference: 'dark', pinPending: false });
    expect(app.legacy()).toBeNull();
    await app.wait(10_000);
    expect(app.writes).toEqual(['dark']);
  });

  it('pins only a look that has held for the whole wait', async () => {
    const app = await launch({ [LEGACY_EFFECTIVE_THEME_KEY]: 'dark' }, 'dark');
    await app.wait(1900);
    await app.setPhone('light'); // a fake switch just before the wait ends
    await app.wait(150);
    expect(app.saved()).toBeNull();
    await app.setPhone('dark');
    await app.wait(1999);
    expect(app.saved()).toBeNull();
    await app.wait(1);
    expect(app.saved()).toEqual({ preference: 'dark', pinPending: false });
    expect(app.writes).toEqual([]);
  });

  it('never pins while the app is hidden, and waits again once it is back', async () => {
    const app = await launch({ [LEGACY_EFFECTIVE_THEME_KEY]: 'dark' }, 'dark');
    await app.wait(500);
    await app.setVisible(false);
    await app.setPhone('light'); // iOS snapshots the app switcher in the other look
    await app.wait(10_000);
    expect(app.saved()).toBeNull();
    await app.setPhone('dark');
    await app.setVisible(true);
    await app.wait(1999);
    expect(app.saved()).toBeNull();
    await app.wait(1);
    expect(app.saved()).toEqual({ preference: 'dark', pinPending: false });
    expect(app.writes).toEqual([]);
  });

  it('keeps a choice made in Settings during the wait', async () => {
    const app = await launch({ [LEGACY_EFFECTIVE_THEME_KEY]: 'dark' }, 'dark');
    await app.wait(1000);
    await app.act(async () => app.useThemeStore.getState().setPreference('light'));
    await app.wait(10_000);
    expect(app.writes).toEqual(['light']);
    expect(app.fades()).toBe(1);
    expect(app.saved()).toEqual({ preference: 'light', pinPending: false });
    expect(app.legacy()).toBeNull();
  });

  it('lets a choice saved by another tab win over the pin', async () => {
    const app = await launch({ [LEGACY_EFFECTIVE_THEME_KEY]: 'dark' }, 'dark');
    await app.wait(1000);
    localStorage.setItem(THEME_STORAGE_KEY, v1('light'));
    await app.wait(1000);
    expect(app.saved()).toEqual({ preference: 'light', pinPending: false });
    expect(app.theme()).toBe('light');
    expect(app.writes).toEqual(['light']);
  });

  it('drops the System-era cache for a device that already had a choice', async () => {
    const app = await launch({ [THEME_STORAGE_KEY]: v0('light'), [LEGACY_EFFECTIVE_THEME_KEY]: 'dark' }, 'dark');
    await app.wait(10_000);
    expect(app.writes).toEqual([]);
    expect(app.saved()).toEqual({ preference: 'light', pinPending: false });
    expect(app.legacy()).toBeNull();
  });

  it('paints instantly, without a fade, if the boot script never ran', async () => {
    const app = await launch({}, 'dark', { bootScript: false });
    expect(app.painted).toBeNull();
    expect(app.writes).toEqual(['dark']);
    expect(app.fades()).toBe(0);
  });

  it('pins once under StrictMode', async () => {
    const app = await launch({ [LEGACY_EFFECTIVE_THEME_KEY]: 'light' }, 'dark', { strict: true });
    await app.wait(10_000);
    expect(app.writes).toEqual(['dark']);
    expect(app.fades()).toBe(1);
  });
});
