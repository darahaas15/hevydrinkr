import { create } from 'zustand';
import type { DrinkSession, DrinkEntry, Round, SessionMood } from '@/types';
import { supabase } from '@/lib/supabase/client';

interface SessionState {
  activeSession: DrinkSession | null;
  sessionHistory: DrinkSession[];

  fetchSessions: (userId: string) => Promise<void>;
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

// ---------------------------------------------------------------------------
// Helpers to convert between Supabase row shapes and local types
// ---------------------------------------------------------------------------

function rowToDrinkEntry(row: Record<string, unknown>): DrinkEntry {
  return {
    id: row.id as string,
    drinkDefinitionId: row.drink_definition_id as string,
    drinkName: row.drink_name as string,
    emoji: row.emoji as string,
    category: row.category as DrinkEntry['category'],
    abvPercent: row.abv_percent as number,
    volumeMl: row.volume_ml as number,
    standardDrinks: row.standard_drinks as number,
    timestamp: row.timestamp as string,
    roundId: (row.round_id as string) ?? null,
    notes: (row.notes as string) ?? '',
  };
}

function rowToSession(
  row: Record<string, unknown>,
  drinks: DrinkEntry[],
  photos: string[],
): DrinkSession {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    status: row.status as DrinkSession['status'],
    startedAt: row.started_at as string,
    endedAt: (row.ended_at as string) ?? null,
    venue: (row.venue as string) ?? '',
    drinks,
    rounds: [],
    totalStandardDrinks: (row.total_standard_drinks as number) ?? 0,
    totalVolumeMl: (row.total_volume_ml as number) ?? 0,
    peakBacEstimate: (row.peak_bac_estimate as number) ?? 0,
    durationMinutes: (row.duration_minutes as number) ?? 0,
    isPartyMode: (row.is_party_mode as boolean) ?? false,
    partyId: (row.party_id as string) ?? null,
    prsAchieved: [],
    mood: (row.mood as DrinkSession['mood']) ?? null,
    notes: (row.notes as string) ?? '',
    photos,
  };
}

function sessionToRow(session: DrinkSession) {
  return {
    id: session.id,
    user_id: session.userId,
    status: session.status,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    venue: session.venue,
    total_standard_drinks: session.totalStandardDrinks,
    total_volume_ml: session.totalVolumeMl,
    peak_bac_estimate: session.peakBacEstimate,
    duration_minutes: session.durationMinutes,
    is_party_mode: session.isPartyMode,
    party_id: session.partyId,
    mood: session.mood,
    notes: session.notes,
  };
}

function drinkEntryToRow(entry: DrinkEntry, sessionId: string) {
  return {
    id: entry.id,
    session_id: sessionId,
    drink_definition_id: entry.drinkDefinitionId,
    drink_name: entry.drinkName,
    emoji: entry.emoji,
    category: entry.category,
    abv_percent: entry.abvPercent,
    volume_ml: entry.volumeMl,
    standard_drinks: entry.standardDrinks,
    timestamp: entry.timestamp,
    round_id: entry.roundId,
    notes: entry.notes,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSessionStore = create<SessionState>()((set, get) => ({
  activeSession: null,
  sessionHistory: [],

  // -----------------------------------------------------------------------
  // Fetch sessions from Supabase and hydrate local state
  // -----------------------------------------------------------------------
  fetchSessions: async (userId: string) => {
    // If userId is empty, fetch all sessions (for leaderboard) — only completed, no active
    let query = supabase
      .from('drink_sessions')
      .select('*')
      .order('started_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      // Leaderboard: only completed sessions, skip active ones
      query = query.eq('status', 'completed');
    }

    const { data: sessionRows, error: sessionsError } = await query;

    if (sessionsError || !sessionRows) {
      console.error('Failed to fetch sessions:', sessionsError);
      return;
    }

    const sessionIds = sessionRows.map((r) => r.id as string);

    // Fetch all drink entries and photos for these sessions in parallel
    const [entriesResult, photosResult] = await Promise.all([
      sessionIds.length > 0
        ? supabase
            .from('drink_entries')
            .select('*')
            .in('session_id', sessionIds)
            .order('timestamp', { ascending: true })
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
      sessionIds.length > 0
        ? supabase
            .from('session_photos')
            .select('*')
            .in('session_id', sessionIds)
            .order('sort_order', { ascending: true })
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    ]);

    const entryRows = entriesResult.data ?? [];
    const photoRows = photosResult.data ?? [];

    // Group drink entries by session_id
    const entriesBySession = new Map<string, DrinkEntry[]>();
    for (const row of entryRows) {
      const sid = row.session_id as string;
      if (!entriesBySession.has(sid)) entriesBySession.set(sid, []);
      entriesBySession.get(sid)!.push(rowToDrinkEntry(row as Record<string, unknown>));
    }

    // Group photos by session_id
    const photosBySession = new Map<string, string[]>();
    for (const row of photoRows) {
      const sid = (row as Record<string, unknown>).session_id as string;
      if (!photosBySession.has(sid)) photosBySession.set(sid, []);
      photosBySession.get(sid)!.push((row as Record<string, unknown>).url as string);
    }

    // Build DrinkSession objects
    const sessions: DrinkSession[] = sessionRows.map((row) => {
      const id = row.id as string;
      return rowToSession(
        row as Record<string, unknown>,
        entriesBySession.get(id) ?? [],
        photosBySession.get(id) ?? [],
      );
    });

    const history = sessions.filter((s) => s.status !== 'active');

    if (userId) {
      // User-specific fetch — set active session and history
      const active = sessions.find((s) => s.status === 'active') ?? null;
      set({ activeSession: active, sessionHistory: history });
    } else {
      // Leaderboard fetch — merge into history without overwriting user's own active session
      // Keep existing activeSession untouched
      set((state) => ({ sessionHistory: history, activeSession: state.activeSession }));
    }
  },

  // -----------------------------------------------------------------------
  // Start a new session
  // -----------------------------------------------------------------------
  startSession: (venue, userId) => {
    const tempId = crypto.randomUUID();
    const session: DrinkSession = {
      id: tempId,
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

    // Optimistic update
    set({ activeSession: session });

    // Persist to Supabase, then reconcile the id
    supabase
      .from('drink_sessions')
      .insert(sessionToRow(session))
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to create session in Supabase:', error);
          return;
        }
        if (data) {
          set((s) => ({
            activeSession: s.activeSession
              ? { ...s.activeSession, id: data.id as string }
              : null,
          }));
        }
      });
  },

  // -----------------------------------------------------------------------
  // End the active session
  // -----------------------------------------------------------------------
  endSession: (mood) => {
    const { activeSession, sessionHistory } = get();
    if (!activeSession) return;

    const now = new Date();
    const startTime = new Date(activeSession.startedAt);
    const durationMinutes = Math.round(
      (now.getTime() - startTime.getTime()) / 60000,
    );

    const totalStandardDrinks = activeSession.drinks.reduce(
      (sum, drink) => sum + drink.standardDrinks,
      0,
    );
    const totalVolumeMl = activeSession.drinks.reduce(
      (sum, drink) => sum + drink.volumeMl,
      0,
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

    // Optimistic update
    set({
      activeSession: null,
      sessionHistory: [completedSession, ...sessionHistory],
    });

    // Sync to Supabase
    supabase
      .from('drink_sessions')
      .update({
        status: 'completed',
        ended_at: completedSession.endedAt,
        duration_minutes: durationMinutes,
        total_standard_drinks: totalStandardDrinks,
        total_volume_ml: totalVolumeMl,
        peak_bac_estimate: completedSession.peakBacEstimate,
        mood,
      })
      .eq('id', completedSession.id)
      .then(({ error }) => {
        if (error) console.error('Failed to end session in Supabase:', error);
      });
  },

  // -----------------------------------------------------------------------
  // Abandon the active session
  // -----------------------------------------------------------------------
  abandonSession: () => {
    const { activeSession } = get();
    if (!activeSession) return;

    const sessionId = activeSession.id;

    // Clear local state — don't add to history
    set({ activeSession: null });

    // Delete from Supabase entirely (cascades to drink_entries, photos, etc.)
    supabase
      .from('drink_sessions')
      .delete()
      .eq('id', sessionId)
      .then(({ error }) => {
        if (error)
          console.error('Failed to delete abandoned session:', error);
      });
  },

  // -----------------------------------------------------------------------
  // Add a drink to the active session
  // -----------------------------------------------------------------------
  addDrink: (drink) => {
    const { activeSession } = get();
    if (!activeSession) return;

    // Optimistic update
    set({
      activeSession: {
        ...activeSession,
        drinks: [...activeSession.drinks, drink],
        totalStandardDrinks:
          activeSession.totalStandardDrinks + drink.standardDrinks,
        totalVolumeMl: activeSession.totalVolumeMl + drink.volumeMl,
      },
    });

    // Insert into Supabase
    supabase
      .from('drink_entries')
      .insert(drinkEntryToRow(drink, activeSession.id))
      .then(({ error }) => {
        if (error) console.error('Failed to insert drink entry:', error);
      });
  },

  // -----------------------------------------------------------------------
  // Remove a drink from the active session
  // -----------------------------------------------------------------------
  removeDrink: (drinkId) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const drinkToRemove = activeSession.drinks.find((d) => d.id === drinkId);
    if (!drinkToRemove) return;

    // Optimistic update
    set({
      activeSession: {
        ...activeSession,
        drinks: activeSession.drinks.filter((d) => d.id !== drinkId),
        totalStandardDrinks:
          activeSession.totalStandardDrinks - drinkToRemove.standardDrinks,
        totalVolumeMl:
          activeSession.totalVolumeMl - drinkToRemove.volumeMl,
      },
    });

    // Delete from Supabase
    supabase
      .from('drink_entries')
      .delete()
      .eq('id', drinkId)
      .then(({ error }) => {
        if (error) console.error('Failed to delete drink entry:', error);
      });
  },

  // -----------------------------------------------------------------------
  // Add a photo to the active session
  // -----------------------------------------------------------------------
  addPhoto: (photoDataUrl) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const newPhotos = [...activeSession.photos, photoDataUrl];

    // Optimistic update
    set({
      activeSession: {
        ...activeSession,
        photos: newPhotos,
      },
    });

    // Insert into session_photos
    supabase
      .from('session_photos')
      .insert({
        session_id: activeSession.id,
        storage_path: '',
        url: photoDataUrl,
        sort_order: newPhotos.length - 1,
      })
      .then(({ error }) => {
        if (error) console.error('Failed to insert session photo:', error);
      });
  },

  // -----------------------------------------------------------------------
  // Remove a photo from the active session
  // -----------------------------------------------------------------------
  removePhoto: (photoIndex) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const photoUrl = activeSession.photos[photoIndex];
    if (photoUrl === undefined) return;

    // Optimistic update
    set({
      activeSession: {
        ...activeSession,
        photos: activeSession.photos.filter((_, i) => i !== photoIndex),
      },
    });

    // Delete from Supabase by matching session + url
    supabase
      .from('session_photos')
      .delete()
      .eq('session_id', activeSession.id)
      .eq('url', photoUrl)
      .then(({ error }) => {
        if (error) console.error('Failed to delete session photo:', error);
      });
  },

  // -----------------------------------------------------------------------
  // Add a round to the active session (local-only for now)
  // -----------------------------------------------------------------------
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

  // -----------------------------------------------------------------------
  // Update the peak BAC estimate
  // -----------------------------------------------------------------------
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

      // Sync peak BAC to Supabase
      supabase
        .from('drink_sessions')
        .update({ peak_bac_estimate: bac })
        .eq('id', activeSession.id)
        .then(({ error }) => {
          if (error) console.error('Failed to update peak BAC:', error);
        });
    }
  },

  // -----------------------------------------------------------------------
  // Read helpers (from local state)
  // -----------------------------------------------------------------------
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
}));
