import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PersonalRecord } from '@/types';
import { supabase } from '@/lib/supabase/client';

const PRS_STALE_MS = 30_000;
let _prsLastFetched = 0;

interface ProfileState {
  personalRecords: PersonalRecord[];
  loading: boolean;

  fetchPRs: (userId: string, force?: boolean) => Promise<void>;
  addPR: (pr: PersonalRecord) => Promise<void>;
  updatePRs: (prs: PersonalRecord[]) => void;
  getPRsByUser: (userId: string) => PersonalRecord[];
  markCelebrated: (prId: string) => Promise<void>;
  getUncelebratedPRs: () => PersonalRecord[];
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
  personalRecords: [],
  loading: false,

  fetchPRs: async (userId, force) => {
    if (!force && Date.now() - _prsLastFetched < PRS_STALE_MS) return;
    _prsLastFetched = Date.now();
    if (get().personalRecords.length === 0) set({ loading: true });

    const { data, error } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to fetch PRs:', error);
      set({ loading: false });
      return;
    }

    set({
      personalRecords: (data ?? []).map(mapDbPrToPersonalRecord),
      loading: false,
    });
  },

  addPR: async (pr) => {
    // Optimistic update: replace existing PR for this user+category, or add new
    set((state) => {
      const exists = state.personalRecords.some(
        (existing) =>
          existing.userId === pr.userId && existing.category === pr.category
      );
      return {
        personalRecords: exists
          ? state.personalRecords.map((existing) =>
              existing.userId === pr.userId &&
              existing.category === pr.category
                ? pr
                : existing
            )
          : [...state.personalRecords, pr],
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

  updatePRs: (prs) => set({ personalRecords: prs }),

  getPRsByUser: (userId) =>
    get().personalRecords.filter((pr) => pr.userId === userId),

  markCelebrated: async (prId) => {
    // Optimistic update
    set((state) => ({
      personalRecords: state.personalRecords.map((pr) =>
        pr.id === prId ? { ...pr, celebrated: true } : pr
      ),
    }));

    const { error } = await supabase
      .from('personal_records')
      .update({ celebrated: true })
      .eq('id', prId);

    if (error) {
      console.error('Failed to mark PR celebrated:', error);
      // Roll back
      set((state) => ({
        personalRecords: state.personalRecords.map((pr) =>
          pr.id === prId ? { ...pr, celebrated: false } : pr
        ),
      }));
    }
  },

  getUncelebratedPRs: () =>
    get().personalRecords.filter((pr) => !pr.celebrated),
}), {
  name: 'hd-profile',
  partialize: (s) => ({ personalRecords: s.personalRecords }),
}));
