import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeJSONStorage } from '@/lib/storage/safe-storage';

interface ChangelogState {
  /** Version of the most recent changelog entry this device has seen. */
  lastSeenVersion: string | null;
  markSeen: (version: string) => void;
}

// Per-device (single key) — app changes are build-level, not user-level.
export const useChangelogStore = create<ChangelogState>()(
  persist(
    (set) => ({
      lastSeenVersion: null,
      markSeen: (version) => set({ lastSeenVersion: version }),
    }),
    {
      name: 'hd-changelog',
      storage: safeJSONStorage(),
      partialize: (s) => ({ lastSeenVersion: s.lastSeenVersion }),
    }
  )
);
