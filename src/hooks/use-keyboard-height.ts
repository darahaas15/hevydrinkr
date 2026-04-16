'use client';

import { useEffect } from 'react';

/**
 * Tracks the visual viewport so fixed bottom bars can stay attached to
 * the visible area when the on-screen keyboard opens.
 *
 * `interactive-widget=resizes-content` helps on supporting browsers, but
 * PWAs and some mobile browsers still report keyboard movement only via
 * `window.visualViewport`. We keep a CSS class for safe-area padding and
 * expose the current bottom inset as a CSS variable.
 *
 * Call this hook exactly once near the root of the app.
 */
export function useKeyboardHeight() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const vv = window.visualViewport;
    if (!vv) return;

    let baselineVisibleBottom = Math.max(window.innerHeight, vv.offsetTop + vv.height);
    let lastViewportWidth = vv.width;
    let raf = 0;

    const update = () => {
      raf = 0;

      const layoutHeight = window.innerHeight;
      const visibleBottom = vv.offsetTop + vv.height;
      const widthChanged = Math.abs(vv.width - lastViewportWidth) > 120;

      // A large width change is almost certainly an orientation/layout change,
      // not a keyboard transition, so re-baseline before computing the inset.
      if (widthChanged) {
        baselineVisibleBottom = Math.max(layoutHeight, visibleBottom);
      }

      const keyboardInset = Math.max(0, baselineVisibleBottom - visibleBottom);
      const bottomOffset = Math.max(0, layoutHeight - visibleBottom);
      const isKeyboardOpen = keyboardInset > 150;

      if (!isKeyboardOpen) {
        baselineVisibleBottom = Math.max(layoutHeight, visibleBottom);
      }
      lastViewportWidth = vv.width;

      // Keyboards are typically >150 px; browser-chrome changes are smaller.
      root.classList.toggle('keyboard-open', isKeyboardOpen);
      root.style.setProperty('--visual-viewport-top-offset', `${vv.offsetTop}px`);
      root.style.setProperty('--visual-viewport-height', `${vv.height}px`);
      root.style.setProperty('--visual-viewport-bottom-offset', `${isKeyboardOpen ? bottomOffset : 0}px`);
    };

    const scheduleUpdate = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(update);
    };

    vv.addEventListener('resize', scheduleUpdate);
    vv.addEventListener('scroll', scheduleUpdate);
    window.addEventListener('resize', scheduleUpdate);
    scheduleUpdate();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv.removeEventListener('resize', scheduleUpdate);
      vv.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      root.classList.remove('keyboard-open');
      root.style.removeProperty('--visual-viewport-top-offset');
      root.style.removeProperty('--visual-viewport-height');
      root.style.removeProperty('--visual-viewport-bottom-offset');
    };
  }, []);
}
