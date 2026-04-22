# Unify Edit Session + Edit Post into one page with +/- drink editing

Status: Draft
Date: 2026-04-22

## Problem

Two separate flows edit the same underlying post:

- **Edit Session** (`/session/edit/[id]`) — `SessionForm` in `edit` mode. Lets you change venue, times, mood, caption. Shows drinks **read-only** ("Drinks aren't editable here").
- **Edit Post** (modal in `feed/[id]/post-detail.tsx`) — separate full-screen modal. Lets you change caption, drinks (delete-only, no +/-), and photos.

To change drinks on a past session, the user has to back out of Edit Session and open Edit Post from the post's "…" menu. This is the bug.

The drink UIs are also inconsistent:

- Live session (`DrinkList`) — grouped by type with minus / quantity / plus / trash.
- Create-past cart in `SessionForm` — same visual pattern as DrinkList but reimplemented inline.
- Edit Post modal — plain list with a single `X` delete button per drink; no +/- or grouping.
- Edit Session — read-only; no controls at all.

## Goal

One edit surface, reached from both entry points, with the +/- grouped-cart UI used everywhere drinks are edited.

## Design

### 1. Single edit surface: the `/session/edit/[id]` page

- Both "Edit Post" (feed post `…` menu) and any existing "Edit Session" entry point navigate to `/session/edit/[id]`.
- The page loads the session from `useSessionStore` and the feed item from `useFeedStore` (already does this) and renders `SessionForm` in `edit` mode.
- The Edit Post modal in `post-detail.tsx` is deleted. All of its state (`showEditModal`, `editCaption`, `editDrinks`, `editPhotos`, `showDrinkPicker`, `saving`) and the modal JSX (lines 722-862) go away. The `…` menu gains one "Edit" item that navigates.

### 2. `SessionForm` edit mode gets full drink + photo editing

Today in `edit` mode, `SessionForm`:

- Renders drinks as a read-only list.
- Hides the "Add" drink button.
- Hides the photos section entirely.

The edit-mode changes:

- Initialize `cart` from `existingSession.drinks` by grouping on `drinkDefinitionId` (same grouping rule as `DrinkList`).
- Render the cart with the existing +/- / trash UI (currently only shown in `create-past`).
- Enable the "Add" drink button so the `DrinkPicker` can add new drink types in edit mode.
- Initialize `photos` from `existingSession.photos` and render the photo section with `PhotoGallery` + Add button (mirror create-past).
- Keep venue / times / mood / caption handling as-is.

### 3. Shared `DrinkCart` component

Extract a new component `src/components/session/drink-cart.tsx`:

- Renders the grouped +/- UI currently duplicated between `DrinkList` and `SessionForm`'s cart render.
- Props:
  - `items: Array<{ key: string; template: DrinkEntry; quantity: number }>`
  - `onInc(key)`, `onDec(key)`, `onRemove(key)`
  - optional `totalStandardDrinks?: number` for the footer line
- Pure presentational: the component does no grouping itself — callers pass already-grouped items.

Consumers:

- `SessionForm` (create-past and edit) passes cart items keyed by `drinkDefinitionId`.
- `DrinkList` (live session) keeps its own grouping logic (it needs per-`DrinkEntry` IDs to remove the latest entry), but renders using `DrinkCart` for visual consistency. `onDec` maps to "remove latest entry in group"; `onInc` calls `onAdd` with a cloned template; `onRemove` maps to "remove all entries in group."

Result: one visual component for the grouped +/- list; the +/-/trash layout is defined once.

### 4. Save path

The existing `updateSession` store action does not persist drinks. `updateFeedItem` already does — it deletes/reinserts `drink_entries` and syncs session totals when `sessionSummary` is provided (see `use-feed-store.ts:570-658`). Reuse it, with two small store-side fixes (described below).

On save in edit mode, after venue/times/mood sync via `updateSession`:

- Expand cart into `DrinkEntry[]` the same way create-past does (`drinksForSubmit` in `session-form.tsx:112-120`). Each row already carries its real `drinkDefinitionId` from the picker.
- Compute whether drinks changed vs. `existingSession.drinks` (compare by length + per-group counts).
- Compute whether photos changed vs. `existingSession.photos`.
- Whether caption changed (already tracked today).
- If any of those changed and the session has a feed item, build a `sessionSummary` payload and call `updateFeedItem` with `{ caption?, photos?, sessionSummary? }`. Include the full `DrinkEntry[]` (with real definition IDs and standardDrinks) in the payload, not just name/abv/volume.

#### Store fixes (included in this spec)

1. **Preserve real `drink_definition_id` on edit.**
   Today `updateFeedItem` writes `drink_definition_id: 'edited'` when re-inserting drinks (`use-feed-store.ts:606`) because the old edit-post modal only kept name/category/abv/volume. After this change, the edit flow has real `DrinkEntry`s again. Extend `FeedItem.sessionSummary.drinks` to carry `drinkDefinitionId` (optional, for backfill safety) and have `updateFeedItem` write it through when present; fall back to `'edited'` only when missing. Similarly write through `timestamp` when provided, instead of stamping everything with `now`.

2. **Re-spread drink timestamps when the drink count changes.**
   `updateSession` re-spreads timestamps when `startedAt`/`endedAt` change but not when the drink count changes. In the unified edit save path, if drinks changed, re-spread the new drink list across `[startedAt, endedAt]` using `spreadDrinkTimestamps` before handing to `updateFeedItem`. This keeps derived analytics (drinks per hour, peak BAC) honest.

`updateFeedItem` already handles: DB delete/reinsert of drink rows, session totals, optimistic rollback on error, keeping session store IDs aligned with DB rows. The two fixes above are local tweaks inside that function plus one type extension.

### 5. Entry-point changes

`feed/[id]/post-detail.tsx`:

- The post `…` menu: replace the "Edit Post" button's `onClick` from `setShowEditModal(true)` to `router.push('/session/edit/' + item.sessionId)`.
- Delete: the edit modal JSX, the `DrinkPicker` mounted inside the modal, `editCaption` / `editDrinks` / `editPhotos` / `showEditModal` / `showDrinkPicker` / `saving` state, and unused imports (`Plus`, `Camera`, `DrinkPicker`, `pickImage`, `compressImage` — keep only if used elsewhere in the file).

## Files touched

- `src/components/session/drink-cart.tsx` — new shared +/- list component.
- `src/components/session/drink-list.tsx` — delegate rendering to `DrinkCart`.
- `src/components/session/session-form.tsx` — init cart + photos from existing session in edit mode, remove the edit-mode gates on Add button / photos / cart render, extend save path to call `updateFeedItem` with `sessionSummary` / `photos` when changed, re-spread timestamps when drink count changed.
- `src/app/(app)/feed/[id]/post-detail.tsx` — route "Edit Post" to the session edit page; delete modal + related state.
- `src/stores/use-feed-store.ts` — in `updateFeedItem`, write through real `drinkDefinitionId` and `timestamp` from the payload when present (fallback to `'edited'` / now).
- `src/types/*.ts` — extend `FeedItem['sessionSummary']['drinks']` with optional `drinkDefinitionId` and `timestamp` fields so the richer payload can travel through.

Out of scope: the live session UX (same UI, just refactored), anything outside edit/create-past flows. Items (3)-(7) from the initial review are deferred to their own specs.

## Risks / notes

- **Feed item without a session.** All posts in this app originate from a session (every `FeedItem` has a `sessionId`). Navigating "Edit Post" to `/session/edit/[id]` is safe. If a future code path creates feed-only items, this assumption needs revisiting.
- **Caption source in edit mode.** `SessionForm` already reads caption from `existingFeedItem`; unchanged.
- **Photo source of truth.** `existingSession.photos` is populated by the session fetch. Confirm `session/edit/page.tsx` passes fresh photos; today it does (photos live on the session).
- **Backfill posts with `'edited'` definition IDs.** Older posts already edited through the modal have `'edited'` baked into their drink rows. This spec doesn't retroactively fix those — the next edit on those posts will still write `'edited'` for rows that don't have a real ID in state. Acceptable: the new-edit fix prevents the regression going forward.
- **Timestamp re-spread edge case.** Re-spreading on drink-count change assumes the session window is accurate. If `startedAt === endedAt`, `spreadDrinkTimestamps` should still produce valid (clustered) timestamps; verify behavior.

## Success criteria

- From a feed post's `…` menu, tap "Edit" → land on the edit page → edit drinks with +/-, caption, photos, venue, times, mood → save → feed card and session both reflect changes.
- From the session detail's Edit button, same flow.
- No remaining reference to the old Edit Post modal.
- `DrinkCart` is the single component rendering grouped +/- drink rows across live session, create-past, and edit.
- After an edit that changes drinks, `drink_entries` rows for that session carry the real `drink_definition_id` (not `'edited'`) and timestamps spread evenly across the session window.
