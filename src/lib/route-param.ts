/**
 * The static export prerenders each dynamic route once with `_` as its param,
 * and Vercel rewrites every real URL (e.g. `/feed/<id>`) to that page, so a
 * direct load (shared link, refresh, cold start from a push) sees `_` in
 * `params`. Every dynamic route keeps its param as the second path segment,
 * so read the real value from the URL in that case.
 */
export const EXPORT_PLACEHOLDER = '_';

export function resolveRouteParam(value: string | undefined, pathname: string | null): string {
  if (value && value !== EXPORT_PLACEHOLDER) return value;
  const segment = pathname?.split('/')[2] ?? '';
  return decodeURIComponent(segment);
}
