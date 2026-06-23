'use client';

import { useEffect, useRef } from 'react';
import { useThemeStore } from '@/stores/use-theme-store';
import { resolveEffectiveTheme, THEME_COLORS } from '@/lib/theme';

/**
 * Resolves the user's preference into an effective `light|dark` theme, writes
 * it to `data-theme` on <html>, and keeps `<meta name="theme-color">` in sync.
 * While `preference === 'system'` it tracks the OS color-scheme live.
 *
 * The anti-FOUC `<head>` script already sets the correct theme before paint, so
 * on first mount this is usually a no-op (no flash). It only animates a
 * cross-fade for a *real* change after mount — a manual switch or an OS theme
 * change the user is watching — never on initial load. Mount once in the root
 * layout; renders nothing.
 */
export function ThemeController() {
  const preference = useThemeStore((s) => s.preference);
  const mountedRef = useRef(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: light)');

    const apply = (animate: boolean) => {
      const root = document.documentElement;
      const effective = resolveEffectiveTheme(preference, mql.matches);
      if (root.getAttribute('data-theme') === effective) return;

      if (animate) {
        root.classList.add('theme-transition');
        window.setTimeout(() => root.classList.remove('theme-transition'), 320);
      }
      root.setAttribute('data-theme', effective);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', THEME_COLORS[effective]);
    };

    // Animate only when this run is a preference change (already mounted) — the
    // very first run reconciles with the anti-FOUC script and must stay instant.
    apply(mountedRef.current);
    mountedRef.current = true;

    // OS changes while on `system` always animate — the user is looking at it.
    const onSystemChange = () => apply(true);
    mql.addEventListener('change', onSystemChange);
    return () => mql.removeEventListener('change', onSystemChange);
  }, [preference]);

  return null;
}
