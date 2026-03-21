import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PersonalRecord } from '@/types';

interface ProfileState {
  personalRecords: PersonalRecord[];

  addPR: (pr: PersonalRecord) => void;
  updatePRs: (prs: PersonalRecord[]) => void;
  getPRsByUser: (userId: string) => PersonalRecord[];
  markCelebrated: (prId: string) => void;
  getUncelebratedPRs: () => PersonalRecord[];
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      personalRecords: [],

      addPR: (pr) =>
        set((state) => ({
          personalRecords: [...state.personalRecords, pr],
        })),

      updatePRs: (prs) => set({ personalRecords: prs }),

      getPRsByUser: (userId) =>
        get().personalRecords.filter((pr) => pr.userId === userId),

      markCelebrated: (prId) =>
        set((state) => ({
          personalRecords: state.personalRecords.map((pr) =>
            pr.id === prId ? { ...pr, celebrated: true } : pr
          ),
        })),

      getUncelebratedPRs: () =>
        get().personalRecords.filter((pr) => !pr.celebrated),
    }),
    {
      name: 'hevydrinkr-profile',
    }
  )
);
