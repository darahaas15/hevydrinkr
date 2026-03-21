import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PartySession, PartyDrinkEvent, PartyParticipant } from '@/types';
import { generateId } from '@/lib/utils';

interface PartyState {
  activeParty: PartySession | null;
  partyHistory: PartySession[];

  createParty: (groupId: string, hostUserId: string, name: string) => string;
  joinParty: (partyId: string, participant: PartyParticipant) => void;
  startParty: () => void;
  endParty: () => void;
  addDrinkEvent: (event: PartyDrinkEvent) => void;
  updateParticipantDrinks: (
    userId: string,
    totalStandardDrinks: number
  ) => void;
  getPartyById: (id: string) => PartySession | undefined;
}

export const usePartyStore = create<PartyState>()(
  persist(
    (set, get) => ({
      activeParty: null,
      partyHistory: [],

      createParty: (groupId, hostUserId, name) => {
        const id = generateId();
        const party: PartySession = {
          id,
          groupId,
          hostUserId,
          name,
          status: 'waiting',
          startedAt: null,
          endedAt: null,
          participants: [],
          liveDrinkFeed: [],
        };
        set({ activeParty: party });
        return id;
      },

      joinParty: (partyId, participant) => {
        const { activeParty } = get();
        if (!activeParty || activeParty.id !== partyId) return;

        const alreadyJoined = activeParty.participants.some(
          (p) => p.userId === participant.userId
        );
        if (alreadyJoined) return;

        set({
          activeParty: {
            ...activeParty,
            participants: [...activeParty.participants, participant],
          },
        });
      },

      startParty: () => {
        const { activeParty } = get();
        if (!activeParty) return;

        set({
          activeParty: {
            ...activeParty,
            status: 'active',
            startedAt: new Date().toISOString(),
          },
        });
      },

      endParty: () => {
        const { activeParty, partyHistory } = get();
        if (!activeParty) return;

        const endedParty: PartySession = {
          ...activeParty,
          status: 'ended',
          endedAt: new Date().toISOString(),
        };

        set({
          activeParty: null,
          partyHistory: [endedParty, ...partyHistory],
        });
      },

      addDrinkEvent: (event) => {
        const { activeParty } = get();
        if (!activeParty) return;

        set({
          activeParty: {
            ...activeParty,
            liveDrinkFeed: [...activeParty.liveDrinkFeed, event],
          },
        });
      },

      updateParticipantDrinks: (userId, totalStandardDrinks) => {
        const { activeParty } = get();
        if (!activeParty) return;

        set({
          activeParty: {
            ...activeParty,
            participants: activeParty.participants.map((p) =>
              p.userId === userId ? { ...p, totalStandardDrinks } : p
            ),
          },
        });
      },

      getPartyById: (id) => {
        const { activeParty, partyHistory } = get();
        if (activeParty?.id === id) return activeParty;
        return partyHistory.find((p) => p.id === id);
      },
    }),
    {
      name: 'hevydrinkr-party',
    }
  )
);
