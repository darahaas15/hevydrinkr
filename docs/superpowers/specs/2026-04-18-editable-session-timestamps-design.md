# Editable session timestamps + past-session logging

**Date:** 2026-04-18
**Status:** approved, in implementation

## Goal

Let users log past sessions (not just live ones) and edit the start/end datetime + venue + mood of completed sessions. Live session flow stays untouched.

## Flows

1. **Live session** — unchanged. Start from Sesh tab, timer runs, BAC gauge, FAB to add drinks, end with mood/caption.
2. **Log past session** — new entry point on the session start screen ("Log past session" ghost button). Opens a form: venue, start datetime, end datetime, drinks (shopping-cart with quantity), mood, caption, photos. Saves as completed session.
3. **Edit completed session** — "Edit" button on `/session/[id]` detail page (owner only). Same form as past-session, pre-filled.

## Drink timestamps (past-session)

Shopping-cart model — user picks drinks with quantities, no per-drink time picker. On save, timestamps are evenly spread across `[startedAt, endedAt]`. Pure utility `spreadDrinkTimestamps(start, end, count)` in `src/lib/session-utils.ts`.

## Feed

- Past sessions post to the feed on save (matching live-session behavior).
- Feed is ordered by `feed_items.created_at DESC` (already is), so backdated posts appear at the top at log time.
- New `is_backfilled` column on `feed_items` drives a "Past session" pill on the feed card so friends see context.
- Edits to a completed session update the existing `feed_items` row (session_summary JSONB) in place — the existing realtime subscription broadcasts to friends.
- `is_backfilled` is set at create-time based on flow (client-side intent flag) and NEVER changed on edit.

## Database changes

Run in Supabase SQL editor:

```sql
ALTER TABLE feed_items
  ADD COLUMN is_backfilled BOOLEAN NOT NULL DEFAULT false;

UPDATE feed_items fi
SET is_backfilled = true
FROM drink_sessions ds
WHERE fi.session_id = ds.id
  AND ds.ended_at IS NOT NULL
  AND fi.created_at - ds.ended_at > INTERVAL '3 hours';
```

No other schema changes. `drink_sessions.started_at/ended_at/duration_minutes` already writable; `drink_entries.timestamp` already writable. RLS already allows owners to UPDATE/INSERT on all relevant tables.

File `supabase/add-is-backfilled.sql` captures the migration for repo history.

## Store API (`src/stores/use-session-store.ts`)

Two new methods:

```ts
createPastSession(input: {
  userId: string;
  venue: string;
  startedAt: string;
  endedAt: string;
  drinks: Array<{ drinkDefinitionId: string; quantity: number }>;
  mood: SessionMood;
  caption: string;
  photos: Blob[];
  shareToFeed: boolean;
}): Promise<{ sessionId: string }>;

updateSession(
  sessionId: string,
  updates: { venue?: string; startedAt?: string; endedAt?: string; mood?: SessionMood; caption?: string; }
): Promise<void>;
```

Internal: `createPastSession` is one atomic client-side flow (insert session → insert all drinks with spread timestamps → insert feed item → fetch PRs). Refuses to run if `activeSession != null` (toast "End current session first").

`updateSession` only operates on completed sessions. If `startedAt/endedAt` changed, it re-spreads drink timestamps and recomputes `duration_minutes`, then updates the feed item's `session_summary` JSONB.

## UI components

**New files:**
- `src/components/session/session-form.tsx` — shared form (mode: `'create-past' | 'edit'`)
- `src/components/ui/datetime-field.tsx` — wraps native `<input type="datetime-local">` with app styling
- `src/app/(app)/session/log-past/page.tsx` — hosts form in create-past mode
- `src/app/(app)/session/[id]/edit/page.tsx` — hosts form in edit mode
- `src/lib/session-utils.ts` — `spreadDrinkTimestamps`, `buildSessionSummary`, validation helpers

**Modified:**
- `src/app/(app)/session/page.tsx` — add "Log past session" button under "Start Drinking"
- `src/app/(app)/session/[id]/session-detail.tsx` — add "Edit" link for owner
- `src/components/feed/feed-card.tsx` — "Past session" pill when `isBackfilled`
- `src/stores/use-session-store.ts` — new methods
- `src/stores/use-feed-store.ts` — pass `isBackfilled` through, add `updateFeedItemForSession` helper
- `src/types/feed.ts` — add `isBackfilled: boolean`

## Validation

- End > start (min 1 min apart)
- Start <= now, end <= now
- Start within last 90 days
- ≥1 drink
- Mood required

## Edge cases

- **Active session exists** → past-session form disabled, message "End your active session first."
- **User edits their own session but it has no feed item yet** (e.g., was skipped initially) → edit updates only the session, not the feed.
- **Drink count changes via edit** — out of scope for v1. Edit form does not let you change drinks, only venue/times/mood/caption. To change drinks, user deletes and re-logs. (YAGNI; adds complexity because drink spread re-runs on every drink add/remove.)
- **Photo edits on existing session** — out of scope for v1 for the same reason; only times/venue/mood/caption editable.
- **Timezone** — all timestamps stored as TIMESTAMPTZ; form uses local time via `datetime-local`, converted to ISO on submit.

## Non-goals (v1)

- Per-drink timestamp editing (always evenly spread)
- Editing drinks or photos post-completion
- "Save draft" of a past session
- Bulk backfill multiple sessions
- "Edited" label on feed cards
