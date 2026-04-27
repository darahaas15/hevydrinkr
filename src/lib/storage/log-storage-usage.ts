// Dev-only one-shot summary of every hd-* localStorage key's byte size.
// Helps decide whether any further stores need trimming. Skips production.
export function logStorageUsage(): void {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV !== 'development') return;

  let total = 0;
  const rows: Array<[string, number]> = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith('hd-')) continue;
    const size = (window.localStorage.getItem(key) ?? '').length;
    rows.push([key, size]);
    total += size;
  }
  rows.sort((a, b) => b[1] - a[1]);
  console.groupCollapsed(`[storage] hd-* total: ${(total / 1024).toFixed(1)} KB`);
  for (const [k, s] of rows) {
    console.log(`${k.padEnd(20)} ${(s / 1024).toFixed(1)} KB`);
  }
  console.groupEnd();
}
