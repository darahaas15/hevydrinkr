import { create } from 'zustand';
import type { PersonalRecord } from '@/types';
import { generateId } from '@/lib/utils';

interface ToastAction {
  label: string;
  onPress: () => void;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: ToastAction;
  durationMs: number | null; // null = persistent (user must dismiss)
}

interface ToastOptions {
  type?: 'success' | 'error' | 'info';
  action?: ToastAction;
  durationMs?: number | null;
}

interface UIState {
  celebrationPR: PersonalRecord | null;
  showCelebration: boolean;
  toasts: Toast[];
  hideBottomNav: boolean;
  lockMainScroll: boolean;
  isOffline: boolean;

  triggerCelebration: (pr: PersonalRecord) => void;
  dismissCelebration: () => void;
  addToast: (message: string, typeOrOptions?: 'success' | 'error' | 'info' | ToastOptions) => void;
  removeToast: (id: string) => void;
  setHideBottomNav: (hide: boolean) => void;
  setLockMainScroll: (lock: boolean) => void;
  setOffline: (offline: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  celebrationPR: null,
  showCelebration: false,
  toasts: [],
  hideBottomNav: false,
  lockMainScroll: false,
  isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,

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

  addToast: (message, typeOrOptions) => {
    const opts: ToastOptions =
      typeof typeOrOptions === 'string' ? { type: typeOrOptions } : typeOrOptions ?? {};
    const type = opts.type ?? 'info';
    // Errors are persistent by default so users don't miss failures.
    const defaultDuration = type === 'error' ? null : 3000;
    const durationMs = opts.durationMs === undefined ? defaultDuration : opts.durationMs;
    const id = generateId();
    const toast: Toast = { id, message, type, action: opts.action, durationMs };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    if (durationMs !== null) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, durationMs);
    }
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  setHideBottomNav: (hide) => set({ hideBottomNav: hide }),

  setLockMainScroll: (lock) => set({ lockMainScroll: lock }),

  setOffline: (offline) => set({ isOffline: offline }),
}));
