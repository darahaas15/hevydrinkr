'use client';

import { useEffect, useRef } from 'react';
import { useThemeStore } from '@/stores/use-theme-store';
import { LEGACY_EFFECTIVE_THEME_KEY, SYSTEM_SETTLE_MS, THEME_COLORS } from '@/lib/theme';

/**
 * Applies the saved theme: writes `data-theme` on <html> and keeps
 * `<meta name="theme-color">` in sync. The anti-FOUC `<head>` script already
 * painted the saved theme, so on mount this only reconciles the status-bar
 * tint. A later change (a switch in Settings, or the one-time pin below)
 * cross-fades.
 *
 * The phone's appearance is never followed (see SYSTEM_SETTLE_MS), except
 * once: a device that followed its phone before the System option was removed
 * gets its settled phone appearance saved as its choice.
 *
 * Mount once in the root layout; renders nothing.
 */
export function ThemeController() {
  const preference = useThemeStore((s) => s.preference);
  const pinPending = useThemeStore((s) => s.pinPending);
  const setPreference = useThemeStore((s) => s.setPreference);
  const mountedRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;

    // Reconcile the status-bar tint on every run, including first mount where
    // `data-theme` already matches - React 19 metadata hydration can restore
    // the SSR (dark) value, so the controller must own it unconditionally.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLORS[preference]);

    // The first run reconciles with the anti-FOUC script and must stay instant.
    const animate = mountedRef.current;
    mountedRef.current = true;
    if (root.getAttribute('data-theme') === preference) return;

    if (animate) {
      root.classList.add('theme-transition');
      window.setTimeout(() => root.classList.remove('theme-transition'), 320);
    }
    root.setAttribute('data-theme', preference);
  }, [preference]);

  useEffect(() => {
    if (!pinPending) {
      // Nothing reads the System-era cache once the device has a saved choice.
      try {
        window.localStorage.removeItem(LEGACY_EFFECTIVE_THEME_KEY);
      } catch {}
      return;
    }

    // Pin a device that followed its phone: save the phone's appearance once it
    // has held for SYSTEM_SETTLE_MS while the app is on screen, so the device
    // keeps the look it had. Any appearance change restarts the wait, and
    // hiding the app cancels it: iOS fakes the other appearance while the app
    // goes to the app switcher. A force-quit before this fires retries next launch.
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    let timer: number | undefined;
    let cancelled = false;
    const pin = async () => {
      // Another tab may have saved a choice since this one loaded; it wins.
      await useThemeStore.persist.rehydrate();
      if (cancelled || !useThemeStore.getState().pinPending) return;
      setPreference(mql.matches ? 'light' : 'dark');
    };
    const arm = () => {
      window.clearTimeout(timer);
      if (document.visibilityState === 'visible') timer = window.setTimeout(pin, SYSTEM_SETTLE_MS);
    };
    arm();
    document.addEventListener('visibilitychange', arm);
    mql.addEventListener('change', arm);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', arm);
      mql.removeEventListener('change', arm);
    };
  }, [pinPending, setPreference]);

  return null;
}
