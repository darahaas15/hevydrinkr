'use client';

import { use } from 'react';
import { usePathname } from 'next/navigation';
import { resolveRouteParam } from '@/lib/route-param';

/** A dynamic route's param that also survives the static export's `_` placeholder. */
export function useRouteParam(params: Promise<Record<string, string>> | undefined, key: string): string {
  const pathname = usePathname();
  const value = params ? use(params)[key] : undefined;
  return resolveRouteParam(value, pathname);
}
