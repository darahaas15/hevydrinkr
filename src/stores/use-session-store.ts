import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DrinkSession, DrinkEntry, Round, SessionMood, UserProfile } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { useUIStore } from '@/stores/use-ui-store';
import { safeJSONStorage } from '@/lib/storage/safe-storage';
import {
  insertDrinkEntries,
  selectDrinkEntries,
  withOptionalCost,
} from '@/lib/supabase/drink-entries';
import { normalizeVenue } from '@/lib/venues';
import {
  spreadDrinkTimestamps,
  buildSessionSummary,
  durationMinutesBetween,
} from '@/lib/session-utils';

// Photo data URLs are huge (~100KB–1MB each, base64 PNG/JPG) and live in
// Supabase already — keeping them out of localStorage avoids QuotaExceededError.
// Drop the matching photoIds too so the parallel arrays stay aligned.
const stripPhotos = (s: DrinkSession): DrinkSession => ({ ...s, photos: [], photoIds: [] });

const SESSIONS_STALE_MS = 120_000;
const _sessionsLastFetched = new Map<string, number>();

interface SessionState {
  activeSession: DrinkSession | null;
  // Completed sessions, keyed by userId. Per-user so viewing another user's
  // profile doesn't clobber your own history (which would zero out the
  // streak calculation that filters by currentUser.id).
  sessionsByUser: Record<string, DrinkSession[]>;

  fetchSessions: (userId: string, force?: boolean) => Promise<void>;
  startSession: (venue: string, userId: string) => void;
  endSession: (mood: SessionMood) => void;
  abandonSession: () => void;
  addDrink: (drink: DrinkEntry) => void;
  removeDrink: (drinkId: string) => void;
  restoreDrink: (drink: DrinkEntry) => void;
  addPhoto: (photoDataUrl: string) => void;
  removePhoto: (photoIndex: number) => void;
  addRound: (round: Round) => void;
  updateVenue: (venue: string) => void;
  updatePeakBac: (bac: number) => void;
  getSessionById: (id: string) => DrinkSession | undefined;
  getSessionsByUser: (userId: string) => DrinkSession[];
  addCompletedSession: (session: DrinkSession) => void;

  // Log a fully-formed past session. One atomic client flow: insert session,
  // insert all drinks with spread timestamps, optionally insert photos. Refuses
  // to run if there's an active session. Caller handles feed post creation.
  createPastSession: (input: {
    user: UserProfile;
    venue: string;
    startedAt: string;
    endedAt: string;
    drinks: DrinkEntry[];
    mood: SessionMood;
    photos?: string[];
  }) => Promise<DrinkSession | null>;

  // Edit a completed session. Partial update of venue / start-end / mood.
  // If start/end change, re-spreads drink timestamps and recomputes duration.
  // Returns the updated session, or null on failure.
  updateSession: (
    sessionId: string,
    updates: {
      venue?: string;
      startedAt?: string;
      endedAt?: string;
      mood?: SessionMood;
    },
  ) => Promise<DrinkSession | null>;
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
    cost: typeof row.cost === 'number' ? row.cost : null,
  };
}

function rowToSession(
  row: Record<string, unknown>,
  drinks: DrinkEntry[],
  photos: string[],
  photoIds: string[],
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
    photoIds,
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

function drinkEntryToRow(entry: DrinkEntry, sessionId: string): Record<string, unknown> {
  return withOptionalCost(
    {
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
    },
    entry.cost,
  );
}

// Maps session temp-ID → promise that resolves when the row exists in Supabase.
// Scoped per session so abandoning session A doesn't affect session B.
const sessionInsertPromises = new Map<string, PromiseLike<void>>();

// Tracks pending DELETE requests per-drink so restoreDrink can await the
// delete before issuing the re-insert. Prevents PK conflicts when the user
// taps "Undo" faster than PostgREST can resolve the DELETE.
const drinkDeletePromises: Map<string, Promise<unknown>> = new Map();

// Increments every time a new session starts. Captured by addDrink closures
// so stale callbacks from abandoned sessions can detect they're orphaned.
let _sessionGeneration = 0;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSessionStore = create<SessionState>()(persist((set, get) => ({
  activeSession: null,
  sessionsByUser: {},

  // -----------------------------------------------------------------------
  // Fetch sessions from Supabase and hydrate local state
  // -----------------------------------------------------------------------
  fetchSessions: async (userId: string, force?: boolean) => {
    if (!userId) return;
    const last = _sessionsLastFetched.get(userId) ?? 0;
    if (!force && Date.now() - last < SESSIONS_STALE_MS) return;
    _sessionsLastFetched.set(userId, Date.now());

    const { data: sessionRows, error: sessionsError } = await supabase
      .from('drink_sessions')
      .select('id, user_id, status, started_at, ended_at, venue, total_standard_drinks, total_volume_ml, peak_bac_estimate, duration_minutes, is_party_mode, party_id, mood, notes')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });

    if (sessionsError || !sessionRows) {
      console.error('Failed to fetch sessions:', sessionsError);
      return;
    }

    const sessionIds = sessionRows.map((r) => r.id as string);

    // Fetch all drink entries and photos for these sessions in parallel
    const [entriesResult, photosResult] = await Promise.all([
      selectDrinkEntries(sessionIds),
      sessionIds.length > 0
        ? supabase
            .from('session_photos')
            .select('id, session_id, url, sort_order')
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

    // Group photos by session_id (URL + parallel id list, both sorted by sort_order)
    const photosBySession = new Map<string, string[]>();
    const photoIdsBySession = new Map<string, string[]>();
    for (const row of photoRows) {
      const r = row as Record<string, unknown>;
      const sid = r.session_id as string;
      if (!photosBySession.has(sid)) photosBySession.set(sid, []);
      if (!photoIdsBySession.has(sid)) photoIdsBySession.set(sid, []);
      photosBySession.get(sid)!.push(r.url as string);
      photoIdsBySession.get(sid)!.push(r.id as string);
    }

    // Build DrinkSession objects
    const sessions: DrinkSession[] = sessionRows.map((row) => {
      const id = row.id as string;
      return rowToSession(
        row as Record<string, unknown>,
        entriesBySession.get(id) ?? [],
        photosBySession.get(id) ?? [],
        photoIdsBySession.get(id) ?? [],
      );
    });

    const history = sessions.filter((s) => s.status !== 'active');
    const active = sessions.find((s) => s.status === 'active') ?? null;

    set((state) => ({
      // Only replace activeSession when the fetched user owns the current
      // active session — otherwise we'd wipe a different user's in-progress
      // session by merely viewing this profile.
      activeSession:
        active ?? (state.activeSession?.userId === userId ? null : state.activeSession),
      sessionsByUser: { ...state.sessionsByUser, [userId]: history },
    }));
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
      venue: normalizeVenue(venue),
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
      photoIds: [],
      photos: [],
    };

    // Optimistic update
    _sessionGeneration++;
    set({ activeSession: session });

    // Persist to Supabase, then reconcile the id.
    // Store the promise per session so addDrink can await it before inserting
    // drink_entries (otherwise the FK on session_id fails).
    const sessionTempId = session.id;
    sessionInsertPromises.set(sessionTempId, supabase
      .from('drink_sessions')
      .insert(sessionToRow(session))
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to create session in Supabase:', error);
          useUIStore.getState().addToast('Something went wrong', 'error');
          return;
        }
        if (data) {
          set((s) => ({
            activeSession: s.activeSession && s.activeSession.id === sessionTempId
              ? { ...s.activeSession, id: data.id as string }
              : s.activeSession,
          }));
        }
      }));
  },

  // -----------------------------------------------------------------------
  // End the active session
  // -----------------------------------------------------------------------
  endSession: (mood) => {
    const { activeSession, sessionsByUser } = get();
    if (!activeSession) return;
    const ownerId = activeSession.userId;

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
    sessionInsertPromises.clear();
    const ownerHistory = sessionsByUser[ownerId] ?? [];
    set({
      activeSession: null,
      sessionsByUser: {
        ...sessionsByUser,
        [ownerId]: [completedSession, ...ownerHistory],
      },
    });

    // Sync to Supabase. Roll the optimistic completion back if the DB
    // refuses, otherwise local state shows a "ghost" completed session that
    // never made it to the server (and would be silently dropped from
    // leaderboards which only count status='completed' rows).
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
        if (!error) return;
        console.error('Failed to end session in Supabase:', error);
        // Roll back: restore as the active session and remove the optimistic
        // completed entry from history.
        set((state) => {
          const owner = state.sessionsByUser[ownerId] ?? [];
          return {
            activeSession: state.activeSession ?? activeSession,
            sessionsByUser: {
              ...state.sessionsByUser,
              [ownerId]: owner.filter((s) => s.id !== completedSession.id),
            },
          };
        });
        useUIStore.getState().addToast('Something went wrong', 'error');
      });
  },

  // -----------------------------------------------------------------------
  // Abandon the active session
  // -----------------------------------------------------------------------
  abandonSession: () => {
    const { activeSession } = get();
    if (!activeSession) return;

    const abandoned = activeSession;
    const sessionId = abandoned.id;
    sessionInsertPromises.clear();

    // Clear local state — don't add to history
    set({ activeSession: null });

    // Delete from Supabase entirely (cascades to drink_entries, photos, etc.).
    // Restore the active session if the delete fails — otherwise the row
    // remains as 'active' in DB and the next fetchSessions would resurrect it
    // anyway, but the user would see "no active session" until that happens.
    supabase
      .from('drink_sessions')
      .delete()
      .eq('id', sessionId)
      .then(({ error }) => {
        if (!error) return;
        console.error('Failed to delete abandoned session:', error);
        set((state) => ({ activeSession: state.activeSession ?? abandoned }));
        useUIStore.getState().addToast('Something went wrong', 'error');
      });
  },

  // -----------------------------------------------------------------------
  // Add a drink to the active session
  // -----------------------------------------------------------------------
  addDrink: (drink) => {
    const { activeSession } = get();
    if (!activeSession) return;

    // Optimistic update — UI reflects the drink immediately.
    // Coerce in case persisted state is missing fields from an older schema.
    const existingDrinks = activeSession.drinks ?? [];
    const newDrinks = [...existingDrinks, drink];
    const newTotalStd = (activeSession.totalStandardDrinks ?? 0) + drink.standardDrinks;
    set({
      activeSession: {
        ...activeSession,
        drinks: newDrinks,
        totalStandardDrinks: newTotalStd,
        totalVolumeMl: (activeSession.totalVolumeMl ?? 0) + drink.volumeMl,
      },
    });

    // Wait for the session row to exist in Supabase before inserting the
    // drink_entry (its session_id FK would fail otherwise).
    const insertPromise = sessionInsertPromises.get(activeSession.id) ?? Promise.resolve();
    const gen = _sessionGeneration;
    insertPromise.then(() => {
      // If the session was abandoned/ended and a new one started, generation
      // will have changed — bail so we don't insert under the wrong session.
      const current = get().activeSession;
      if (!current || _sessionGeneration !== gen) return;
      const sid = current.id;
      insertDrinkEntries([drinkEntryToRow(drink, sid)]).then(({ error }) => {
        if (error) console.error('Failed to insert drink entry:', error);
      });
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
    const remainingDrinks = activeSession.drinks.filter((d) => d.id !== drinkId);
    const remainingStd = activeSession.totalStandardDrinks - drinkToRemove.standardDrinks;
    set({
      activeSession: {
        ...activeSession,
        drinks: remainingDrinks,
        totalStandardDrinks: remainingStd,
        totalVolumeMl: activeSession.totalVolumeMl - drinkToRemove.volumeMl,
      },
    });

    // Delete from Supabase
    const deletePromise: Promise<unknown> = Promise.resolve(
      supabase
        .from('drink_entries')
        .delete()
        .eq('id', drinkId)
        .then(({ error }) => {
          if (error) console.error('Failed to delete drink entry:', error);
        }),
    ).finally(() => {
      // Only clear if the current pending promise is still this one.
      if (drinkDeletePromises.get(drinkId) === deletePromise) {
        drinkDeletePromises.delete(drinkId);
      }
    });
    drinkDeletePromises.set(drinkId, deletePromise);
  },

  // -----------------------------------------------------------------------
  // Re-insert a previously removed drink (used by undo). Optimistic + DB insert.
  // No-op if the session is no longer active or was replaced.
  // -----------------------------------------------------------------------
  restoreDrink: (drink) => {
    const { activeSession } = get();
    if (!activeSession) return;
    // Prevent duplicate inserts if user taps undo twice or the drink
    // somehow survived removal.
    if (activeSession.drinks.some((d) => d.id === drink.id)) return;

    set({
      activeSession: {
        ...activeSession,
        drinks: [...activeSession.drinks, drink],
        totalStandardDrinks: (activeSession.totalStandardDrinks ?? 0) + drink.standardDrinks,
        totalVolumeMl: (activeSession.totalVolumeMl ?? 0) + drink.volumeMl,
      },
    });

    const insertPromise = sessionInsertPromises.get(activeSession.id) ?? Promise.resolve();
    // Wait for any in-flight DELETE of this drink id to finish before re-inserting.
    // Otherwise the INSERT can race ahead and fail with a PK conflict.
    const deletePromise = drinkDeletePromises.get(drink.id) ?? Promise.resolve();
    const gen = _sessionGeneration;
    Promise.all([insertPromise, deletePromise]).then(() => {
      const current = get().activeSession;
      if (!current || _sessionGeneration !== gen) return;
      const sid = current.id;
      insertDrinkEntries([drinkEntryToRow(drink, sid)]).then(({ error }) => {
        if (error) {
          console.error('Failed to restore drink entry:', error);
          useUIStore.getState().addToast('Could not restore drink — add it again', 'error');
        }
      });
    });
  },

  // -----------------------------------------------------------------------
  // Add a photo to the active session
  // -----------------------------------------------------------------------
  addPhoto: (photoDataUrl) => {
    const { activeSession } = get();
    if (!activeSession) return;

    // Generate the row id client-side so we can record it locally before
    // the Supabase insert returns, and so removePhoto can later target the
    // exact row even if two photos share the same data URL.
    const newPhotoId = crypto.randomUUID();
    const newPhotos = [...activeSession.photos, photoDataUrl];
    const newPhotoIds = [...(activeSession.photoIds ?? []), newPhotoId];

    // Optimistic update
    set({
      activeSession: {
        ...activeSession,
        photos: newPhotos,
        photoIds: newPhotoIds,
      },
    });

    // Wait for session row to exist, then insert photo
    const photoInsertPromise = sessionInsertPromises.get(activeSession.id) ?? Promise.resolve();
    photoInsertPromise.then(() => {
      const current = get().activeSession;
      if (!current) return;
      const sid = current.id;
      supabase
        .from('session_photos')
        .insert({
          id: newPhotoId,
          session_id: sid,
          storage_path: '',
          url: photoDataUrl,
          sort_order: newPhotos.length - 1,
        })
        .then(({ error }) => {
          if (error) console.error('Failed to insert session photo:', error);
        });
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
    const photoIds = activeSession.photoIds ?? [];
    const photoId = photoIds[photoIndex];

    // Optimistic update — drop both arrays at the same index.
    set({
      activeSession: {
        ...activeSession,
        photos: activeSession.photos.filter((_, i) => i !== photoIndex),
        photoIds: photoIds.filter((_, i) => i !== photoIndex),
      },
    });

    // Delete by row id when we have one (correct even with duplicate URLs).
    // Fall back to URL-match for older sessions persisted before photoIds
    // existed — limit to one to avoid wiping duplicates.
    if (photoId) {
      supabase
        .from('session_photos')
        .delete()
        .eq('id', photoId)
        .then(({ error }) => {
          if (error) console.error('Failed to delete session photo:', error);
        });
    } else {
      supabase
        .from('session_photos')
        .select('id')
        .eq('session_id', activeSession.id)
        .eq('url', photoUrl)
        .limit(1)
        .then(({ data, error }) => {
          if (error || !data?.[0]) {
            if (error) console.error('Failed to look up session photo:', error);
            return;
          }
          supabase
            .from('session_photos')
            .delete()
            .eq('id', data[0].id)
            .then(({ error: delErr }) => {
              if (delErr) console.error('Failed to delete session photo:', delErr);
            });
        });
    }
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
  // Update the venue of the active session
  // -----------------------------------------------------------------------
  updateVenue: (rawVenue) => {
    const { activeSession } = get();
    if (!activeSession) return;
    const venue = normalizeVenue(rawVenue);

    set({ activeSession: { ...activeSession, venue } });

    supabase
      .from('drink_sessions')
      .update({ venue })
      .eq('id', activeSession.id)
      .then(({ error }) => {
        if (error) console.error('Failed to update venue:', error);
      });
  },

  // -----------------------------------------------------------------------
  // Update the peak BAC estimate
  // -----------------------------------------------------------------------
  updatePeakBac: (bac) => {
    const { activeSession } = get();
    if (!activeSession) return;
    if (!Number.isFinite(bac)) return;

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
    const { activeSession, sessionsByUser } = get();
    if (activeSession?.id === id) return activeSession;
    for (const list of Object.values(sessionsByUser)) {
      const found = list.find((s) => s.id === id);
      if (found) return found;
    }
    return undefined;
  },

  getSessionsByUser: (userId) => get().sessionsByUser[userId] ?? [],

  addCompletedSession: (session) =>
    set((state) => {
      const existing = state.sessionsByUser[session.userId] ?? [];
      return {
        sessionsByUser: {
          ...state.sessionsByUser,
          [session.userId]: [session, ...existing],
        },
      };
    }),

  // -----------------------------------------------------------------------
  // Create a past / backdated session in one atomic flow.
  // -----------------------------------------------------------------------
  createPastSession: async ({ user, venue: rawVenue, startedAt, endedAt, drinks, mood, photos }) => {
    const venue = normalizeVenue(rawVenue);
    if (get().activeSession) {
      useUIStore.getState().addToast('End your active session first', 'error');
      return null;
    }

    const sessionId = crypto.randomUUID();
    const durationMinutes = durationMinutesBetween(startedAt, endedAt);
    const totalStandardDrinks = drinks.reduce((s, d) => s + d.standardDrinks, 0);
    const totalVolumeMl = drinks.reduce((s, d) => s + d.volumeMl, 0);

    // Spread drink timestamps evenly across the session window. Overwrite
    // whatever the caller put on each DrinkEntry — the form has no
    // per-drink time UI (see spec: "shopping-cart model").
    const timestamps = spreadDrinkTimestamps(startedAt, endedAt, drinks.length);
    const drinksWithIds: DrinkEntry[] = drinks.map((d, i) => ({
      ...d,
      id: crypto.randomUUID(),
      timestamp: timestamps[i],
      roundId: null,
    }));

    const completed: DrinkSession = {
      id: sessionId,
      userId: user.id,
      status: 'completed',
      startedAt,
      endedAt,
      venue,
      drinks: drinksWithIds,
      rounds: [],
      totalStandardDrinks,
      totalVolumeMl,
      peakBacEstimate: 0,
      durationMinutes,
      isPartyMode: false,
      partyId: null,
      prsAchieved: [],
      mood,
      notes: '',
      photos: photos ?? [],
      photoIds: [],
    };

    // Insert session row first — drink_entries FK requires it to exist.
    const { error: sessionError } = await supabase
      .from('drink_sessions')
      .insert(sessionToRow(completed));

    if (sessionError) {
      console.error('Failed to insert past session:', sessionError);
      useUIStore.getState().addToast('Something went wrong', 'error');
      return null;
    }

    // Insert drink entries in bulk. If this fails, clean up the session row
    // so we don't leave an empty shell behind.
    if (drinksWithIds.length > 0) {
      const { error: drinksError } = await insertDrinkEntries(
        drinksWithIds.map((d) => drinkEntryToRow(d, sessionId)),
      );
      if (drinksError) {
        console.error('Failed to insert past session drinks:', drinksError);
        await supabase.from('drink_sessions').delete().eq('id', sessionId);
        useUIStore.getState().addToast('Something went wrong', 'error');
        return null;
      }
    }

    // Insert photos (if any). Non-fatal on failure — the session is still
    // valid without them, user can re-upload later.
    const photoIds: string[] = [];
    if (photos && photos.length > 0) {
      const photoRows = photos.map((url, i) => {
        const id = crypto.randomUUID();
        photoIds.push(id);
        return {
          id,
          session_id: sessionId,
          storage_path: '',
          url,
          sort_order: i,
        };
      });
      const { error: photoErr } = await supabase
        .from('session_photos')
        .insert(photoRows);
      if (photoErr) console.error('Failed to insert past session photos:', photoErr);
    }

    const finalSession: DrinkSession = { ...completed, photoIds };

    // Add to local history so profile stats / session detail work immediately.
    set((state) => {
      const existing = state.sessionsByUser[user.id] ?? [];
      return {
        sessionsByUser: {
          ...state.sessionsByUser,
          [user.id]: [finalSession, ...existing],
        },
      };
    });

    return finalSession;
  },

  // -----------------------------------------------------------------------
  // Edit a completed session's venue / times / mood.
  // -----------------------------------------------------------------------
  updateSession: async (sessionId, updates) => {
    // Find the session in local state. Active sessions aren't editable here.
    let target: DrinkSession | undefined;
    let ownerId: string | undefined;
    const { sessionsByUser } = get();
    for (const [uid, list] of Object.entries(sessionsByUser)) {
      const found = list.find((s) => s.id === sessionId);
      if (found) {
        target = found;
        ownerId = uid;
        break;
      }
    }
    if (!target || !ownerId) {
      console.warn('updateSession: no session found', sessionId);
      return null;
    }
    if (target.status !== 'completed') {
      useUIStore.getState().addToast('Only completed sessions can be edited', 'error');
      return null;
    }

    const newStart = updates.startedAt ?? target.startedAt;
    const newEnd = updates.endedAt ?? target.endedAt ?? target.startedAt;
    const timingChanged =
      updates.startedAt !== undefined || updates.endedAt !== undefined;

    const newDuration = timingChanged
      ? durationMinutesBetween(newStart, newEnd)
      : target.durationMinutes;

    // Re-spread drink timestamps if the session window moved. Preserves
    // drink.id so edits round-trip without orphaning drink_entries rows.
    const newDrinks: DrinkEntry[] = timingChanged
      ? (() => {
          const stamps = spreadDrinkTimestamps(newStart, newEnd, target!.drinks.length);
          return target!.drinks.map((d, i) => ({ ...d, timestamp: stamps[i] }));
        })()
      : target.drinks;

    const normalizedVenue =
      updates.venue !== undefined ? normalizeVenue(updates.venue) : undefined;

    const updated: DrinkSession = {
      ...target,
      venue: normalizedVenue ?? target.venue,
      startedAt: newStart,
      endedAt: newEnd,
      mood: updates.mood ?? target.mood,
      durationMinutes: newDuration,
      drinks: newDrinks,
    };

    // Optimistic local state update.
    const prevByUser = sessionsByUser;
    set({
      sessionsByUser: {
        ...sessionsByUser,
        [ownerId]: (sessionsByUser[ownerId] ?? []).map((s) =>
          s.id === sessionId ? updated : s,
        ),
      },
    });

    // Update the session row in Supabase with only changed fields.
    const dbUpdates: Record<string, unknown> = {};
    if (normalizedVenue !== undefined) dbUpdates.venue = normalizedVenue;
    if (updates.startedAt !== undefined) dbUpdates.started_at = updates.startedAt;
    if (updates.endedAt !== undefined) dbUpdates.ended_at = updates.endedAt;
    if (updates.mood !== undefined) dbUpdates.mood = updates.mood;
    if (timingChanged) dbUpdates.duration_minutes = newDuration;

    const { error: sessionError } = await supabase
      .from('drink_sessions')
      .update(dbUpdates)
      .eq('id', sessionId);

    if (sessionError) {
      console.error('Failed to update session:', sessionError);
      set({ sessionsByUser: prevByUser });
      useUIStore.getState().addToast('Something went wrong', 'error');
      return null;
    }

    // If the window moved, sync the new per-drink timestamps to the DB.
    // One UPDATE per drink — cheap for a handful, and simpler than upserts.
    if (timingChanged && newDrinks.length > 0) {
      await Promise.all(
        newDrinks.map((d) =>
          supabase
            .from('drink_entries')
            .update({ timestamp: d.timestamp })
            .eq('id', d.id),
        ),
      );
    }

    return updated;
  },
}), {
  name: 'hd-sessions',
  version: 2,
  storage: safeJSONStorage(),
  // If you add a new persisted field, update this migrate's empty-shape return too.
  // The cache is purely a snappiness optimization — dropping it on version mismatch
  // is safe; fetchSessions rebuilds on next mount.
  // Shape unchanged from v1 — the version bump just forces a one-time clean
  // hydrate so users don't sit on an oversized v1 cache between hydrate and
  // the next persist write.
  migrate: (_persisted, fromVersion) => {
    if (fromVersion < 2) return { activeSession: null, sessionsByUser: {} };
    return _persisted as { activeSession: DrinkSession | null; sessionsByUser: Record<string, DrinkSession[]> };
  },
  partialize: (s) => ({
    activeSession: s.activeSession ? stripPhotos(s.activeSession) : null,
    sessionsByUser: Object.fromEntries(
      Object.entries(s.sessionsByUser).map(([uid, list]) => [
        uid,
        list.slice(0, 30).map(stripPhotos),
      ]),
    ),
  }),
}));
