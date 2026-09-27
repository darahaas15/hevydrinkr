import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PersonalRecord } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { safeJSONStorage } from '@/lib/storage/safe-storage';

const PRS_STALE_MS = 30_000;
const _prsLastFetched = new Map<string, number>();

interface ProfileState {
  // Personal records keyed by userId. Per-user so viewing another user's
  // profile doesn't replace your own PR list (which would otherwise vanish
  // until the stale guard expires).
  recordsByUser: Record<string, PersonalRecord[]>;
  loading: boolean;

  fetchPRs: (userId: string, force?: boolean) => Promise<void>;
  addPR: (pr: PersonalRecord) => void;
}

function mapDbPrToPersonalRecord(
  row: Record<string, unknown>
): PersonalRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    category: row.category as PersonalRecord['category'],
    value: row.value as number,
    formattedValue: row.formatted_value as string,
    previousValue: (row.previous_value as number) ?? null,
    sessionId: row.session_id as string,
    achievedAt: row.achieved_at as string,
    celebrated: row.celebrated as boolean,
  };
}

export const useProfileStore = create<ProfileState>()(persist((set, get) => ({
  recordsByUser: {},
  loading: false,

  fetchPRs: async (userId, force) => {
    if (!userId) return;
    const last = _prsLastFetched.get(userId) ?? 0;
    if (!force && Date.now() - last < PRS_STALE_MS) return;
    _prsLastFetched.set(userId, Date.now());
    if ((get().recordsByUser[userId] ?? []).length === 0) set({ loading: true });

    const { data, error } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to fetch PRs:', error);
      set({ loading: false });
      return;
    }

    set((state) => ({
      recordsByUser: {
        ...state.recordsByUser,
        [userId]: (data ?? []).map(mapDbPrToPersonalRecord),
      },
      loading: false,
    }));
  },

  addPR: (pr) => {
    // Local only, so the profile shows a record the moment its celebration
    // fires. The database owns personal_records: triggers recompute them from
    // the user's completed sessions (see 20260927_recompute_personal_records),
    // and the next fetchPRs replaces this with the stored row.
    set((state) => {
      const existing = state.recordsByUser[pr.userId] ?? [];
      const sameCategoryIdx = existing.findIndex((e) => e.category === pr.category);
      const updated = sameCategoryIdx >= 0
        ? existing.map((e, i) => (i === sameCategoryIdx ? pr : e))
        : [...existing, pr];
      return {
        recordsByUser: { ...state.recordsByUser, [pr.userId]: updated },
      };
    });
  },
}), {
  name: 'hd-profile',
  storage: safeJSONStorage(),
  partialize: (s) => ({ recordsByUser: s.recordsByUser }),
}));
