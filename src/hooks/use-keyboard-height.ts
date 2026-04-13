'use client';

import { useEffect } from 'react';

/**
 * Detects the on-screen keyboard and toggles a `keyboard-open` class
 * on the document root element.
 *
 * With `interactive-widget=resizes-content` in the viewport meta, the
 * layout viewport shrinks when the keyboard opens, so
 * `position: fixed; bottom: 0` already sits above the keyboard.
 * This hook only drives safe-area padding adjustments.
 *
 * Call this hook exactly once near the root of the app.
 */
export function useKeyboardHeight() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const vv = window.visualViewport;
    if (!vv) return;

    // Capture the full viewport height before the keyboard opens.
    let fullHeight = vv.height;
    let isOpen = false;

    const update = () => {
      // Update reference when viewport grows (orientation change, URL bar hide).
      if (vv.height > fullHeight) fullHeight = vv.height;
      // Keyboards are typically >150 px; browser-chrome changes are smaller.
      const nowOpen = fullHeight - vv.height > 150;
      root.classList.toggle('keyboard-open', nowOpen);

      if (nowOpen && !isOpen) {
        // Keyboard just opened — start tracking visual viewport scroll.
        vv.addEventListener('scroll', onVVScroll);
      } else if (!nowOpen && isOpen) {
        // Keyboard closed — stop tracking and reset offset.
        vv.removeEventListener('scroll', onVVScroll);
        root.style.setProperty('--vv-offset-top', '0px');
      }
      isOpen = nowOpen;
    };

    // On iOS, when the user scrolls while the keyboard is open the visual
    // viewport can shift relative to the layout viewport, displacing
    // `position: fixed` elements.  Track the offset so CSS can compensate.
    const onVVScroll = () => {
      root.style.setProperty('--vv-offset-top', `${vv.offsetTop}px`);
    };

    vv.addEventListener('resize', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', onVVScroll);
      root.classList.remove('keyboard-open');
      root.style.removeProperty('--vv-offset-top');
    };
  }, []);
}
