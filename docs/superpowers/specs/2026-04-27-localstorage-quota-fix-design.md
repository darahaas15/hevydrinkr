# localStorage Quota Fix — Design

**Date:** 2026-04-27
**Status:** Approved (pending implementation plan)

## Problem

The Zustand `persist` middleware writes the feed cache to `localStorage` under the key `hd-feed`. The serialized payload exceeds the per-origin quota (~5 MB), and writes fail with `QuotaExceededError`. The retry path in `safeJSONStorage` removes the existing key and re-writes, but the value itself is too large, so the retry also fails. Logged symptom from `npm run dev`:

```
[safeJSONStorage] quota exceeded writing "hd-feed", retrying after removing existing key
[safeJSONStorage] retry failed for "hd-feed" — persisted cache will be stale until next successful write
```

Goal: shrink what's persisted across all `hd-*` stores so writes succeed reliably, without breaking the existing instant-render UX. Where data is dropped from the cache and must be re-fetched, the affected UI must show a loading skeleton in place of the missing content (no flicker from "0 likes" → "7 likes").

## Scope

Full audit of every persisted store. Tighten the heaviest (`hd-feed`, `hd-sessions`, `hd-roasts`); leave the others alone but instrument them so we can see actual sizes in dev.

## Non-Goals

- Migrating to IndexedDB or another storage backend.
- Changing fetch logic or cache freshness windows.
- Reducing the number of persisted stores.
- Refactoring `safeJSONStorage` (it works correctly; the retry just can't help when the value itself is too big).

## Architecture

The fix has three pieces:

1. **Persisted-state shape changes** — drop heavy fields from `partialize`, replace with cheap derived counts.
2. **Render-path changes** — render from counts instead of array lengths; show skeletons where stripped fields would otherwise produce flicker.
3. **Persist version bump + migrate** — drop the legacy oversized cache cleanly on first load after deploy.

In-memory state remains unchanged — full `likes`, `comments`, `drinks` arrays still live in the Zustand store. Persistence is purely a snapshot of a slimmer projection.

## Persisted-State Shape Changes

### `hd-feed`

- **Trim items**: 50 → 20.
- **Strip from each persisted item**: `comments` array, `likes` array.
- **Add to each persisted item** (and to the `FeedItem` type):
  - `likeCount: number` — heart count badge
  - `currentUserLikeId: string | null` — heart fill state ("did *I* like this?")
  - `commentCount: number` — comments-icon badge
- These three fields are derived from the canonical in-memory arrays via a single `deriveCounts(item, currentUserId)` helper, applied on every mutation that touches `likes` or `comments`. The arrays remain authoritative; counts are a projection.

### `hd-sessions`

- **Trim per-user history**: 100 → 30 sessions.
- Drinks array stays (profile stats compute from it on render).
- No skeleton work needed — older sessions rarely surface in UI and `fetchSessions` already refetches on mount/focus.

### `hd-roasts`

- **Trim recaps**: 50 → 8.
- Streaks and records stay (already small).
- No skeleton work needed — only the latest recap is rendered prominently.

### `hd-groups`

- **No change** in this pass.
- Add to instrumentation log; revisit if it shows >100KB in practice.

### Other persisted stores

`hd-auth`, `hd-profile`, `hd-notifications`, `hd-moderation` — no change. They persist scalar fields or small maps.

## Render-Path Changes

### `FeedCard` (`src/components/feed/feed-card.tsx`)

- **Heart fill**: when `item.likes` is populated (post-refetch), check `item.likes.find((l) => l.userId === currentUser?.id)` (richer source). When the array is empty (cache-only window), check `item.currentUserLikeId !== null`. The field stores a like *row id*, not a user id — its presence alone means "this user liked this post" because it was derived against `currentUser.id` at write time.
- **Heart count**: render `item.likeCount`.
- **Comments count**: render `item.commentCount`.
- **"Liked by X and N others" row**:
  - `likeCount === 0` → render nothing (unchanged).
  - `likeCount > 0 && likes.length === 0` → render a skeleton (3 stacked avatar circles + text-line shimmer at the same height as the real row).
  - `likes.length > 0` → render real row.
- **Likes modal**: opening it while `likes.length === 0 && likeCount > 0` triggers a one-shot `refreshFeedItem(item.id)`, and skeleton rows render in the modal until the array lands.

### `PostDetailPage` (`src/app/(app)/feed/[id]/post-detail.tsx`)

- **Mount effect**: if the cached item is present but its arrays were stripped (`likes.length === 0 && likeCount > 0`, or `comments.length === 0 && commentCount > 0`), call `refreshFeedItem(item.id)` once.
- **Heart fill / count / total comments header**: same `likeCount` / `commentCount` reads as FeedCard.
- **"Liked by..." row**: same skeleton variant as FeedCard.
- **Comments section**:
  - `commentCount === 0` → "No comments yet — be the first" *(unchanged)*.
  - `commentCount > 0 && comments.length === 0` → 3 skeleton comment rows (avatar + 2 text lines).
  - `comments.length > 0` → real list (unchanged).
- **Likes modal**: skeleton rows when `likes.length === 0 && likeCount > 0`.

### Skeleton primitives

Reuse the existing `<Skeleton variant="circle" />` and `<Skeleton variant="text" />` from `src/components/ui/skeleton.tsx`. No new components.

### No changes needed to

Profile pages, session detail page, roast section, groups page. The `hd-sessions` and `hd-roasts` trims are pure capacity reductions; consumers already handle the "older items get refetched on demand" path through their existing `fetchSessions` / `fetchRecaps` calls.

## Store-Mutation Discipline

Every mutation that touches `likes` or `comments` must update the corresponding count. To prevent count drift under concurrent realtime + optimistic updates, counts are always recomputed from the array (not incremented/decremented).

**Helper** (added to `use-feed-store.ts`):

```ts
function deriveCounts(item: FeedItem, currentUserId?: string): FeedItem {
  return {
    ...item,
    likeCount: item.likes.length,
    currentUserLikeId: item.likes.find((l) => l.userId === currentUserId)?.id ?? null,
    commentCount: item.comments.reduce((sum, c) => sum + 1 + c.replies.length, 0),
  };
}
```

**Callsites that must wrap their item-producing function with `deriveCounts`**:

| Function | Mutation | Affects |
|---|---|---|
| `mapRow` | initial mapping | likeCount, currentUserLikeId, commentCount |
| `addLike` (optimistic, rollback, id-swap) | `likes` | likeCount, currentUserLikeId |
| `removeLike` (optimistic, rollback) | `likes` | likeCount, currentUserLikeId |
| `addComment` (optimistic, rollback, id-swap) | `comments` | commentCount |
| `deleteComment` (optimistic, rollback) | `comments` | commentCount |
| `applyLikeChange` (realtime INSERT/DELETE) | `likes` | likeCount |
| `applyCommentChange` (realtime INSERT/DELETE) | `comments` | commentCount |
| `refreshFeedItem` | full row replace | all three |

`patchItemEverywhere` does not change. Its callbacks are responsible for returning items already passed through `deriveCounts`.

Rollbacks (`set({ items: prevItems, userPosts: prevUserPosts })`) restore the previous derived counts naturally because `prev*` snapshots already include them.

## `partialize` Implementations

```ts
// use-feed-store.ts
partialize: (s) => ({
  items: s.items.slice(0, 20).map((item) => ({
    ...stripFeedPhotos(item),
    likes: [],
    comments: [],
    // likeCount, currentUserLikeId, commentCount carry over as-is
  })),
}),
```

```ts
// use-session-store.ts
partialize: (s) => ({
  activeSession: s.activeSession ? stripPhotos(s.activeSession) : null,
  sessionsByUser: Object.fromEntries(
    Object.entries(s.sessionsByUser).map(([uid, list]) => [
      uid,
      list.slice(0, 30).map(stripPhotos),  // was 100
    ]),
  ),
}),
```

```ts
// use-roast-store.ts
partialize: (s) => ({
  recaps: s.recaps.slice(0, 8),  // was 50
  streaks: s.streaks,
  records: s.records,
}),
```

## Type Changes

`src/types/feed.ts` — `FeedItem` gains three required fields:

```ts
interface FeedItem {
  // ...existing fields
  likeCount: number;
  currentUserLikeId: string | null;
  commentCount: number;
}
```

All existing constructors of `FeedItem` (in `mapRow`, `createFeedItemFromSession`, `applyFeedItemChange`'s INSERT branch, optimistic comment/like creation) must populate these. The `deriveCounts` helper handles `mapRow` and the apply-handlers; the others initialize counts to 0 / null since they're brand-new items with empty arrays.

## Migration

`hd-feed` shape changes (existing cached items have neither the new count fields nor empty `likes`/`comments`). Bump persist `version` and drop the legacy cache wholesale on first hydrate:

```ts
// hd-feed
}), {
  name: 'hd-feed',
  version: 2,
  storage: safeJSONStorage(),
  migrate: (_persisted, fromVersion) => {
    if (fromVersion < 2) return { items: [] };
    return _persisted as { items: FeedItem[] };
  },
  partialize: ...,
});
```

`hd-sessions` and `hd-roasts` shapes do **not** change — only the slice size shrinks. Old larger caches will hydrate fine into memory and the next persist write will trim them. Bumping their `version` is therefore optional, but **recommended** as a one-time cleanup so users carrying oversized caches from before don't sit on an extra ~1 MB of localStorage between hydrate and first persist write. Use the same drop-cache migrate.

The cache is purely a freshness optimization for Supabase data; dropping one rehydrate causes a brief skeleton flash on first load after deploy and nothing else.

### Cross-user cache caveat

`currentUserLikeId` is computed at write time using whoever's currently signed in. If a user logs out and a *different* user signs in on the same browser, the persisted `currentUserLikeId` values are wrong for the new user — hearts could appear filled on posts the new user didn't actually like, for the brief window between hydration and the first `fetchFeed` (~200ms typically).

Acceptable trade-off: this app does not target shared browsers, the window is short, and the wrong state self-heals once the network refetch lands. Implementation plan may, optionally, null out `currentUserLikeId` for all items in `onRehydrateStorage` if `useAuthStore.getState().currentUser?.id` is available and differs from the writer (deferred decision; flagging here so the implementer is aware).

## Instrumentation

Add `src/lib/storage/log-storage-usage.ts`:

```ts
export function logStorageUsage(): void {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') return;
  let total = 0;
  const rows: Array<[string, number]> = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith('hd-')) continue;
    const size = (window.localStorage.getItem(key) ?? '').length;
    rows.push([key, size]);
    total += size;
  }
  rows.sort((a, b) => b[1] - a[1]);
  console.groupCollapsed(`[storage] hd-* total: ${(total / 1024).toFixed(1)} KB`);
  for (const [k, s] of rows) console.log(`${k.padEnd(20)} ${(s / 1024).toFixed(1)} KB`);
  console.groupEnd();
}
```

Called once from the top-level client provider (the same place that initiates auth — likely `src/app/(app)/layout.tsx` or wherever auth-store hydrates).

## Error Handling

- `safeJSONStorage` retains its existing retry-once-on-quota behavior. With smaller persisted shapes, the retry now succeeds for the realistic cases. If it still fails (extreme corner case), the `console.error` already in place fires and the in-memory state continues to function — only cache freshness is lost.
- `refreshFeedItem` failures (network down on deep-link) are non-fatal — the skeleton stays visible until the next focus refetch or `fetchFeed` recovers. This matches the codebase's existing posture: background fetch failures are silent for the user.
- The skeleton state is "unbounded waiting" only if every refetch fails forever, which is no different from the current product behavior when offline.

## Verification

1. **Type-check + lint**: `npm run typecheck && npm run lint`.
2. **Quota recovery — happy path**
   - `localStorage.clear()`, reload, sign in.
   - Scroll feed past 20 items, like several posts, post comments on some.
   - Reload.
   - Confirm: cards render instantly, hearts filled correctly for posts you liked, counts correct, "Liked by..." row briefly shows skeleton then resolves, no `QuotaExceededError` in console.
3. **Deep-link to a post not in the cached 20**
   - Open `/feed?post=<id>` for an older post.
   - Confirm: spinner → post loads → "Liked by..." skeleton (if applicable) → comments-section skeleton (if applicable) → real data lands.
4. **Migration smoke test**
   - Before installing the new build: `localStorage.setItem('hd-feed', JSON.stringify({ state: { items: [{ id: 'x', likes: [{ id: 'l', userId: 'u', userName: 'a', createdAt: '...' }], comments: [] }] }, version: 0 }))`.
   - Install the new build, reload.
   - Confirm: no crash, cache cleared, feed refetches fresh, all three count fields present.
5. **Storage usage log**: dev-console group shows total well under 1 MB after a normal session.
6. **Quota stress test (optional)**: in DevTools, write a ~4 MB junk key, then exercise the app. Feed should still render from network; no crashes; `safeJSONStorage` console.error may fire for the next write — acceptable because the in-memory store keeps working.

## Out-of-Scope / Follow-ups

- If the storage usage log shows `hd-groups` consistently >100 KB, do a separate trim pass.
- If real-world telemetry shows users still hitting the quota retry, consider migrating `hd-feed` to IndexedDB (much higher quota) — but only as a follow-up; this fix should bring usage well under the threshold.
- The instrumentation logger could later be promoted to fire on quota errors in production (gated behind a flag) for observability — out of scope here.
