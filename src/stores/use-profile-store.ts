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
  addPR: (pr: PersonalRecord) => Promise<void>;
  getPRsByUser: (userId: string) => PersonalRecord[];
  markCelebrated: (prId: string) => Promise<void>;
  getUncelebratedPRs: (userId: string) => PersonalRecord[];
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

function patchPrEverywhere(
  state: { recordsByUser: Record<string, PersonalRecord[]> },
  prId: string,
  fn: (pr: PersonalRecord) => PersonalRecord,
): { recordsByUser: Record<string, PersonalRecord[]> } {
  const recordsByUser: Record<string, PersonalRecord[]> = {};
  for (const [uid, list] of Object.entries(state.recordsByUser)) {
    recordsByUser[uid] = list.map((pr) => (pr.id === prId ? fn(pr) : pr));
  }
  return { recordsByUser };
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

  addPR: async (pr) => {
    // Optimistic update: replace existing PR for this user+category, or add new
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

    // Upsert on user_id + category
    const { error } = await supabase.from('personal_records').upsert(
      {
        id: pr.id,
        user_id: pr.userId,
        category: pr.category,
        value: pr.value,
        formatted_value: pr.formattedValue,
        previous_value: pr.previousValue,
        session_id: pr.sessionId,
        achieved_at: pr.achievedAt,
        celebrated: pr.celebrated,
      },
      { onConflict: 'user_id,category' }
    );

    if (error) {
      console.error('Failed to upsert PR:', error);
    }
  },

  getPRsByUser: (userId) => get().recordsByUser[userId] ?? [],

  markCelebrated: async (prId) => {
    // Optimistic update
    set((state) => patchPrEverywhere(state, prId, (pr) => ({ ...pr, celebrated: true })));

    const { error } = await supabase
      .from('personal_records')
      .update({ celebrated: true })
      .eq('id', prId);

    if (error) {
      console.error('Failed to mark PR celebrated:', error);
      // Roll back
      set((state) => patchPrEverywhere(state, prId, (pr) => ({ ...pr, celebrated: false })));
    }
  },

  getUncelebratedPRs: (userId) =>
    (get().recordsByUser[userId] ?? []).filter((pr) => !pr.celebrated),
}), {
  name: 'hd-profile',
  storage: safeJSONStorage(),
  partialize: (s) => ({ recordsByUser: s.recordsByUser }),
}));
