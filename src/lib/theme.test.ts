import { describe, it, expect } from 'vitest';
import {
  DEFAULT_THEME,
  LEGACY_EFFECTIVE_THEME_KEY,
  migrateThemeSettings,
  resolveBootTheme,
  themeInitScript,
  THEME_COLORS,
  THEME_STORAGE_KEY,
} from './theme';

describe('migrateThemeSettings', () => {
  it('keeps a saved Light or Dark choice', () => {
    expect(migrateThemeSettings('light', true, 'dark')).toEqual({ preference: 'light', pinPending: false });
    expect(migrateThemeSettings('dark', false, 'light')).toEqual({ preference: 'dark', pinPending: false });
  });

  it('keeps what is on screen for a device that followed its phone, until it is pinned', () => {
    // Chose System explicitly.
    expect(migrateThemeSettings('system', false, 'light')).toEqual({ preference: 'light', pinPending: true });
    // Never touched the setting (System was the default) but ran the System-era app.
    expect(migrateThemeSettings(undefined, true, 'light')).toEqual({ preference: 'light', pinPending: true });
    expect(migrateThemeSettings(undefined, true, 'dark')).toEqual({ preference: 'dark', pinPending: true });
  });

  it('gives a fresh device the default', () => {
    expect(DEFAULT_THEME).toBe('dark');
    expect(migrateThemeSettings(undefined, false, 'light')).toEqual({ preference: 'dark', pinPending: false });
    expect(migrateThemeSettings('bogus', false, 'light')).toEqual({ preference: 'dark', pinPending: false });
  });
});

describe('resolveBootTheme', () => {
  it('paints a saved choice regardless of anything else', () => {
    expect(resolveBootTheme('light', 'dark', false)).toBe('light');
    expect(resolveBootTheme('dark', 'light', true)).toBe('dark');
  });

  it('never asks the phone once the device has a saved choice', () => {
    for (const prefersLight of [true, false]) {
      expect(resolveBootTheme('dark', null, prefersLight)).toBe('dark');
      expect(resolveBootTheme('light', null, prefersLight)).toBe('light');
    }
  });

  it('repaints what an unpinned phone-following device last showed', () => {
    expect(resolveBootTheme('system', 'dark', true)).toBe('dark');
    expect(resolveBootTheme(undefined, 'light', false)).toBe('light');
  });

  it('asks the phone only for a System choice with nothing recorded', () => {
    expect(resolveBootTheme('system', null, true)).toBe('light');
    expect(resolveBootTheme('system', null, false)).toBe('dark');
  });

  it('paints the default for a fresh device, even on a light phone', () => {
    expect(resolveBootTheme(undefined, null, true)).toBe('dark');
    expect(resolveBootTheme('bogus', 'bogus', true)).toBe('dark');
  });
});

describe('themeInitScript', () => {
  /** Executes the real inline script against stubbed browser globals. */
  const runScript = (stored: Record<string, string | null>, prefersLight: boolean, opts: { throws?: boolean } = {}) => {
    const attrs: Record<string, string> = {};
    const meta = { content: '', setAttribute: (_: string, v: string) => void (meta.content = v) };
    const keysRead: string[] = [];
    new Function('localStorage', 'window', 'document', themeInitScript())(
      {
        getItem: (k: string) => {
          keysRead.push(k);
          if (opts.throws) throw new Error('SecurityError');
          return stored[k] ?? null;
        },
      },
      { matchMedia: (q: string) => ({ matches: q.includes('light') === prefersLight }) },
      {
        documentElement: { setAttribute: (k: string, v: string) => void (attrs[k] = v) },
        querySelector: () => meta,
      }
    );
    return { theme: attrs['data-theme'], themeColor: meta.content, keysRead };
  };
  const envelope = (state: Record<string, unknown>, version = 1) => JSON.stringify({ state, version });

  it('reads the keys the store and the System-era controller wrote, and tints the status bar to match', () => {
    const out = runScript({ [THEME_STORAGE_KEY]: envelope({ preference: 'light', pinPending: false }) }, false);
    expect(out.keysRead).toEqual([THEME_STORAGE_KEY, LEGACY_EFFECTIVE_THEME_KEY]);
    expect(out).toMatchObject({ theme: 'light', themeColor: THEME_COLORS.light });
    expect(runScript({}, true)).toMatchObject({ theme: 'dark', themeColor: THEME_COLORS.dark });
  });

  it('agrees with resolveBootTheme for every saved state and phone answer', () => {
    const saved = [undefined, 'system', 'light', 'dark', 'bogus'];
    const legacy = [null, 'light', 'dark', 'bogus'];
    for (const preference of saved) {
      for (const cache of legacy) {
        for (const prefersLight of [true, false]) {
          for (const version of [0, 1]) {
            const stored = {
              [THEME_STORAGE_KEY]: preference === undefined ? null : envelope({ preference }, version),
              [LEGACY_EFFECTIVE_THEME_KEY]: cache,
            };
            expect(runScript(stored, prefersLight).theme, JSON.stringify({ stored, prefersLight })).toBe(
              resolveBootTheme(preference, cache, prefersLight)
            );
          }
        }
      }
    }
  });

  it('treats unreadable or malformed storage as absent', () => {
    expect(runScript({}, true, { throws: true }).theme).toBe('dark');
    expect(runScript({ [THEME_STORAGE_KEY]: 'not json' }, true).theme).toBe('dark');
    // A malformed settings entry still lets an unpinned device repaint what it last showed.
    expect(runScript({ [THEME_STORAGE_KEY]: 'not json', [LEGACY_EFFECTIVE_THEME_KEY]: 'light' }, false).theme).toBe(
      resolveBootTheme(undefined, 'light', false)
    );
  });
});
