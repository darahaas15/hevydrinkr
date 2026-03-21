import { create } from 'zustand';
import type { PersonalRecord } from '@/types';
import { generateId } from '@/lib/utils';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface UIState {
  celebrationPR: PersonalRecord | null;
  showCelebration: boolean;
  toasts: Toast[];

  triggerCelebration: (pr: PersonalRecord) => void;
  dismissCelebration: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  celebrationPR: null,
  showCelebration: false,
  toasts: [],

  triggerCelebration: (pr) =>
    set({
      celebrationPR: pr,
      showCelebration: true,
    }),

  dismissCelebration: () =>
    set({
      celebrationPR: null,
      showCelebration: false,
    }),

  addToast: (message, type = 'info') => {
    const id = generateId();
    const toast: Toast = { id, message, type };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3000);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
