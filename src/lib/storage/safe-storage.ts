import type { PersistStorage, StorageValue } from 'zustand/middleware';

const isQuotaError = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false;
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    /quota/i.test(err.message)
  );
};

// Wraps localStorage with a write that silently drops on QuotaExceeded.
// Persisted state is a cache of Supabase data, so losing a write is safe —
// the next page load re-fetches. Crashing the app on a full storage isn't.
export function safeJSONStorage<T>(): PersistStorage<T> {
  return {
    getItem: (name) => {
      if (typeof window === 'undefined') return null;
      try {
        const raw = window.localStorage.getItem(name);
        return raw ? (JSON.parse(raw) as StorageValue<T>) : null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(name, JSON.stringify(value));
      } catch (err) {
        if (isQuotaError(err)) {
          // Try to free room by dropping our own oldest persisted slice,
          // then retry once. If it still fails, give up — but log so silent
          // state desyncs (the cache is now out-of-sync with what's in
          // memory) are observable instead of invisible.
          console.warn(`[safeJSONStorage] quota exceeded writing "${name}", retrying after removing existing key`);
          try {
            window.localStorage.removeItem(name);
            window.localStorage.setItem(name, JSON.stringify(value));
          } catch (retryErr) {
            console.error(`[safeJSONStorage] retry failed for "${name}" — persisted cache will be stale until next successful write`, retryErr);
          }
          return;
        }
        throw err;
      }
    },
    removeItem: (name) => {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.removeItem(name);
      } catch {}
    },
  };
}
