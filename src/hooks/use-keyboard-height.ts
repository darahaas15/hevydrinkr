'use client';

import { useEffect } from 'react';

/**
 * Tracks the on-screen keyboard height and exposes it as the
 * `--keyboard-height` CSS custom property on `:root`.
 *
 * Uses the `visualViewport` API. With the viewport meta
 * `interactive-widget=resizes-content`, the layout viewport shrinks
 * when the keyboard opens, so `position: fixed; bottom: 0` and
 * `100dvh` follow the keyboard natively.
 *
 * Call this hook exactly once near the root of the app.
 */
export function useKeyboardHeight() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const setHeight = (h: number) => {
      root.style.setProperty('--keyboard-height', `${Math.max(0, Math.round(h))}px`);
    };
    setHeight(0);

    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const h = window.innerHeight - vv.height - vv.offsetTop;
      setHeight(h);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setHeight(0);
    };
  }, []);
}
