import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DrinkSession, DrinkEntry, Round, SessionMood } from '@/types';
import { generateId } from '@/lib/utils';

interface SessionState {
  activeSession: DrinkSession | null;
  sessionHistory: DrinkSession[];

  startSession: (venue: string, userId: string) => void;
  endSession: (mood: SessionMood) => void;
  abandonSession: () => void;
  addDrink: (drink: DrinkEntry) => void;
  removeDrink: (drinkId: string) => void;
  addPhoto: (photoDataUrl: string) => void;
  removePhoto: (photoIndex: number) => void;
  addRound: (round: Round) => void;
  updatePeakBac: (bac: number) => void;
  getSessionById: (id: string) => DrinkSession | undefined;
  getSessionsByUser: (userId: string) => DrinkSession[];
  addCompletedSession: (session: DrinkSession) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      activeSession: null,
      sessionHistory: [],

      startSession: (venue, userId) => {
        const session: DrinkSession = {
          id: generateId(),
          userId,
          status: 'active',
          startedAt: new Date().toISOString(),
          endedAt: null,
          venue,
          drinks: [],
          rounds: [],
          totalStandardDrinks: 0,
          totalVolumeMl: 0,
          peakBacEstimate: 0,
          durationMinutes: 0,
          isPartyMode: false,
          partyId: null,
          prsAchieved: [],
          mood: null,
          notes: '',
          photos: [],
        };
        set({ activeSession: session });
      },

      endSession: (mood) => {
        const { activeSession, sessionHistory } = get();
        if (!activeSession) return;

        const now = new Date();
        const startTime = new Date(activeSession.startedAt);
        const durationMinutes = Math.round(
          (now.getTime() - startTime.getTime()) / 60000
        );

        const totalStandardDrinks = activeSession.drinks.reduce(
          (sum, drink) => sum + drink.standardDrinks,
          0
        );
        const totalVolumeMl = activeSession.drinks.reduce(
          (sum, drink) => sum + drink.volumeMl,
          0
        );

        const completedSession: DrinkSession = {
          ...activeSession,
          status: 'completed',
          endedAt: now.toISOString(),
          durationMinutes,
          totalStandardDrinks,
          totalVolumeMl,
          mood,
        };

        set({
          activeSession: null,
          sessionHistory: [completedSession, ...sessionHistory],
        });
      },

      abandonSession: () => {
        const { activeSession, sessionHistory } = get();
        if (!activeSession) return;

        const abandonedSession: DrinkSession = {
          ...activeSession,
          status: 'abandoned',
          endedAt: new Date().toISOString(),
        };

        set({
          activeSession: null,
          sessionHistory: [abandonedSession, ...sessionHistory],
        });
      },

      addDrink: (drink) => {
        const { activeSession } = get();
        if (!activeSession) return;

        set({
          activeSession: {
            ...activeSession,
            drinks: [...activeSession.drinks, drink],
            totalStandardDrinks:
              activeSession.totalStandardDrinks + drink.standardDrinks,
            totalVolumeMl: activeSession.totalVolumeMl + drink.volumeMl,
          },
        });
      },

      removeDrink: (drinkId) => {
        const { activeSession } = get();
        if (!activeSession) return;

        const drinkToRemove = activeSession.drinks.find(
          (d) => d.id === drinkId
        );
        if (!drinkToRemove) return;

        set({
          activeSession: {
            ...activeSession,
            drinks: activeSession.drinks.filter((d) => d.id !== drinkId),
            totalStandardDrinks:
              activeSession.totalStandardDrinks -
              drinkToRemove.standardDrinks,
            totalVolumeMl:
              activeSession.totalVolumeMl - drinkToRemove.volumeMl,
          },
        });
      },

      addPhoto: (photoDataUrl) => {
        const { activeSession } = get();
        if (!activeSession) return;
        set({
          activeSession: {
            ...activeSession,
            photos: [...activeSession.photos, photoDataUrl],
          },
        });
      },

      removePhoto: (photoIndex) => {
        const { activeSession } = get();
        if (!activeSession) return;
        set({
          activeSession: {
            ...activeSession,
            photos: activeSession.photos.filter((_, i) => i !== photoIndex),
          },
        });
      },

      addRound: (round) => {
        const { activeSession } = get();
        if (!activeSession) return;

        set({
          activeSession: {
            ...activeSession,
            rounds: [...activeSession.rounds, round],
          },
        });
      },

      updatePeakBac: (bac) => {
        const { activeSession } = get();
        if (!activeSession) return;

        if (bac > activeSession.peakBacEstimate) {
          set({
            activeSession: {
              ...activeSession,
              peakBacEstimate: bac,
            },
          });
        }
      },

      getSessionById: (id) => {
        const { activeSession, sessionHistory } = get();
        if (activeSession?.id === id) return activeSession;
        return sessionHistory.find((s) => s.id === id);
      },

      getSessionsByUser: (userId) =>
        get().sessionHistory.filter((s) => s.userId === userId),

      addCompletedSession: (session) =>
        set((state) => ({
          sessionHistory: [session, ...state.sessionHistory],
        })),
    }),
    {
      name: 'hevydrinkr-sessions',
    }
  )
);
