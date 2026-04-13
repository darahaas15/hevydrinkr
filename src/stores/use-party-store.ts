import { create } from 'zustand';
import type { PartySession, PartyDrinkEvent, PartyParticipant } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { useUIStore } from '@/stores/use-ui-store';

interface PartyState {
  activeParty: PartySession | null;
  partyHistory: PartySession[];
  loading: boolean;

  fetchParty: (partyId: string) => Promise<void>;
  fetchPartyHistory: (groupId: string) => Promise<void>;
  createParty: (
    groupId: string,
    hostUserId: string,
    name: string
  ) => Promise<string>;
  joinParty: (partyId: string, participant: PartyParticipant) => Promise<void>;
  startParty: () => Promise<void>;
  endParty: () => Promise<void>;
  addDrinkEvent: (event: PartyDrinkEvent) => Promise<void>;
  updateParticipantDrinks: (
    userId: string,
    totalStandardDrinks: number
  ) => Promise<void>;
  getPartyById: (id: string) => PartySession | undefined;
}

function mapDbPartyToPartySession(
  row: Record<string, unknown>
): PartySession {
  const participants: PartyParticipant[] = (
    (row.party_participants as Record<string, unknown>[]) ?? []
  ).map((pp) => {
    const profile = pp.profile as
      | { display_name: string; avatar_url: string | null }
      | null;
    return {
      userId: pp.user_id as string,
      userName: profile?.display_name ?? 'Unknown',
      userAvatar: profile?.avatar_url ?? null,
      sessionId: (pp.session_id as string) ?? '',
      totalStandardDrinks: (pp.total_standard_drinks as number) ?? 0,
      isActive: (pp.is_active as boolean) ?? true,
    };
  });

  const liveDrinkFeed: PartyDrinkEvent[] = (
    (row.party_drink_events as Record<string, unknown>[]) ?? []
  ).map((de) => {
    const profile = de.profile as { display_name: string } | null;
    return {
      id: de.id as string,
      userId: de.user_id as string,
      userName: profile?.display_name ?? 'Unknown',
      drinkName: de.drink_name as string,
      drinkEmoji: de.drink_emoji as string,
      drinkCategory: (de.drink_category as string) || 'custom',
      timestamp: de.timestamp as string,
    };
  });

  return {
    id: row.id as string,
    groupId: row.group_id as string,
    hostUserId: row.host_user_id as string,
    name: row.name as string,
    status: row.status as PartySession['status'],
    startedAt: (row.started_at as string) ?? null,
    endedAt: (row.ended_at as string) ?? null,
    participants,
    liveDrinkFeed,
  };
}

const PARTY_SELECT = `*, party_participants(*, profile:profiles!party_participants_user_id_fkey(display_name, avatar_url)), party_drink_events(*, profile:profiles!party_drink_events_user_id_fkey(display_name))`;

export const usePartyStore = create<PartyState>()((set, get) => ({
  activeParty: null,
  partyHistory: [],
  loading: false,

  fetchParty: async (partyId) => {
    set({ loading: true });

    const { data, error } = await supabase
      .from('party_sessions')
      .select(PARTY_SELECT)
      .eq('id', partyId)
      .single();

    if (error) {
      console.error('Failed to fetch party:', error);
      set({ loading: false });
      return;
    }

    const party = mapDbPartyToPartySession(data);

    if (party.status === 'ended') {
      set((state) => {
        const exists = state.partyHistory.some((p) => p.id === party.id);
        return {
          partyHistory: exists
            ? state.partyHistory.map((p) => (p.id === party.id ? party : p))
            : [party, ...state.partyHistory],
          loading: false,
        };
      });
    } else {
      set({ activeParty: party, loading: false });
    }
  },

  fetchPartyHistory: async (groupId) => {
    const { data, error } = await supabase
      .from('party_sessions')
      .select(PARTY_SELECT)
      .eq('group_id', groupId)
      .eq('status', 'ended')
      .order('ended_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch party history:', error);
      return;
    }

    set({
      partyHistory: (data ?? []).map(mapDbPartyToPartySession),
    });
  },

  createParty: async (groupId, hostUserId, name) => {
    const id = crypto.randomUUID();
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

    // Optimistic update
    set({ activeParty: party });

    const { error } = await supabase.from('party_sessions').insert({
      id,
      group_id: groupId,
      host_user_id: hostUserId,
      name,
      status: 'waiting',
    });

    if (error) {
      console.error('Failed to create party:', error);
      set({ activeParty: null });
      useUIStore.getState().addToast('Something went wrong', 'error');
      return '';
    }

    return id;
  },

  joinParty: async (partyId, participant) => {
    const { activeParty } = get();
    if (!activeParty || activeParty.id !== partyId) return;

    const alreadyJoined = activeParty.participants.some(
      (p) => p.userId === participant.userId
    );
    if (alreadyJoined) return;

    // Optimistic update
    set({
      activeParty: {
        ...activeParty,
        participants: [...activeParty.participants, participant],
      },
    });

    const { error } = await supabase.from('party_participants').insert({
      party_id: partyId,
      user_id: participant.userId,
      session_id: participant.sessionId,
      total_standard_drinks: participant.totalStandardDrinks,
      is_active: participant.isActive,
    });

    if (error) {
      console.error('Failed to join party:', error);
      // Roll back
      set({
        activeParty: {
          ...activeParty,
          participants: activeParty.participants.filter(
            (p) => p.userId !== participant.userId
          ),
        },
      });
    }
  },

  startParty: async () => {
    const { activeParty } = get();
    if (!activeParty) return;

    const startedAt = new Date().toISOString();

    // Optimistic update
    set({
      activeParty: {
        ...activeParty,
        status: 'active',
        startedAt,
      },
    });

    const { error } = await supabase
      .from('party_sessions')
      .update({ status: 'active', started_at: startedAt })
      .eq('id', activeParty.id);

    if (error) {
      console.error('Failed to start party:', error);
      // Roll back
      set({
        activeParty: {
          ...activeParty,
          status: 'waiting',
          startedAt: null,
        },
      });
      useUIStore.getState().addToast('Something went wrong', 'error');
    }
  },

  endParty: async () => {
    const { activeParty, partyHistory } = get();
    if (!activeParty) return;

    const endedAt = new Date().toISOString();
    const endedParty: PartySession = {
      ...activeParty,
      status: 'ended',
      endedAt,
    };

    // Optimistic update
    set({
      activeParty: null,
      partyHistory: [endedParty, ...partyHistory],
    });

    const { error } = await supabase
      .from('party_sessions')
      .update({ status: 'ended', ended_at: endedAt })
      .eq('id', activeParty.id);

    if (error) {
      console.error('Failed to end party:', error);
      // Roll back
      set({
        activeParty,
        partyHistory: partyHistory.filter((p) => p.id !== activeParty.id),
      });
      useUIStore.getState().addToast('Something went wrong', 'error');
    }
  },

  addDrinkEvent: async (event) => {
    const { activeParty } = get();
    if (!activeParty) return;

    // Optimistic update
    set({
      activeParty: {
        ...activeParty,
        liveDrinkFeed: [...activeParty.liveDrinkFeed, event],
      },
    });

    const { error } = await supabase.from('party_drink_events').insert({
      id: event.id,
      party_id: activeParty.id,
      user_id: event.userId,
      drink_name: event.drinkName,
      drink_emoji: event.drinkEmoji,
      timestamp: event.timestamp,
    });

    if (error) {
      console.error('Failed to add drink event:', error);
    }
  },

  updateParticipantDrinks: async (userId, totalStandardDrinks) => {
    const { activeParty } = get();
    if (!activeParty) return;

    // Optimistic update
    set({
      activeParty: {
        ...activeParty,
        participants: activeParty.participants.map((p) =>
          p.userId === userId ? { ...p, totalStandardDrinks } : p
        ),
      },
    });

    const { error } = await supabase
      .from('party_participants')
      .update({ total_standard_drinks: totalStandardDrinks })
      .eq('party_id', activeParty.id)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to update participant drinks:', error);
    }
  },

  getPartyById: (id) => {
    const { activeParty, partyHistory } = get();
    if (activeParty?.id === id) return activeParty;
    return partyHistory.find((p) => p.id === id);
  },
}));
