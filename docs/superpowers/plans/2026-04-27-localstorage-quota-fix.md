# localStorage Quota Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `QuotaExceededError` writing to `hd-feed` by trimming and reshaping all `hd-*` persisted stores, with inline skeletons for any UI that briefly renders without the stripped data.

**Architecture:** Drop heavy arrays (`likes`, `comments`) from `hd-feed` persistence and replace them with cheap derived counts (`likeCount`, `currentUserLikeId`, `commentCount`) that are recomputed from in-memory arrays via a single `deriveCounts` helper applied at every mutation site. Trim slice sizes on `hd-sessions` (100→30) and `hd-roasts` (50→8). Bump persist `version` so legacy oversized caches drop on first hydrate. Add inline skeletons to `FeedCard` and `PostDetailPage` where stripped fields would otherwise flicker.

**Tech Stack:** Next.js 16 App Router, Zustand (with `persist` middleware), TypeScript, Tailwind. No test runner — verification is `npm run build` + lint + manual browser checks.

**Spec:** `docs/superpowers/specs/2026-04-27-localstorage-quota-fix-design.md`

---

## File Map

**Created:**
- `src/lib/storage/log-storage-usage.ts` — dev-only logger of `hd-*` byte sizes

**Modified:**
- `src/types/feed.ts` — add `likeCount`, `currentUserLikeId`, `commentCount` to `FeedItem`
- `src/stores/use-feed-store.ts` — `deriveCounts` helper + apply at every mutation; new `partialize` + `version: 2` + `migrate`
- `src/stores/use-session-store.ts` — slice 100→30; `version: 2` + `migrate`
- `src/stores/use-roast-store.ts` — slice 50→8; `version: 2` + `migrate`
- `src/components/feed/feed-card.tsx` — render counts; skeleton for "Liked by..." row and likes modal
- `src/app/(app)/feed/[id]/post-detail.tsx` — mount-effect refetch when arrays stripped; skeleton for comments and likes modal
- `src/app/(app)/layout.tsx` — call `logStorageUsage()` once on mount in dev

---

## Task 1: Add count fields to `FeedItem` type

**Files:**
- Modify: `src/types/feed.ts`

- [ ] **Step 1: Add three required fields to `FeedItem`**

Replace the `FeedItem` interface so it includes the three new count/id fields. The order keeps related fields adjacent (counts grouped with their arrays):

```ts
export interface FeedItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  sessionId: string;
  sessionSummary: {
    venue: string;
    totalDrinks: number;
    totalStandardDrinks: number;
    durationMinutes: number;
    topDrink: string;
    topDrinkEmoji: string;
    drinkEmojis: string[];
    drinks: {
      name: string;
      emoji: string;
      category: string;
      abvPercent: number;
      volumeMl: number;
      standardDrinks: number;
      drinkDefinitionId?: string;
      timestamp?: string;
    }[];
    mood: SessionMood | null;
    prsAchieved: PersonalRecord[];
  };
  photos: string[];
  caption: string;
  likes: FeedLike[];
  // Cached counts derived from `likes`/`comments`. Persisted in localStorage
  // so the feed renders heart count, fill state, and comment count without
  // waiting for the full arrays (which we strip from the cache to fit the
  // localStorage quota). Recomputed via deriveCounts() at every mutation.
  likeCount: number;
  // Row id of the current user's like, or null. Used during the cache-only
  // window (likes: []) to drive heart fill — its mere presence means
  // "current user liked this", because it's set against currentUser.id at
  // write time. Cross-user staleness is acceptable; see spec.
  currentUserLikeId: string | null;
  comments: FeedComment[];
  commentCount: number;
  createdAt: string;
  isBackfilled: boolean;
}
```

- [ ] **Step 2: Type-check (will fail intentionally — there are construction sites that don't populate the new fields yet)**

Run: `npx tsc --noEmit`
Expected: errors at `src/stores/use-feed-store.ts` (mapRow, createFeedItemFromSession, applyFeedItemChange) — these get fixed in Task 2.

- [ ] **Step 3: Commit**

```bash
git add src/types/feed.ts
git commit -m "types: add likeCount/currentUserLikeId/commentCount to FeedItem"
```

---

## Task 2: Add `deriveCounts` helper and apply at every feed-store mutation site

**Files:**
- Modify: `src/stores/use-feed-store.ts`

This task touches every place that constructs or mutates a `FeedItem`. The helper centralizes the derivation; callers just wrap their item-producing function with it.

- [ ] **Step 1: Add `deriveCounts` helper and a small auth getter near the top of `use-feed-store.ts`**

Add this immediately after the existing `stripFeedPhotos` constant (around line 20):

```ts
// Reads currentUser id from auth-store at call time. Used by deriveCounts to
// stamp `currentUserLikeId` so the heart fill can render before the network
// refetch backfills `likes`.
const getCurrentUserId = (): string | undefined => useAuthStore.getState().currentUser?.id;

// Recompute the three persisted-but-derived count fields from the canonical
// in-memory arrays. Called at every mutation site; cheaper than maintaining
// hand-written +1/-1 arithmetic across optimistic + realtime + rollback paths.
function deriveCounts(item: FeedItem, currentUserId = getCurrentUserId()): FeedItem {
  return {
    ...item,
    likeCount: item.likes.length,
    currentUserLikeId: currentUserId
      ? item.likes.find((l) => l.userId === currentUserId)?.id ?? null
      : null,
    commentCount: item.comments.reduce((sum, c) => sum + 1 + c.replies.length, 0),
  };
}
```

Note: `useAuthStore` is already imported at the top of the file — no new import needed.

- [ ] **Step 2: Update `mapRow` to call `deriveCounts` before returning**

In `mapRow` (around line 173), replace the existing return block. The function returns `FeedItem | null`, so the deriveCounts call wraps the constructed object:

```ts
function mapRow(row: FeedItemRow, currentUserId?: string): FeedItem | null {
  if (!row.session_summary) return null;
  const item: FeedItem = {
    id: row.id,
    userId: row.user_id,
    userName: row.profile.display_name,
    userAvatar: row.profile.avatar_url,
    sessionId: row.session_id,
    sessionSummary: row.session_summary,
    photos: row.photos ?? [],
    caption: row.caption,
    likes: (row.feed_likes ?? []).map((l) => ({
      id: l.id,
      userId: l.user_id,
      userName: l.liker.display_name,
      createdAt: l.created_at,
    })),
    // Counts get filled by deriveCounts below.
    likeCount: 0,
    currentUserLikeId: null,
    comments: threadComments(row.feed_comments ?? []),
    commentCount: 0,
    createdAt: row.created_at,
    isBackfilled: row.is_backfilled ?? false,
  };
  return deriveCounts(item, currentUserId);
}

function mapRows(rows: FeedItemRow[], currentUserId?: string): FeedItem[] {
  return rows.map((r) => mapRow(r, currentUserId)).filter((x): x is FeedItem => x !== null);
}
```

- [ ] **Step 3: Update every `mapRows`/`mapRow` callsite inside actions to pass `currentUserId`**

Five callsites in `use-feed-store.ts`. For each, capture `currentUserId` once at the top of the action (before any `set`) and pass it to `mapRows`/`mapRow`:

In `fetchFeed` (around line 240, after `set({ error: null });`):
```ts
const currentUserId = useAuthStore.getState().currentUser?.id;
```
Then change the `mapRows(rows)` call to `mapRows(rows, currentUserId)`.

In `fetchMoreFeed` (around line 263, before `const lastItem = ...`):
```ts
const currentUserId = useAuthStore.getState().currentUser?.id;
```
Change `mapRows(rows)` to `mapRows(rows, currentUserId)`.

In `fetchUserPosts` (around line 291, after the staleness check):
```ts
const currentUserId = useAuthStore.getState().currentUser?.id;
```
Change `mapRows(data as unknown as FeedItemRow[])` to `mapRows(data as unknown as FeedItemRow[], currentUserId)`.

In `fetchSinglePost` (around line 310, before the supabase call):
```ts
const currentUserId = useAuthStore.getState().currentUser?.id;
```
Change `mapRow(data as unknown as FeedItemRow)` to `mapRow(data as unknown as FeedItemRow, currentUserId)`.

In `refreshFeedItem` (around line 825, before the supabase call):
```ts
const currentUserId = useAuthStore.getState().currentUser?.id;
```
Change `mapRow(data as unknown as FeedItemRow)` to `mapRow(data as unknown as FeedItemRow, currentUserId)`.

- [ ] **Step 4: Wrap every `patchItemEverywhere` callback that mutates `likes` or `comments` with `deriveCounts`**

The pattern to apply: anywhere a callback returns `{ ...item, likes: ... }` or `{ ...item, comments: ... }`, change it to return `deriveCounts({ ...item, likes: ... })`.

Specifically (line numbers approximate):

`addLike` optimistic block (around line 389):
```ts
set((state) => patchItemEverywhere(state, feedItemId, (item) => deriveCounts({
  ...item,
  likes: [...item.likes, like],
})));
```

`addLike` rollback (around line 405):
```ts
set((state) => ({
  ...patchItemEverywhere(state, feedItemId, (item) => deriveCounts({
    ...item,
    likes: item.likes.filter((l) => l.id !== like.id),
  })),
  error: error.message,
}));
```

`addLike` id-swap after success (around line 416):
```ts
set((state) => patchItemEverywhere(state, feedItemId, (item) => deriveCounts({
  ...item,
  likes: item.likes.map((l) => (l.id === like.id ? { ...l, id: inserted.id } : l)),
})));
```

`removeLike` optimistic (around line 426):
```ts
set((state) => patchItemEverywhere(state, feedItemId, (item) => deriveCounts({
  ...item,
  likes: item.likes.filter((l) => l.id !== likeId),
})));
```
(The rollback uses `set({ items: prevItems, userPosts: prevUserPosts })` — counts in `prev*` are already correct, no change needed.)

`addComment` `insertComment`/`removeComment` inner functions (around line 443): both must wrap their return with `deriveCounts`:
```ts
const insertComment = (item: FeedItem): FeedItem => {
  if (parentCommentId) {
    return deriveCounts({
      ...item,
      comments: mapComment(item.comments, parentCommentId, (parent) => ({
        ...parent,
        replies: [...parent.replies, comment],
      })),
    });
  }
  return deriveCounts({ ...item, comments: [...item.comments, comment] });
};
const removeComment = (item: FeedItem): FeedItem => {
  if (parentCommentId) {
    return deriveCounts({
      ...item,
      comments: mapComment(item.comments, parentCommentId, (parent) => ({
        ...parent,
        replies: parent.replies.filter((r) => r.id !== comment.id),
      })),
    });
  }
  return deriveCounts({ ...item, comments: item.comments.filter((c) => c.id !== comment.id) });
};
```

`addComment` id-swap (around line 493):
```ts
set((state) => patchItemEverywhere(state, feedItemId, (item) => deriveCounts({
  ...item,
  comments: mapComment(item.comments, comment.id, (c) => ({ ...c, id: inserted.id })),
})));
```

`createFeedItemFromSession` — the locally-built `feedItem` (around line 361) — needs counts. Replace:
```ts
const feedItem: FeedItem = deriveCounts({
  id: inserted.id,
  userId: user.id,
  userName: user.displayName,
  userAvatar: user.avatarUrl,
  sessionId: session.id,
  sessionSummary,
  photos: session.photos ?? [],
  caption,
  likes: [],
  likeCount: 0,
  currentUserLikeId: null,
  comments: [],
  commentCount: 0,
  createdAt: inserted.created_at,
  isBackfilled,
});
```

`deleteComment` (around line 743): wrap both branches:
```ts
set((state) => patchItemEverywhere(state, feedItemId, (item) => {
  const filtered = item.comments.filter((c) => c.id !== commentId);
  if (filtered.length < item.comments.length) {
    return deriveCounts({ ...item, comments: filtered });
  }
  return deriveCounts({
    ...item,
    comments: item.comments.map((c) => ({
      ...c,
      replies: c.replies.filter((r) => r.id !== commentId),
    })),
  });
}));
```

`likeComment` and `unlikeComment` (around lines 779, 814) — these only touch `comment.likes` (per-comment likes), not `item.likes`. They do not affect `likeCount` or `commentCount`. **No change needed** to these handlers.

`applyLikeChange` DELETE branch (around line 921):
```ts
set((state) => patchItemEverywhere(state, feedItemId, (item) => deriveCounts({
  ...item,
  likes: item.likes.filter((l) => l.id !== likeId),
})));
```

`applyLikeChange` INSERT/UPDATE branch (around line 941):
```ts
set((state) => patchItemEverywhere(state, feedItemId, (item) => {
  if (item.likes.some((l) => l.id === newLike.id)) return item;
  return deriveCounts({ ...item, likes: [...item.likes, newLike] });
}));
```

`applyCommentChange` DELETE branch (around line 955):
```ts
set((state) => patchItemEverywhere(state, feedItemId, (item) => deriveCounts({
  ...item,
  comments: item.comments
    .filter((c) => c.id !== commentId)
    .map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== commentId) })),
})));
```

`applyCommentChange` UPDATE branch (around line 977) — text edit doesn't change counts, but wrapping is harmless and keeps the pattern uniform:
```ts
set((state) => patchItemEverywhere(state, feedItemId, (item) => deriveCounts({
  ...item,
  comments: mapComment(item.comments, commentId, (c) => ({ ...c, text })),
})));
```

`applyCommentChange` INSERT branch (around line 996):
```ts
set((state) => patchItemEverywhere(state, feedItemId, (item) => {
  if (findComment(item.comments, commentId)) return item;
  if (parentCommentId) {
    return deriveCounts({
      ...item,
      comments: mapComment(item.comments, parentCommentId, (parent) => ({
        ...parent,
        replies: [...parent.replies, newComment],
      })),
    });
  }
  return deriveCounts({ ...item, comments: [...item.comments, newComment] });
}));
```

`applyFeedItemChange` INSERT branch (around line 888) — the locally-built `newItem`:
```ts
const newItem: FeedItem = deriveCounts({
  id,
  userId,
  userName: author.displayName,
  userAvatar: author.avatarUrl,
  sessionId: payload.new.session_id as string,
  sessionSummary: payload.new.session_summary as FeedItem['sessionSummary'],
  photos: (payload.new.photos as string[]) ?? [],
  caption: (payload.new.caption as string) ?? '',
  likes: [],
  likeCount: 0,
  currentUserLikeId: null,
  comments: [],
  commentCount: 0,
  createdAt: payload.new.created_at as string,
  isBackfilled: (payload.new.is_backfilled as boolean) ?? false,
});
```

`applyFeedItemChange` UPDATE branch (around line 868) — caption/photos/sessionSummary edits don't touch likes/comments arrays, so counts are unchanged. Wrapping is unnecessary; leave as-is to avoid noise.

- [ ] **Step 5: Type-check passes**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Lint passes**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/stores/use-feed-store.ts
git commit -m "feed-store: derive likeCount/currentUserLikeId/commentCount at every mutation"
```

---

## Task 3: Bump `hd-feed` persist version, add migrate, slim `partialize`

**Files:**
- Modify: `src/stores/use-feed-store.ts`

- [ ] **Step 1: Replace the persist config block at the bottom of `use-feed-store.ts`**

Find the existing block (around lines 1010-1017):

```ts
}), {
  name: 'hd-feed',
  storage: safeJSONStorage(),
  partialize: (s) => ({ items: s.items.slice(0, 50).map(stripFeedPhotos) }),
  onRehydrateStorage: () => (state) => {
    if (state && state.items.length > 0) state.loading = false;
  },
}));
```

Replace with:

```ts
}), {
  name: 'hd-feed',
  version: 2,
  storage: safeJSONStorage(),
  // Persisted shape changed in v2: drop full likes/comments arrays (heaviest
  // contributors to QuotaExceededError), keep only the three derived count
  // fields. Pre-v2 caches don't have the count fields, so drop them — the
  // cache is just a snappiness optimization, fetchFeed rebuilds it.
  migrate: (_persisted, fromVersion) => {
    if (fromVersion < 2) return { items: [] };
    return _persisted as { items: FeedItem[] };
  },
  partialize: (s) => ({
    items: s.items.slice(0, 20).map((item) => ({
      ...stripFeedPhotos(item),
      likes: [],
      comments: [],
    })),
  }),
  onRehydrateStorage: () => (state) => {
    if (state && state.items.length > 0) state.loading = false;
  },
}));
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors.

- [ ] **Step 3: Manual smoke check — quota fix**

Open the app in the dev server. In DevTools console:
```js
localStorage.clear()
```
Reload, sign in, scroll the feed past 20 items, like several posts. Reload again.
Expected: cards render instantly from cache, hearts filled correctly on previously-liked posts, no `QuotaExceededError` in the console, `localStorage.getItem('hd-feed').length` should be well under 1 MB (`< 200000` characters typical).

- [ ] **Step 4: Commit**

```bash
git add src/stores/use-feed-store.ts
git commit -m "feed-store: trim hd-feed cache to 20 items, strip likes/comments"
```

---

## Task 4: Trim `hd-sessions` slice to 30, bump version

**Files:**
- Modify: `src/stores/use-session-store.ts`

- [ ] **Step 1: Update the persist config**

Find the block at the bottom (around lines 943-957):

```ts
}), {
  name: 'hd-sessions',
  storage: safeJSONStorage(),
  partialize: (s) => ({
    activeSession: s.activeSession ? stripPhotos(s.activeSession) : null,
    sessionsByUser: Object.fromEntries(
      Object.entries(s.sessionsByUser).map(([uid, list]) => [
        uid,
        list.slice(0, 100).map(stripPhotos),
      ]),
    ),
  }),
}));
```

Replace with:

```ts
}), {
  name: 'hd-sessions',
  version: 2,
  storage: safeJSONStorage(),
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
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors. (`DrinkSession` is already imported at the top of `use-session-store.ts`.)

- [ ] **Step 3: Commit**

```bash
git add src/stores/use-session-store.ts
git commit -m "sessions-store: trim per-user history to 30, bump persist version"
```

---

## Task 5: Trim `hd-roasts` recaps to 8, bump version

**Files:**
- Modify: `src/stores/use-roast-store.ts`

- [ ] **Step 1: Update the persist config**

Find the block (around lines 567-575):

```ts
{
  name: 'hd-roasts',
  storage: safeJSONStorage(),
  partialize: (s) => ({
    recaps: s.recaps.slice(0, 50),
    streaks: s.streaks,
    records: s.records,
  }),
  onRehydrateStorage: () => (state) => {
    if (state) state.loading = false;
  },
}
```

Replace with:

```ts
{
  name: 'hd-roasts',
  version: 2,
  storage: safeJSONStorage(),
  migrate: (_persisted, fromVersion) => {
    if (fromVersion < 2) return { recaps: [], streaks: [], records: [] };
    return _persisted as { recaps: RoastRecap[]; streaks: RoastStreak[]; records: GroupRecord[] };
  },
  partialize: (s) => ({
    recaps: s.recaps.slice(0, 8),
    streaks: s.streaks,
    records: s.records,
  }),
  onRehydrateStorage: () => (state) => {
    if (state) state.loading = false;
  },
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors. (`RoastRecap`, `RoastStreak`, `GroupRecord` are already imported at the top of `use-roast-store.ts`.)

- [ ] **Step 3: Commit**

```bash
git add src/stores/use-roast-store.ts
git commit -m "roast-store: trim recaps to 8, bump persist version"
```

---

## Task 6: Update `FeedCard` to render counts and skeleton the "Liked by..." row

**Files:**
- Modify: `src/components/feed/feed-card.tsx`

- [ ] **Step 1: Add `Skeleton` import at the top of `feed-card.tsx`**

Find the existing import block (lines 1-15) and add this line near the other `@/components/ui/...` imports:

```ts
import Skeleton from '@/components/ui/skeleton';
```

- [ ] **Step 2: Replace the like-state derivation**

Find these lines (around line 29-30):

```ts
const userLike = item.likes.find((l) => l.userId === currentUser?.id);
const isLiked = !!userLike;
```

Replace with:

```ts
// Prefer the populated likes array (richer — has all liker info). Fall back
// to currentUserLikeId during the cache-only window (likes: [] but counts
// present). The mere presence of currentUserLikeId means "current user
// liked this", because it was derived against currentUser.id at write time.
const userLike = item.likes.find((l) => l.userId === currentUser?.id);
const isLiked = userLike != null || (item.likes.length === 0 && item.currentUserLikeId != null);
```

- [ ] **Step 3: Update `handleLike` to handle the cache-only-window case**

Find (around line 39-53):

```ts
const handleLike = (e: React.MouseEvent) => {
  e.stopPropagation();
  if (!currentUser) return;
  hapticLight();
  if (isLiked) {
    removeLike(item.id, userLike!.id);
  } else {
    addLike(item.id, {
      id: crypto.randomUUID(),
      userId: currentUser.id,
      userName: currentUser.displayName,
      createdAt: new Date().toISOString(),
    });
  }
};
```

Replace with:

```ts
const handleLike = (e: React.MouseEvent) => {
  e.stopPropagation();
  if (!currentUser) return;
  hapticLight();
  if (isLiked) {
    // userLike is set if the full array hydrated; otherwise use the cached
    // id. Either way we have a row id to send to the server.
    const likeId = userLike?.id ?? item.currentUserLikeId;
    if (likeId) removeLike(item.id, likeId);
  } else {
    addLike(item.id, {
      id: crypto.randomUUID(),
      userId: currentUser.id,
      userName: currentUser.displayName,
      createdAt: new Date().toISOString(),
    });
  }
};
```

- [ ] **Step 4: Replace the heart count and comment count to read from `likeCount` / `commentCount`**

Find the actions block (around lines 168-193). Replace the heart count line and the comment count IIFE:

```tsx
<div className="px-4 pb-3">
  <div className="flex items-center gap-4">
    <div className="flex items-center gap-1">
      <motion.button
        whileTap={{ scale: 1.15 }}
        onClick={handleLike}
      >
        <Heart size={18} className={`transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-zinc-600'}`} />
      </motion.button>
      {item.likeCount > 0 && (
        <span className={`text-[11px] ${isLiked ? 'text-red-500' : 'text-zinc-600'}`}>{item.likeCount}</span>
      )}
    </div>

    <span className="flex items-center gap-1.5">
      <MessageCircle size={18} className="text-zinc-600" />
      {item.commentCount > 0 && (
        <span className="text-[11px] text-zinc-600">{item.commentCount}</span>
      )}
    </span>

    <button onClick={handleShare} aria-label="Share">
      <Share2 size={18} className="text-zinc-600" />
    </button>
  </div>
```

- [ ] **Step 5: Replace the "Liked by..." row with a 3-state version (none / skeleton / real)**

Still in `feed-card.tsx`, find the block immediately after the actions (around lines 195-220):

```tsx
{/* Liked by */}
{item.likes.length > 0 && (
  <button ...>...</button>
)}
```

Replace with:

```tsx
{/* Liked by — three states:
    1. likeCount === 0: render nothing.
    2. likeCount > 0, likes empty (cache-only): render skeleton.
    3. likes populated: render real row.
    Heights match so layout doesn't shift between states 2 and 3. */}
{item.likeCount > 0 && item.likes.length === 0 && (
  <div className="flex items-center gap-2 mt-2" aria-hidden="true">
    <div className="flex -space-x-1.5">
      {Array.from({ length: Math.min(3, item.likeCount) }).map((_, i) => (
        <Skeleton key={i} variant="circle" className="w-4 h-4 ring-1 ring-black" />
      ))}
    </div>
    <Skeleton variant="text" className="h-3 w-32" />
  </div>
)}
{item.likes.length > 0 && (
  <button
    onClick={(e) => { e.stopPropagation(); setShowLikesList(true); }}
    className="flex items-center gap-2 mt-2"
  >
    <div className="flex -space-x-1.5">
      {item.likes.slice(0, 3).map((like) => {
        const user = getUserById(like.userId);
        return (
          <Avatar
            key={like.id}
            name={like.userName}
            size="xs"
            src={user?.avatarUrl ?? null}
            className="ring-1 ring-black"
          />
        );
      })}
    </div>
    <p className="text-[12px] text-zinc-400">
      Liked by <span className="font-semibold text-zinc-200">{item.likes[0].userId === currentUser?.id ? 'you' : item.likes[0].userName}</span>
      {item.likes.length > 1 && <> and <span className="font-semibold text-zinc-200">{item.likes.length - 1} other{item.likes.length - 1 !== 1 ? 's' : ''}</span></>}
    </p>
  </button>
)}
```

- [ ] **Step 6: Update the Likes List Modal inner content to render skeletons during the cache-only window**

The skeleton "Liked by..." row added in Step 5 is intentionally non-interactive (`aria-hidden`, no button) — the user can only open the modal from a populated row, which already has data. So this step is just a defensive update for the modal so it never renders an empty state when `likeCount > 0`.

Find the `AnimatePresence` block for the Likes List Modal (around lines 224-273) and replace the inner `max-h-[60dvh]` content:

```tsx
<div className="max-h-[60dvh] overflow-y-auto">
  {item.likes.length === 0 && item.likeCount > 0 ? (
    Array.from({ length: Math.min(5, item.likeCount) }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-5 py-3">
        <Skeleton variant="circle" className="w-8 h-8" />
        <Skeleton variant="text" className="h-4 w-32" />
      </div>
    ))
  ) : (
    item.likes.map((like) => {
      const user = getUserById(like.userId);
      return (
        <div
          key={like.id}
          onClick={(e) => {
            e.stopPropagation();
            setShowLikesList(false);
            router.push(like.userId === currentUser?.id ? '/profile' : `/profile/${like.userId}`);
          }}
          className="flex items-center gap-3 px-5 py-3 active:bg-white/[0.03] cursor-pointer"
        >
          <Avatar name={like.userName} size="sm" src={user?.avatarUrl ?? null} />
          <p className="text-sm font-medium truncate flex-1">
            {like.userId === currentUser?.id ? 'You' : like.userName}
          </p>
        </div>
      );
    })
  )}
</div>
```

No new state or effects in `FeedCard` — the `fetchFeed` already running on the feed page mount/focus is the backfill mechanism.

- [ ] **Step 7: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors.

- [ ] **Step 8: Manual check — feed card with cache-only state**

In dev: load the feed, like a post, reload, observe:
- Heart still filled red on the previously-liked post (driven by `currentUserLikeId`).
- Heart count still shows the right number.
- "Liked by..." row briefly shows 3 small grey circles + a text shimmer, then resolves to the real row when `fetchFeed` lands (~100-300ms).
- No layout jump between skeleton and real.

- [ ] **Step 9: Commit**

```bash
git add src/components/feed/feed-card.tsx
git commit -m "feed-card: render counts; skeleton 'Liked by' row when likes are stripped"
```

---

## Task 7: Update `PostDetailPage` — refetch effect, count rendering, comment skeletons

**Files:**
- Modify: `src/app/(app)/feed/[id]/post-detail.tsx`

- [ ] **Step 1: Add `Skeleton` import**

Find the existing import block (lines 1-19) and add:

```ts
import Skeleton from '@/components/ui/skeleton';
```

Also add `refreshFeedItem` to the existing `useFeedStore` selector block (around line 27):

```ts
const refreshFeedItem = useFeedStore((s) => s.refreshFeedItem);
```

- [ ] **Step 2: Add a mount-effect that refreshes when arrays were stripped from cache**

Insert this `useEffect` immediately after the existing "If the post isn't in the store" effect (the one that calls `fetchSinglePost`, around line 58-85):

```ts
// When the post hydrates from a cache that stripped likes/comments arrays
// (likes.length === 0 but likeCount > 0, etc.), kick a one-shot refresh so
// the comments section and "Liked by..." row backfill instead of staying
// permanently empty until the next focus refetch.
const needsRefresh = !!item && (
  (item.likes.length === 0 && item.likeCount > 0) ||
  (item.comments.length === 0 && item.commentCount > 0)
);
useEffect(() => {
  if (needsRefresh && resolvedId) {
    void refreshFeedItem(resolvedId);
  }
  // resolvedId is stable for this page; the effect runs once when needsRefresh flips true.
}, [needsRefresh, resolvedId, refreshFeedItem]);
```

- [ ] **Step 3: Replace `userLike` / `isLiked` derivation**

Find (around line 211-212):

```ts
const userLike = item.likes.find((l) => l.userId === currentUser?.id);
const isLiked = !!userLike;
```

Replace with:

```ts
const userLike = item.likes.find((l) => l.userId === currentUser?.id);
const isLiked = userLike != null || (item.likes.length === 0 && item.currentUserLikeId != null);
```

- [ ] **Step 4: Update `handleLike` for cache-only-window case**

Find (around line 218-230):

```ts
const handleLike = () => {
  if (!currentUser) return;
  if (isLiked) {
    removeLike(item.id, userLike!.id);
  } else {
    addLike(item.id, { ... });
  }
};
```

Replace with:

```ts
const handleLike = () => {
  if (!currentUser) return;
  if (isLiked) {
    const likeId = userLike?.id ?? item.currentUserLikeId;
    if (likeId) removeLike(item.id, likeId);
  } else {
    addLike(item.id, {
      id: crypto.randomUUID(),
      userId: currentUser.id,
      userName: currentUser.displayName,
      createdAt: new Date().toISOString(),
    });
  }
};
```

- [ ] **Step 5: Replace `totalCommentCount` to read from `commentCount`**

Find (around line 247):

```ts
const totalCommentCount = item.comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);
```

Replace with:

```ts
const totalCommentCount = item.commentCount;
```

- [ ] **Step 6: Update the heart-row count and "Liked by..." row**

Find the actions block (around lines 411-453) and update the heart count + "Liked by..." block:

```tsx
{/* Actions */}
<div className="pb-3 mb-3 border-b border-white/[0.05]">
  <div className="flex items-center gap-4">
    <div className="flex items-center gap-1">
      <motion.button whileTap={{ scale: 1.15 }} onClick={handleLike}>
        <Heart size={18} className={`transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-zinc-600'}`} />
      </motion.button>
      {item.likeCount > 0 && (
        <span className={`text-[11px] ${isLiked ? 'text-red-500' : 'text-zinc-600'}`}>{item.likeCount}</span>
      )}
    </div>
    <button onClick={handleShare}><Share2 className="w-[18px] h-[18px] text-zinc-600" /></button>
    <span className="text-[11px] text-zinc-700 ml-auto">
      {totalCommentCount} comment{totalCommentCount !== 1 ? 's' : ''}
    </span>
  </div>

  {/* Liked by — see FeedCard for the same three-state pattern. */}
  {item.likeCount > 0 && item.likes.length === 0 && (
    <div className="flex items-center gap-2 mt-2" aria-hidden="true">
      <div className="flex -space-x-1.5">
        {Array.from({ length: Math.min(3, item.likeCount) }).map((_, i) => (
          <Skeleton key={i} variant="circle" className="w-4 h-4 ring-1 ring-black" />
        ))}
      </div>
      <Skeleton variant="text" className="h-3 w-32" />
    </div>
  )}
  {item.likes.length > 0 && (
    <button
      onClick={() => setShowLikesList(true)}
      className="flex items-center gap-2 mt-2"
    >
      <div className="flex -space-x-1.5">
        {item.likes.slice(0, 3).map((like) => {
          const user = getUserById(like.userId);
          return (
            <Avatar
              key={like.id}
              name={like.userName}
              size="xs"
              src={user?.avatarUrl ?? null}
              className="ring-1 ring-black"
            />
          );
        })}
      </div>
      <p className="text-[12px] text-zinc-400">
        Liked by <span className="font-semibold text-zinc-200">{item.likes[0].userId === currentUser?.id ? 'you' : item.likes[0].userName}</span>
        {item.likes.length > 1 && <> and <span className="font-semibold text-zinc-200">{item.likes.length - 1} other{item.likes.length - 1 !== 1 ? 's' : ''}</span></>}
      </p>
    </button>
  )}
</div>
```

- [ ] **Step 7: Wrap the existing comments block with a third (skeleton) state**

The existing comments block at `src/app/(app)/feed/[id]/post-detail.tsx:455-567` has two branches:

- `item.comments.length === 0` → "No comments yet"
- otherwise → render the comment list

Change ONLY the outer conditional. The comment-rendering JSX (the entire `item.comments.map((comment, i) => { ... })` body) stays byte-for-byte identical.

**Concretely**, the existing line:
```tsx
{item.comments.length === 0 ? (
  <p className="text-sm text-zinc-700 text-center py-6">No comments yet — be the first</p>
) : (
  <div className="space-y-4">
    {item.comments.map((comment, i) => {
```

becomes:
```tsx
{item.commentCount === 0 ? (
  <p className="text-sm text-zinc-700 text-center py-6">No comments yet — be the first</p>
) : item.comments.length === 0 ? (
  <div className="space-y-4" aria-hidden="true">
    {Array.from({ length: Math.min(3, item.commentCount) }).map((_, i) => (
      <div key={i} className="flex gap-3">
        <Skeleton variant="circle" className="w-8 h-8 shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton variant="text" className="h-3 w-full max-w-[260px]" />
          <Skeleton variant="text" className="h-3 w-2/3" />
        </div>
      </div>
    ))}
  </div>
) : (
  <div className="space-y-4">
    {item.comments.map((comment, i) => {
```

The closing of the original conditional `})}</div>)}` at the end of the map remains unchanged — it now closes the third (real-list) branch instead of the second.

State semantics:
1. `commentCount === 0` → real "no comments" message *(unchanged)*.
2. `commentCount > 0 && comments.length === 0` (cache-only) → 3 skeleton rows.
3. `comments.length > 0` → real list *(unchanged)*.

- [ ] **Step 8: Update the Likes List Modal to render skeletons during the cache-only window**

Find the modal block (around lines 754-801) and replace the inner list (`max-h-[60dvh]` div content):

```tsx
<div className="max-h-[60dvh] overflow-y-auto">
  {item.likes.length === 0 && item.likeCount > 0 ? (
    Array.from({ length: Math.min(5, item.likeCount) }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-5 py-3">
        <Skeleton variant="circle" className="w-8 h-8" />
        <Skeleton variant="text" className="h-4 w-32" />
      </div>
    ))
  ) : item.likes.length === 0 ? (
    <div className="py-12 text-center">
      <p className="text-sm text-zinc-600">No likes yet</p>
    </div>
  ) : (
    item.likes.map((like) => (
      <div
        key={like.id}
        onClick={() => { setShowLikesList(false); goToUser(like.userId); }}
        className="flex items-center gap-3 px-5 py-3 active:bg-white/[0.03] cursor-pointer"
      >
        <Avatar name={like.userName} size="sm" src={getUserById(like.userId)?.avatarUrl ?? null} />
        <p className="text-sm font-medium truncate flex-1">
          {like.userId === currentUser?.id ? 'You' : like.userName}
        </p>
      </div>
    ))
  )}
</div>
```

- [ ] **Step 9: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors.

- [ ] **Step 10: Manual check — deep-link to a post in cache-only state**

In dev: like a post and add a comment to it, then reload. Open the post by tapping it. Observe:
- Heart filled correctly.
- Heart count and comments-count header correct.
- Comments section briefly shows 3 skeleton rows, then the real comments slide in (within ~200-300ms).
- "Liked by..." row briefly shows skeleton, then resolves.
- No "No comments yet" flash on a post that has comments.

- [ ] **Step 11: Commit**

```bash
git add 'src/app/(app)/feed/[id]/post-detail.tsx'
git commit -m "post-detail: skeleton comments/likes when cache stripped, refetch on mount"
```

---

## Task 8: Add `logStorageUsage` and call it once on app mount

**Files:**
- Create: `src/lib/storage/log-storage-usage.ts`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Create the logger**

Create `src/lib/storage/log-storage-usage.ts` with:

```ts
// Dev-only one-shot summary of every hd-* localStorage key's byte size.
// Helps decide whether any further stores need trimming. Skips production.
export function logStorageUsage(): void {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV !== 'development') return;

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
  for (const [k, s] of rows) {
    console.log(`${k.padEnd(20)} ${(s / 1024).toFixed(1)} KB`);
  }
  console.groupEnd();
}
```

- [ ] **Step 2: Wire it into the app layout**

Open `src/app/(app)/layout.tsx`. Read the file first to identify a suitable client component or boundary that runs once on mount. If `(app)/layout.tsx` is a Server Component, the logger needs a small client wrapper.

If `layout.tsx` is already a client component (`'use client'` at top), add:

```tsx
import { useEffect } from 'react';
import { logStorageUsage } from '@/lib/storage/log-storage-usage';
```

Then near the top of the layout component body, before the return statement:

```ts
useEffect(() => {
  logStorageUsage();
}, []);
```

If `layout.tsx` is a Server Component, instead create a tiny mounter component `src/components/system/storage-usage-logger.tsx`:

```tsx
'use client';
import { useEffect } from 'react';
import { logStorageUsage } from '@/lib/storage/log-storage-usage';

export function StorageUsageLogger() {
  useEffect(() => { logStorageUsage(); }, []);
  return null;
}
```

…and render `<StorageUsageLogger />` once inside the layout's children, alongside the existing client providers.

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors.

- [ ] **Step 4: Manual check — log fires once in dev**

Restart the dev server, open the app in a fresh tab. In DevTools console you should see a collapsed group `[storage] hd-* total: XX.X KB` with one row per key. Confirm `hd-feed` is well under 1 MB.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/log-storage-usage.ts 'src/app/(app)/layout.tsx'
# If a wrapper component was created:
# git add src/components/system/storage-usage-logger.tsx
git commit -m "storage: dev-only logger for hd-* localStorage usage"
```

---

## Task 9: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, no lint errors.

- [ ] **Step 2: Quota happy-path verification**

In dev, fresh browser profile (or `localStorage.clear()`):
1. Sign in.
2. Scroll feed past 20 items.
3. Like 3-5 posts (mix of own + others).
4. Comment on 2 posts.
5. Reload.

Confirm:
- Cards render instantly (no full-page skeleton, but inline skeletons may briefly appear on "Liked by..." row).
- Hearts filled red on the posts you liked (driven by `currentUserLikeId`).
- Heart counts and comment counts correct.
- "Liked by..." row resolves from skeleton to real users within ~300ms.
- No `QuotaExceededError` in console.
- DevTools → Application → Local Storage: `hd-feed` value length < 200,000 chars.

- [ ] **Step 3: Deep-link verification**

Open `/feed?post=<id>` for a post NOT among the 20 cached. Observe:
- Spinner → post loads.
- Comments section shows skeleton rows (if `commentCount > 0`), then real comments arrive.
- "Liked by..." row shows skeleton (if `likeCount > 0`), then real row arrives.

- [ ] **Step 4: Migration verification**

Before applying the new build, in DevTools console of the OLD running build:
```js
localStorage.setItem('hd-feed', JSON.stringify({
  state: { items: [{ id: 'fake', likes: [{ id: 'l1', userId: 'u1', userName: 'a', createdAt: new Date().toISOString() }], comments: [] }] },
  version: 0
}));
```
Then reload with the new build. Confirm:
- No crash.
- `JSON.parse(localStorage.getItem('hd-feed')).version === 2`.
- The fake item is gone (migrate dropped pre-v2 cache).
- Feed refetches fresh and renders normally.

- [ ] **Step 5: Cross-store quota check**

In DevTools console after a normal session:
```js
Object.keys(localStorage).filter(k => k.startsWith('hd-')).forEach(k => console.log(k, (localStorage.getItem(k)?.length ?? 0) / 1024, 'KB'));
```
Confirm total well under 1 MB. If `hd-groups` shows >100 KB, that's the next follow-up (out of scope here).

- [ ] **Step 6: No commit needed for this task** — all verification is read-only.

---

## Self-Review

Spec coverage check:

| Spec section | Plan task |
|---|---|
| Persisted-state shape: `hd-feed` (trim 20, strip likes/comments, add 3 count fields) | Task 1, Task 3 |
| Persisted-state shape: `hd-sessions` (100→30) | Task 4 |
| Persisted-state shape: `hd-roasts` (50→8) | Task 5 |
| Persisted-state shape: `hd-groups` (no change) | (no task — intentional) |
| Render-path: `FeedCard` counts + skeleton "Liked by" + skeleton modal | Task 6 |
| Render-path: `PostDetailPage` mount-effect refetch + counts + comment skeleton + likes skeleton | Task 7 |
| Store-mutation discipline: `deriveCounts` helper + every callsite | Task 2 |
| Type changes: `FeedItem` gains `likeCount`, `currentUserLikeId`, `commentCount` | Task 1 |
| `partialize` implementations | Tasks 3, 4, 5 |
| Migration: `version: 2` + drop-cache migrate on all three stores | Tasks 3, 4, 5 |
| Cross-user cache caveat | Documented in Task 1's interface comments and Task 6's `isLiked` comment; spec marks runtime null-out as optional/deferred |
| Instrumentation: `logStorageUsage` + wire-up | Task 8 |
| Verification: build + manual + migration smoke + storage usage | Task 9 |

No spec section is unimplemented.
