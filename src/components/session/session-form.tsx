'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Plus, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { DrinkSession, DrinkEntry, SessionMood, FeedItem, UserProfile } from '@/types';
import { useAuthStore } from '@/stores/use-auth-store';
import { useSessionStore } from '@/stores/use-session-store';
import { useFeedStore } from '@/stores/use-feed-store';
import { useProfileStore } from '@/stores/use-profile-store';
import { useUIStore } from '@/stores/use-ui-store';
import { DrinkPicker } from '@/components/session/drink-picker';
import { DrinkCart, type DrinkCartItem } from '@/components/session/drink-cart';
import { TagPeopleField } from '@/components/session/tag-people-picker';
import { DateTimeField } from '@/components/ui/datetime-field';
import { VenueInput } from '@/components/ui/venue-input';
import { useVenueStats } from '@/hooks/use-venue-stats';
import { canonicalizeVenue } from '@/lib/venues';
import { PhotoGallery } from '@/components/ui/photo-gallery';
import { pickImage, uploadImage } from '@/lib/image-utils';
import { detectPRs } from '@/lib/algorithms/pr-detection';
import {
  validateSessionForm,
  durationMinutesBetween,
  buildSessionSummary,
  spreadDrinkTimestamps,
} from '@/lib/session-utils';
import { formatDuration } from '@/lib/utils';
import { hapticLight, hapticSuccess, hapticWarning } from '@/lib/haptics';

// Aggregate-by-drink-definition shopping-cart row.
interface CartItem {
  key: string; // group key — usually drinkDefinitionId, but drink.id for legacy
  template: DrinkEntry; // any one instance — name/emoji/abv come from it
  quantity: number;
}

function groupDrinksIntoCart(drinks: DrinkEntry[]): CartItem[] {
  const map = new Map<string, CartItem>();
  const order: string[] = [];
  for (const d of drinks) {
    // Legacy rows edited via the old modal have drinkDefinitionId === 'edited'.
    // Don't collapse them into one row — key by drink.id so each legacy drink
    // stays distinct. Otherwise touching the cart would rewrite disparate
    // drinks to a single template.
    const key = d.drinkDefinitionId === 'edited' ? d.id : d.drinkDefinitionId;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += 1;
    } else {
      order.push(key);
      map.set(key, { key, template: d, quantity: 1 });
    }
  }
  return order.map((id) => map.get(id)!);
}

const MOODS: Array<{ value: SessionMood; emoji: string }> = [
  { value: 'legendary', emoji: '🤩' },
  { value: 'great', emoji: '😄' },
  { value: 'good', emoji: '🙂' },
  { value: 'meh', emoji: '😐' },
  { value: 'rough', emoji: '🤢' },
];

// Default start / end for new past sessions: yesterday 8pm → 11pm local.
function defaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(20, 0, 0, 0);
  return d.toISOString();
}
function defaultEnd(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(23, 0, 0, 0);
  return d.toISOString();
}

interface SessionFormProps {
  mode: 'create-past' | 'edit';
  existingSession?: DrinkSession; // required for edit
  existingFeedItem?: FeedItem | null; // optional for edit (caption source)
}

export function SessionForm({ mode, existingSession, existingFeedItem }: SessionFormProps) {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const activeSession = useSessionStore((s) => s.activeSession);
  const createPastSession = useSessionStore((s) => s.createPastSession);
  const updateSession = useSessionStore((s) => s.updateSession);
  const createFeedItemFromSession = useFeedStore((s) => s.createFeedItemFromSession);
  const updateFeedItem = useFeedStore((s) => s.updateFeedItem);
  const addPR = useProfileStore((s) => s.addPR);
  const recordsByUser = useProfileStore((s) => s.recordsByUser);
  const addToast = useUIStore((s) => s.addToast);
  const setHideBottomNav = useUIStore((s) => s.setHideBottomNav);
  const venueStats = useVenueStats();

  // Hide the app's bottom tab bar while the form is open so the sticky
  // Save button isn't obscured.
  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  const [venue, setVenue] = useState(existingSession?.venue ?? '');
  const [startedAt, setStartedAt] = useState(existingSession?.startedAt ?? defaultStart());
  const [endedAt, setEndedAt] = useState(
    existingSession?.endedAt ?? existingSession?.startedAt ?? defaultEnd(),
  );
  const [mood, setMood] = useState<SessionMood>(existingSession?.mood ?? 'good');
  const [caption, setCaption] = useState(existingFeedItem?.caption ?? '');
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>(existingFeedItem?.taggedUserIds ?? []);

  // Cart — initialized from existing drinks in edit mode.
  const [cart, setCart] = useState<CartItem[]>(() =>
    mode === 'edit' && existingSession ? groupDrinksIntoCart(existingSession.drinks) : [],
  );
  const [showPicker, setShowPicker] = useState(false);

  // Photos — initialized from existing photos in edit mode.
  const [photos, setPhotos] = useState<string[]>(
    () => existingSession?.photos ?? [],
  );

  const [submitting, setSubmitting] = useState(false);

  const totalDrinks = cart.reduce((s, c) => s + c.quantity, 0);
  const totalStandardDrinks = cart.reduce(
    (s, c) => s + c.template.standardDrinks * c.quantity,
    0,
  );

  const durationMin = durationMinutesBetween(startedAt, endedAt);

  // Expand cart rows into individual DrinkEntry instances on submit.
  const drinksForSubmit = useMemo<DrinkEntry[]>(() => {
    const out: DrinkEntry[] = [];
    for (const c of cart) {
      for (let i = 0; i < c.quantity; i++) {
        out.push({ ...c.template, id: crypto.randomUUID() });
      }
    }
    return out;
  }, [cart]);

  const validationError = useMemo(() => {
    return validateSessionForm({
      venue,
      startedAt,
      endedAt,
      drinks: drinksForSubmit,
      mood,
    });
  }, [venue, startedAt, endedAt, drinksForSubmit, mood]);

  // Block create-past if there's an active session — drinks would be ambiguous.
  const blocked = mode === 'create-past' && !!activeSession;

  // ── Handlers ─────────────────────────────────────────────────────────
  const addToCart = (drink: DrinkEntry) => {
    setCart((prev) => {
      // New drinks from the picker always have a real drinkDefinitionId.
      const key = drink.drinkDefinitionId;
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        return prev.map((c) =>
          c.key === key ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [...prev, { key, template: drink, quantity: 1 }];
    });
    setShowPicker(false);
    hapticLight();
  };

  const incCart = (key: string) =>
    setCart((prev) =>
      prev.map((c) => (c.key === key ? { ...c, quantity: c.quantity + 1 } : c)),
    );
  const decCart = (key: string) =>
    setCart((prev) =>
      prev
        .map((c) => (c.key === key ? { ...c, quantity: c.quantity - 1 } : c))
        .filter((c) => c.quantity > 0),
    );
  const removeCart = (key: string) =>
    setCart((prev) => prev.filter((c) => c.key !== key));

  const handleAddPhoto = async () => {
    const file = await pickImage();
    if (!file) return;
    try {
      const url = await uploadImage(file, 'photos');
      setPhotos((prev) => [...prev, url]);
    } catch {
      addToast("Couldn't upload photo", 'error');
    }
  };

  const removePhoto = (i: number) =>
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));

  // ── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (submitting) return;
    if (!currentUser) return;
    if (validationError) {
      hapticWarning();
      addToast(validationError, 'error');
      return;
    }
    setSubmitting(true);

    if (mode === 'create-past') {
      const user: UserProfile = currentUser;
      const created = await createPastSession({
        user,
        venue: canonicalizeVenue(venue, venueStats),
        startedAt,
        endedAt,
        drinks: drinksForSubmit,
        mood,
        photos,
      });
      if (!created) {
        setSubmitting(false);
        return;
      }

      // Detect PRs on the new session — matches live-session behavior.
      const newPRs = detectPRs(created, recordsByUser[currentUser.id] ?? []);
      newPRs.forEach((pr) => addPR(pr));
      // Backdated PR celebration would be confusing (user didn't just achieve it),
      // so we skip the celebration modal but still record the PR.

      await createFeedItemFromSession(created, user, caption, taggedUserIds, /* isBackfilled */ true);

      hapticSuccess();
      addToast('Past session logged', 'success');
      router.replace(`/session?id=${created.id}`);
      return;
    }

    // Edit mode
    if (!existingSession) {
      setSubmitting(false);
      return;
    }

    // Step 1: sync session metadata (venue/times/mood) via updateSession.
    const updates: Parameters<typeof updateSession>[1] = {};
    const nextVenue = canonicalizeVenue(venue, venueStats);
    if (nextVenue !== existingSession.venue) updates.venue = nextVenue;
    if (startedAt !== existingSession.startedAt) updates.startedAt = startedAt;
    if (endedAt !== (existingSession.endedAt ?? existingSession.startedAt))
      updates.endedAt = endedAt;
    if (mood !== existingSession.mood) updates.mood = mood;

    let updatedSession = existingSession;
    if (Object.keys(updates).length > 0) {
      const result = await updateSession(existingSession.id, updates);
      if (!result) {
        setSubmitting(false);
        return;
      }
      updatedSession = result;
    }

    // Step 2: detect drink / photo / caption changes and sync via updateFeedItem.
    const originalDrinksCount = existingSession.drinks.length;
    const originalGroupCounts = new Map<string, number>();
    for (const d of existingSession.drinks) {
      // Mirror the same keying logic as groupDrinksIntoCart so the comparison
      // is apples-to-apples: legacy 'edited' drinks key by drink.id, not by
      // drinkDefinitionId (which would be 'edited' for all of them).
      const groupKey = d.drinkDefinitionId === 'edited' ? d.id : d.drinkDefinitionId;
      originalGroupCounts.set(groupKey, (originalGroupCounts.get(groupKey) ?? 0) + 1);
    }
    const newGroupCounts = new Map<string, number>();
    for (const c of cart) newGroupCounts.set(c.key, c.quantity);

    let drinksChanged = drinksForSubmit.length !== originalDrinksCount;
    if (!drinksChanged) {
      if (originalGroupCounts.size !== newGroupCounts.size) {
        drinksChanged = true;
      } else {
        for (const [key, count] of newGroupCounts) {
          if (originalGroupCounts.get(key) !== count) {
            drinksChanged = true;
            break;
          }
        }
      }
    }

    const originalPhotos = existingSession.photos ?? [];
    const photosChanged =
      photos.length !== originalPhotos.length ||
      photos.some((p, i) => p !== originalPhotos[i]);
    const captionChanged = !!existingFeedItem && caption !== existingFeedItem.caption;
    const prevTags = existingFeedItem?.taggedUserIds ?? [];
    const taggedChanged =
      !!existingFeedItem &&
      (taggedUserIds.length !== prevTags.length ||
        taggedUserIds.some((id) => !prevTags.includes(id)));

    if (existingFeedItem && (drinksChanged || photosChanged || captionChanged || taggedChanged)) {
      // When drink count changes, re-spread timestamps across the (possibly
      // updated) session window so derived analytics stay honest.
      let drinksToPersist = drinksForSubmit;
      if (drinksChanged && drinksToPersist.length > 0) {
        const stamps = spreadDrinkTimestamps(
          updatedSession.startedAt,
          updatedSession.endedAt ?? updatedSession.startedAt,
          drinksToPersist.length,
        );
        drinksToPersist = drinksToPersist.map((d, i) => ({
          ...d,
          timestamp: stamps[i],
        }));
      }

      const nextSession: DrinkSession = {
        ...updatedSession,
        drinks: drinksChanged ? drinksToPersist : updatedSession.drinks,
        totalStandardDrinks: drinksChanged
          ? drinksToPersist.reduce((s, d) => s + d.standardDrinks, 0)
          : updatedSession.totalStandardDrinks,
        totalVolumeMl: drinksChanged
          ? drinksToPersist.reduce((s, d) => s + d.volumeMl, 0)
          : updatedSession.totalVolumeMl,
      };

      const feedUpdates: Parameters<typeof updateFeedItem>[1] = {};
      if (captionChanged) feedUpdates.caption = caption;
      if (photosChanged) feedUpdates.photos = photos;
      if (taggedChanged) feedUpdates.taggedUserIds = taggedUserIds;
      if (drinksChanged) {
        // buildSessionSummary uses the session's current venue/duration/mood,
        // so we feed it the post-updateSession state.
        feedUpdates.sessionSummary = buildSessionSummary(nextSession);
      } else if (
        updates.venue !== undefined ||
        updates.startedAt !== undefined ||
        updates.endedAt !== undefined ||
        updates.mood !== undefined
      ) {
        // Metadata-only change: keep the existing behavior of regenerating
        // the summary so the feed card stays in sync.
        feedUpdates.sessionSummary = buildSessionSummary(updatedSession);
      }

      await updateFeedItem(existingFeedItem.id, feedUpdates);
    } else if (
      existingFeedItem &&
      (updates.venue !== undefined ||
        updates.startedAt !== undefined ||
        updates.endedAt !== undefined ||
        updates.mood !== undefined)
    ) {
      // Metadata changed but no drink/photo/caption change — still refresh
      // the feed card's session_summary.
      await updateFeedItem(existingFeedItem.id, {
        sessionSummary: buildSessionSummary(updatedSession),
      });
    }

    hapticSuccess();
    addToast('Session updated', 'success');
    router.replace(`/session?id=${existingSession.id}`);
  };

  // ── Render ───────────────────────────────────────────────────────────
  if (blocked) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-8 text-center">
        <p className="text-lg font-bold mb-2">Active session in progress</p>
        <p className="text-sm text-fg-secondary mb-6">End your current session before logging a past one.</p>
        <button
          onClick={() => router.push('/session')}
          className="px-5 py-3 rounded-xl bg-accent text-accent-foreground font-bold text-sm"
        >
          Go to active session
        </button>
      </div>
    );
  }

  const title = mode === 'create-past' ? 'Log past session' : 'Edit session';
  const submitLabel = mode === 'create-past' ? 'Save session' : 'Save changes';

  return (
    <div className="min-h-full pb-28">
      {/* Header */}
      <div
        className="sticky top-0 z-20 safe-top"
        style={{
          background: 'var(--chrome-bg)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          borderBottom: '1px solid var(--chrome-border)',
        }}
      >
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 active:text-foreground">
            <ChevronLeft className="w-6 h-6 text-muted-foreground" />
          </button>
          <h1 className="text-lg font-bold">{title}</h1>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Venue */}
        <div className="block">
          <span className="text-[11px] text-fg-secondary mb-1.5 block">Venue</span>
          <VenueInput
            value={venue}
            onChange={setVenue}
            venues={venueStats}
            placeholder="Where were you drinking?"
            iconClassName="w-4 h-4"
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-surface-secondary border border-card-border text-[13px] text-foreground placeholder:text-muted focus:outline-none focus:border-accent/40 transition-colors"
          />
        </div>

        {/* Start / End */}
        <div className="grid grid-cols-1 gap-3">
          <DateTimeField
            label="Started"
            value={startedAt}
            onChange={setStartedAt}
            max={new Date().toISOString()}
          />
          <DateTimeField
            label="Ended"
            value={endedAt}
            onChange={setEndedAt}
            max={new Date().toISOString()}
            min={startedAt}
          />
          {durationMin > 0 && (
            <p className="text-[11px] text-fg-secondary -mt-1">
              Duration: <span className="text-fg-strong font-medium">{formatDuration(durationMin)}</span>
            </p>
          )}
        </div>

        {/* Drinks */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-fg-secondary">
              Drinks {totalDrinks > 0 && `(${totalDrinks})`}
            </span>
            <button
              onClick={() => { hapticLight(); setShowPicker(true); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/10 text-accent text-[11px] font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          {cart.length === 0 && (
            <button
              onClick={() => { hapticLight(); setShowPicker(true); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-6 rounded-2xl border border-dashed border-border-strong active:bg-card text-fg-secondary text-sm"
            >
              <Plus className="w-4 h-4" />
              Add a drink
            </button>
          )}

          {cart.length > 0 && (
            <DrinkCart
              items={cart.map<DrinkCartItem>((c) => ({
                key: c.key,
                template: c.template,
                quantity: c.quantity,
              }))}
              onInc={incCart}
              onDec={decCart}
              onRemove={removeCart}
              totalStandardDrinks={totalStandardDrinks}
            />
          )}

        </div>

        {/* Mood */}
        <div>
          <span className="text-[11px] text-fg-secondary mb-2 block">How was it?</span>
          <div className="flex justify-between">
            {MOODS.map((m) => (
              <button
                key={m.value}
                onClick={() => { hapticLight(); setMood(m.value); }}
                aria-label={m.value}
                className={`p-2.5 rounded-xl transition-all ${
                  mood === m.value ? 'bg-accent/10 ring-1 ring-accent/30 scale-105' : ''
                }`}
              >
                <span className="text-2xl">{m.emoji}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Caption */}
        <label className="block">
          <span className="text-[11px] text-fg-secondary mb-1.5 block">Caption</span>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption (optional)"
            rows={2}
            className="w-full px-4 py-3 rounded-2xl bg-surface-secondary border border-card-border text-[13px] text-foreground placeholder:text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none"
          />
        </label>

        {/* Tag people */}
        <div>
          <span className="text-[11px] text-fg-secondary mb-1.5 block">Tag people</span>
          <TagPeopleField value={taggedUserIds} onChange={setTaggedUserIds} />
        </div>

        {/* Photos */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-fg-secondary">
              Photos {photos.length > 0 && `(${photos.length})`}
            </span>
            <button
              onClick={handleAddPhoto}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-subtle text-muted-foreground text-[11px] font-semibold active:bg-surface-strong"
            >
              <Camera className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
          {photos.length > 0 && <PhotoGallery photos={photos} onRemove={removePhoto} />}
        </div>

        {/* Inline validation hint */}
        {validationError && (
          <p className="text-[11px] text-danger-fg/80 text-center">{validationError}</p>
        )}
      </div>

      {/* Sticky submit */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-5 py-4 safe-bottom"
        style={{
          background: 'var(--chrome-strong-bg)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          borderTop: '1px solid var(--chrome-border)',
        }}
      >
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={!!validationError || submitting}
          className="w-full py-4 rounded-2xl bg-accent text-accent-foreground font-bold text-base disabled:opacity-30 transition-all"
        >
          {submitting ? 'Saving…' : submitLabel}
        </motion.button>
      </div>

      {/* Drink picker */}
      <AnimatePresence>
        {showPicker && (
          <DrinkPicker onSelect={addToCart} onClose={() => setShowPicker(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
