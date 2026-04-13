'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

type Direction = -1 | 0 | 1;

function navigateWithTransition(
  fn: () => void,
  direction: Direction,
) {
  document.documentElement.dataset.navDirection = String(direction);

  if (document.startViewTransition) {
    document.startViewTransition(() => fn());
  } else {
    fn();
  }
}

export function useAppRouter() {
  const router = useRouter();

  const push = useCallback(
    (path: string, opts?: { direction?: Direction }) => {
      navigateWithTransition(() => router.push(path), opts?.direction ?? 1);
    },
    [router],
  );

  const back = useCallback(() => {
    navigateWithTransition(() => router.back(), -1);
  }, [router]);

  const replace = useCallback(
    (path: string) => {
      navigateWithTransition(() => router.replace(path), 0);
    },
    [router],
  );

  return {
    push,
    back,
    replace,
    prefetch: router.prefetch.bind(router),
  };
}
