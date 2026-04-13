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

    const update = () => {
      // Update reference when viewport grows (orientation change, URL bar hide).
      if (vv.height > fullHeight) fullHeight = vv.height;
      // Keyboards are typically >150 px; browser-chrome changes are smaller.
      root.classList.toggle('keyboard-open', fullHeight - vv.height > 150);
    };

    vv.addEventListener('resize', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      root.classList.remove('keyboard-open');
    };
  }, []);
}
