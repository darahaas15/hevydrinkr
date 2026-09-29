// Web APIs the shared stores rely on, provided natively. Imported first by
// index.ts, before any shared module loads.

// localStorage: the shared zustand stores persist through it (see
// src/lib/storage/safe-storage.ts) and supabase-js keeps its session in it.
// Backed by SQLite and synchronous, so persisted state hydrates on first
// render exactly as in the browser. A no-op on web, which has its own.
import 'expo-sqlite/localStorage/install';
import { randomUUID } from 'expo-crypto';

// crypto.randomUUID(): the shared stores mint optimistic row ids with it, and
// Hermes ships no Web Crypto.
const host = globalThis as { crypto?: Partial<Crypto> };
if (typeof host.crypto?.randomUUID !== 'function') {
  host.crypto = Object.assign(host.crypto ?? {}, {
    randomUUID: randomUUID as Crypto['randomUUID'],
  });
}
