'use client';

import { useEffect, useRef } from 'react';
import { useThemeStore } from '@/stores/use-theme-store';
import {
  resolveEffectiveTheme,
  THEME_COLORS,
  THEME_EFFECTIVE_STORAGE_KEY,
  type EffectiveTheme,
} from '@/lib/theme';

// iOS home-screen PWAs report a wrong `prefers-color-scheme` for the first
// moments after launch (WebKit updates it to the real OS value a beat later,
// firing a `change` event). Until this settle window has passed, the live
// matchMedia value must not overrule the theme the anti-FOUC script painted
// from the on-device cache.
const SYSTEM_SETTLE_MS = 2000;

/**
 * Resolves the user's preference into an effective `light|dark` theme, writes
 * it to `data-theme` on <html>, keeps `<meta name="theme-color">` in sync, and
 * caches the resolved theme (THEME_EFFECTIVE_STORAGE_KEY) so the anti-FOUC
 * script can boot from it. While `preference === 'system'` it tracks the OS
 * color-scheme live.
 *
 * The anti-FOUC `<head>` script already sets the boot theme before paint, so
 * on first mount this keeps what was painted (the OS value can't be trusted
 * yet at launch - see SYSTEM_SETTLE_MS) and reconciles with the settled OS
 * value afterwards. It only animates a cross-fade for a *real* change after
 * mount - a manual switch or an OS theme change the user is watching - never
 * on initial load. Mount once in the root layout; renders nothing.
 */
export function ThemeController() {
  const preference = useThemeStore((s) => s.preference);
  const mountedRef = useRef(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: light)');

    const apply = (effective: EffectiveTheme, animate: boolean) => {
      const root = document.documentElement;

      // Reconcile the status-bar tint on every call, including first mount where
      // `data-theme` already matches — React 19 metadata hydration can restore
      // the SSR (dark) value, so the controller must own it unconditionally.
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', THEME_COLORS[effective]);

      // Cache the resolved theme for the anti-FOUC boot path. Best-effort:
      // without it, boot falls back to matchMedia like a first visit.
      try {
        window.localStorage.setItem(THEME_EFFECTIVE_STORAGE_KEY, effective);
      } catch {}

      if (root.getAttribute('data-theme') === effective) return;

      if (animate) {
        root.classList.add('theme-transition');
        window.setTimeout(() => root.classList.remove('theme-transition'), 320);
      }
      root.setAttribute('data-theme', effective);
    };

    const fromSystem = () => resolveEffectiveTheme(preference, mql.matches);

    let settleTimer: number | undefined;
    if (!mountedRef.current) {
      mountedRef.current = true;
      if (preference === 'system') {
        // Keep whatever the anti-FOUC script painted (the cached last effective
        // theme); trusting mql here would repaint the not-yet-settled OS value.
        // If the OS theme genuinely changed while the app was closed, the
        // post-settle reconcile below cross-fades to it.
        const boot: EffectiveTheme =
          document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        apply(boot, false);
        settleTimer = window.setTimeout(() => apply(fromSystem(), true), SYSTEM_SETTLE_MS);
      } else {
        apply(preference, false);
      }
    } else {
      // Preference changed after mount - a manual switch the user is watching.
      apply(fromSystem(), true);
    }

    // OS changes while on `system` always animate — the user is looking at it.
    const onSystemChange = () => apply(fromSystem(), true);
    mql.addEventListener('change', onSystemChange);
    return () => {
      mql.removeEventListener('change', onSystemChange);
      if (settleTimer !== undefined) window.clearTimeout(settleTimer);
    };
  }, [preference]);

  return null;
}
