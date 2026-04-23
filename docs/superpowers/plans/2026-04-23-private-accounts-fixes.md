# Private Accounts Bug Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four bugs in the shipped private-accounts feature — restore correct state after second settings open, stop spurious "Failed to send request" toasts, converge the requester's following list when a request is accepted, and surface the follow-requests inbox in the feed header.

**Architecture:** Four targeted fixes across one store (`use-auth-store.ts`), one new shared hook (`use-follow-state.ts`), and two UI sites (feed page, suggested-people carousel). No schema changes. Realtime convergence achieved by adding a second Supabase channel subscribed to the current user's outgoing follow requests.

**Tech Stack:** Next.js (App Router), React, Zustand, Supabase (auth + realtime), TypeScript, Tailwind, lucide-react. No test runner is configured in this repo; verification uses `npx tsc --noEmit`, `npm run lint`, `npm run build`, and the manual checklist in the spec.

**Spec:** [docs/superpowers/specs/2026-04-23-private-accounts-fixes-design.md](../specs/2026-04-23-private-accounts-fixes-design.md)

---

## File Map

| Path | Responsibility | Action |
|------|---------------|--------|
| `src/stores/use-auth-store.ts` | Auth store: profile load, follow logic, realtime subs | Modify |
| `src/hooks/use-follow-state.ts` | Derive three-way follow state (`following`/`pending`/`none`) for any user | Create |
| `src/app/(app)/feed/page.tsx` | Feed header + discover list | Modify |
| `src/components/feed/suggested-people-carousel.tsx` | Suggested-people horizontal carousel | Modify |

No changes to: SQL migrations, RLS, profile page, requests page, notifications infra.

---

## Task 1: Include `is_private` in `initialize()` profile SELECT (Fix #4)

**Why first:** Other fixes reference `currentUser.isPrivate`; everything is more predictable when it's correct.

**Files:**
- Modify: `src/stores/use-auth-store.ts:69-73`

- [ ] **Step 1: Add `is_private` to the profile SELECT column list**

Change the query at line 69-73. Current:

```ts
const { data: profile } = await supabase
  .from('profiles')
  .select('id, username, display_name, avatar_url, bio, gender, weight_kg, height_cm, created_at')
  .eq('id', session.user.id)
  .single();
```

Replace with:

```ts
const { data: profile } = await supabase
  .from('profiles')
  .select('id, username, display_name, avatar_url, bio, gender, weight_kg, height_cm, is_private, created_at')
  .eq('id', session.user.id)
  .single();
```

No other changes needed — `profileFromRow` at line 52 already maps `row.is_private` to `isPrivate`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

1. In DB (Supabase SQL editor or via app), set your own profile to `is_private = true`.
2. Hard-refresh the app.
3. Open `/profile/settings`.
4. Expected: the "Private account" toggle shows ON (teal background, knob to the right).

- [ ] **Step 4: Commit**

```bash
git add src/stores/use-auth-store.ts
git commit -m "fix: load is_private in initialize so settings toggle persists"
```

---

## Task 2: Subscribe to outgoing-request acceptance & propagate to local state (Fix #3)

**Files:**
- Modify: `src/stores/use-auth-store.ts` — module-scoped channel ref (~line 38), `initialize()` body (line 92-106 area), `logout()` body (line 161-167)

- [ ] **Step 1: Add module-scoped channel ref**

At the top of the file next to the existing `_followRequestsChannel` declaration (currently line 38), add a sibling:

```ts
let _followRequestsChannel: ReturnType<typeof supabase.channel> | null = null;
let _outgoingRequestsChannel: ReturnType<typeof supabase.channel> | null = null;
```

- [ ] **Step 2: Add the second channel in `initialize()`**

Directly after the existing `.subscribe();` call that closes `_followRequestsChannel` (currently line 106, inside the `if (profile)` block), add:

```ts
_outgoingRequestsChannel = supabase
  .channel('outgoing-follow-requests')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'follow_requests',
      filter: `requester_id=eq.${session.user.id}`,
    },
    (payload) => {
      const row = payload.new as { id: string; target_id: string; status: 'pending' | 'accepted' | 'rejected' };
      const { currentUser, allUsers, outgoingRequests } = get();
      if (!currentUser) return;

      // Drop from outgoing regardless of terminal status
      const nextOutgoing = outgoingRequests.filter((r) => r.id !== row.id && r.targetId !== row.target_id);

      if (row.status === 'accepted') {
        const alreadyFollowing = currentUser.following.includes(row.target_id);
        const nextFollowing = alreadyFollowing
          ? currentUser.following
          : [...currentUser.following, row.target_id];
        const nextCurrentUser = { ...currentUser, following: nextFollowing };
        const nextAllUsers = allUsers.map((u) => {
          if (u.id === currentUser.id) return nextCurrentUser;
          if (u.id === row.target_id && !u.followers.includes(currentUser.id)) {
            return { ...u, followers: [...u.followers, currentUser.id] };
          }
          return u;
        });
        set({ currentUser: nextCurrentUser, allUsers: nextAllUsers, outgoingRequests: nextOutgoing });
      } else if (row.status === 'rejected') {
        set({ outgoingRequests: nextOutgoing });
      }
    }
  )
  .subscribe();
```

- [ ] **Step 3: Tear down the new channel on logout**

Update `logout` (currently lines 160-167). Current body:

```ts
logout: async () => {
  if (_followRequestsChannel) {
    supabase.removeChannel(_followRequestsChannel);
    _followRequestsChannel = null;
  }
  await supabase.auth.signOut();
  set({ currentUser: null, allUsers: [], isAuthenticated: false, followRequests: [], outgoingRequests: [] });
},
```

Replace with:

```ts
logout: async () => {
  if (_followRequestsChannel) {
    supabase.removeChannel(_followRequestsChannel);
    _followRequestsChannel = null;
  }
  if (_outgoingRequestsChannel) {
    supabase.removeChannel(_outgoingRequestsChannel);
    _outgoingRequestsChannel = null;
  }
  await supabase.auth.signOut();
  set({ currentUser: null, allUsers: [], isAuthenticated: false, followRequests: [], outgoingRequests: [] });
},
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification (requires two browsers / two accounts)**

1. As user **A** (any account), send a follow request to user **B** (private account) from A's feed discover or B's profile.
2. In a second browser, log in as **B** and open `/profile/requests`. Accept A's request.
3. Switch back to A's tab (do NOT reload).
4. Within ~1–2 seconds, A's following count should increase by 1 and B should appear in A's following list.
5. Navigate to B's profile from A's tab — button should read "Following".
6. Repeat with a **reject** — A's pending request should silently disappear from A's profile/discover state (no toast).

- [ ] **Step 6: Commit**

```bash
git add src/stores/use-auth-store.ts
git commit -m "fix: realtime-sync following list when private target accepts request"
```

---

## Task 3: Make `sendFollowRequest` idempotent (Fix #2 — store side)

**Files:**
- Modify: `src/stores/use-auth-store.ts:348-399` (`sendFollowRequest` method)

- [ ] **Step 1: Rewrite `sendFollowRequest` to short-circuit on existing local state and treat unique-violation errors as success**

Replace the entire `sendFollowRequest` method (currently lines 348-399) with:

```ts
sendFollowRequest: async (targetId) => {
  const { currentUser, outgoingRequests } = get();
  if (!currentUser) return;

  // Idempotent: if a local pending row already exists, nothing to do.
  if (outgoingRequests.some((r) => r.targetId === targetId)) return;

  // Clean up any prior terminal (accepted/rejected) rows so the unique
  // constraint doesn't block the new pending row.
  await supabase
    .from('follow_requests')
    .delete()
    .eq('requester_id', currentUser.id)
    .eq('target_id', targetId)
    .in('status', ['accepted', 'rejected']);

  const optimistic: FollowRequest = {
    id: crypto.randomUUID(),
    requesterId: currentUser.id,
    targetId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  set({ outgoingRequests: [...outgoingRequests, optimistic] });

  const { data, error } = await supabase
    .from('follow_requests')
    .insert({ requester_id: currentUser.id, target_id: targetId })
    .select('id')
    .single();

  if (error) {
    // 23505 = unique_violation. A pending row already exists server-side
    // (e.g. from a prior attempt that errored out locally). Recover the id
    // instead of showing a failure.
    if ((error as { code?: string }).code === '23505') {
      const { data: existing } = await supabase
        .from('follow_requests')
        .select('id')
        .eq('requester_id', currentUser.id)
        .eq('target_id', targetId)
        .eq('status', 'pending')
        .maybeSingle();
      if (existing) {
        set({
          outgoingRequests: get().outgoingRequests.map((r) =>
            r.targetId === targetId ? { ...r, id: existing.id } : r
          ),
        });
        return;
      }
    }
    console.error('Failed to send follow request:', error);
    set({ outgoingRequests: outgoingRequests.filter((r) => r.targetId !== targetId) });
    useUIStore.getState().addToast('Failed to send request', 'error');
    return;
  }

  if (data) {
    set({
      outgoingRequests: get().outgoingRequests.map((r) =>
        r.targetId === targetId ? { ...r, id: data.id } : r
      ),
    });
    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          recipientId: targetId,
          type: 'follow_request',
          title: 'Follow Request',
          body: `@${currentUser.username} requested to follow you`,
          data: { userId: currentUser.id },
        },
      });
    } catch { /* notification failure is non-critical */ }
  }
},
```

Notes:
- Short-circuit (`outgoingRequests.some(...)`) prevents a duplicate DB call when the UI has already optimistically added a pending row.
- The `23505` branch handles the case where local state is stale (e.g. user cleared cache but DB still has a pending row).
- The push-notification block moved inside the success path and uses `currentUser` captured at the top — no extra `get()` call.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

1. Log in as user A (public). Pick a private user B.
2. Via Supabase SQL editor, insert a stale pending row manually:
   ```sql
   INSERT INTO follow_requests (requester_id, target_id, status)
   VALUES ('<A_id>', '<B_id>', 'pending');
   ```
3. In the app, DO NOT reload (so A's local `outgoingRequests` is empty).
4. Go to discover and click "Follow" on B.
5. Expected: no "Failed to send request" toast. The button state should transition correctly (verified in Task 5).
6. Check `follow_requests` in DB — exactly one pending row (id unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/stores/use-auth-store.ts
git commit -m "fix: make sendFollowRequest idempotent on stale pending rows"
```

---

## Task 4: Create `useFollowState` hook (Fix #2 — shared logic)

**Files:**
- Create: `src/hooks/use-follow-state.ts`

- [ ] **Step 1: Write the hook**

Create `src/hooks/use-follow-state.ts` with:

```ts
'use client';

import { useCallback } from 'react';
import { useAuthStore } from '@/stores/use-auth-store';

export type FollowState = 'following' | 'pending' | 'none' | 'self';

export interface FollowStateResult {
  state: FollowState;
  label: string;
  onClick: () => void;
}

/**
 * Three-way follow state for a target user, with the correct action bound.
 * - `following` → clicking unfollows
 * - `pending`   → clicking cancels the outgoing request
 * - `none`      → clicking follows (or sends a request if target is private)
 * - `self`      → no-op; callers should hide the button
 */
export function useFollowState(targetUserId: string): FollowStateResult {
  const currentUserId = useAuthStore((s) => s.currentUser?.id);
  const isFollowing = useAuthStore((s) =>
    !!s.currentUser?.following.includes(targetUserId)
  );
  const isPending = useAuthStore((s) =>
    s.outgoingRequests.some((r) => r.targetId === targetUserId)
  );
  const toggleFollow = useAuthStore((s) => s.toggleFollow);
  const cancelFollowRequest = useAuthStore((s) => s.cancelFollowRequest);

  const isSelf = currentUserId === targetUserId;

  const state: FollowState = isSelf
    ? 'self'
    : isFollowing
      ? 'following'
      : isPending
        ? 'pending'
        : 'none';

  const onClick = useCallback(() => {
    if (state === 'self') return;
    if (state === 'pending') {
      cancelFollowRequest(targetUserId);
    } else {
      // toggleFollow handles both follow and unfollow, and routes through
      // sendFollowRequest when the target is private.
      toggleFollow(targetUserId);
    }
  }, [state, targetUserId, toggleFollow, cancelFollowRequest]);

  const label =
    state === 'following' ? 'Following' :
    state === 'pending' ? 'Requested' :
    'Follow';

  return { state, label, onClick };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-follow-state.ts
git commit -m "feat: add useFollowState hook for three-way follow button"
```

---

## Task 5: Adopt `useFollowState` in the discover search list (Fix #2 — feed UI)

**Files:**
- Modify: `src/app/(app)/feed/page.tsx:329-366` (the `searchResults` map)

- [ ] **Step 1: Extract a small component for the discover row**

At the top of `feed/page.tsx`, add an import alongside the existing ones:

```ts
import { useFollowState } from '@/hooks/use-follow-state';
```

Then, above `FeedPageList` (near the other top-level helpers in the file), add a new component. The reason for extracting rather than inlining is that `useFollowState` is a hook and can't be called inside a `.map()` body without its own component:

```tsx
function DiscoverUserRow({ user, onOpenProfile }: { user: UserProfile; onOpenProfile: (id: string) => void }) {
  const { state, label, onClick } = useFollowState(user.id);
  if (state === 'self') return null;

  const isAccent = state === 'none';
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] active:bg-white/[0.05] transition-colors">
      <div onClick={() => onOpenProfile(user.id)} className="cursor-pointer">
        <Avatar name={user.displayName} size="md" src={user.avatarUrl} />
      </div>
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onOpenProfile(user.id)}
      >
        <p className="text-sm font-semibold truncate">{user.displayName}</p>
        <p className="text-[11px] text-zinc-500">@{user.username}{user.isPrivate && <Lock className="w-3 h-3 text-zinc-600 inline ml-1" />}</p>
      </div>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => { hapticLight(); onClick(); }}
        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          isAccent
            ? 'bg-accent text-black'
            : 'bg-white/[0.06] border border-white/[0.08] text-zinc-400'
        }`}
      >
        {label}
      </motion.button>
    </div>
  );
}
```

- [ ] **Step 2: Replace the inline search-results map with the new component**

Find the block at lines 329-366:

```tsx
{!searching && searchResults.length > 0 && (
  <>
    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">People</p>
    <div className="space-y-1.5">
      {searchResults.map((user) => {
        const isFollowing = followingIds.includes(user.id);
        return (
          <div
            key={user.id}
            ...
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { hapticLight(); toggleFollow(user.id); }}
              className={...}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </motion.button>
          </div>
        );
      })}
    </div>
  </>
)}
```

Replace with:

```tsx
{!searching && searchResults.length > 0 && (
  <>
    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">People</p>
    <div className="space-y-1.5">
      {searchResults.map((user) => (
        <DiscoverUserRow
          key={user.id}
          user={user}
          onOpenProfile={(id) => router.push(`/profile/${id}`)}
        />
      ))}
    </div>
  </>
)}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors. If `followingIds` or `toggleFollow` become unused in this file because of this change, remove the now-dead local variable declarations to satisfy lint (do NOT remove the Zustand subscription if it's still used by `SuggestedPeopleCarousel` below).

- [ ] **Step 4: Manual verification**

1. Log in as user A. In discover, search for a public user B you already follow.
   - Expected button: "Following" (neutral style).
2. Search for a private user C you've already sent a request to.
   - Expected button: "Requested" (neutral style). Click → request canceled; button flips to "Follow" (accent style).
3. Search for yourself — the row should not render (filtered by `state === 'self'`).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/feed/page.tsx
git commit -m "fix: discover list shows Requested state for pending follows"
```

---

## Task 6: Adopt `useFollowState` in the suggested-people carousel (Fix #2 — carousel UI)

**Files:**
- Modify: `src/components/feed/suggested-people-carousel.tsx`
- Modify: `src/app/(app)/feed/page.tsx` (caller — drop now-unused `onFollow` / `followingIds` props)

- [ ] **Step 1: Rewrite the carousel to use the hook**

Replace the full contents of `src/components/feed/suggested-people-carousel.tsx` with:

```tsx
'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '@/components/ui/avatar';
import { useFollowState } from '@/hooks/use-follow-state';
import { hapticLight } from '@/lib/haptics';
import type { UserProfile } from '@/types';
import type { FeedItem } from '@/types/feed';

interface SuggestedPeopleCarouselProps {
  users: UserProfile[];
  feedItems: FeedItem[];
  onViewProfile: (userId: string) => void;
}

export function SuggestedPeopleCarousel({
  users,
  feedItems,
  onViewProfile,
}: SuggestedPeopleCarouselProps) {
  const userStats = useMemo(() => {
    const map = new Map<string, { sessions: number; drinks: number }>();
    for (const item of feedItems) {
      const prev = map.get(item.userId) ?? { sessions: 0, drinks: 0 };
      map.set(item.userId, {
        sessions: prev.sessions + 1,
        drinks: prev.drinks + item.sessionSummary.totalDrinks,
      });
    }
    return map;
  }, [feedItems]);

  if (users.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4 pb-2">
      <AnimatePresence>
        {users.map((user, i) => {
          const stats = userStats.get(user.id);
          const statLabel = stats
            ? stats.sessions === 1
              ? '1 sesh'
              : `${stats.sessions} seshes`
            : 'New member';

          return (
            <SuggestedPersonCard
              key={user.id}
              user={user}
              index={i}
              statLabel={statLabel}
              onViewProfile={onViewProfile}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function SuggestedPersonCard({
  user,
  index,
  statLabel,
  onViewProfile,
}: {
  user: UserProfile;
  index: number;
  statLabel: string;
  onViewProfile: (userId: string) => void;
}) {
  const { state, label, onClick } = useFollowState(user.id);
  if (state === 'self') return null;
  const isAccent = state === 'none';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      transition={{ delay: index < 6 ? index * 0.04 : 0 }}
      className="shrink-0 snap-start w-[130px] rounded-2xl bg-white/[0.03] border border-white/[0.05] p-3.5 flex flex-col items-center"
    >
      <div onClick={() => onViewProfile(user.id)} className="cursor-pointer flex flex-col items-center">
        <Avatar name={user.displayName} size="lg" src={user.avatarUrl} />
        <p className="text-sm font-semibold truncate w-full text-center mt-2">{user.displayName}</p>
        <p className="text-[11px] text-zinc-600 truncate w-full text-center">@{user.username}</p>
        <span className="text-[10px] text-zinc-500 bg-white/[0.04] rounded-full px-2 py-0.5 mt-1.5">
          {statLabel}
        </span>
      </div>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => { hapticLight(); onClick(); }}
        className={`mt-3 w-full py-1.5 rounded-lg text-xs font-semibold transition-all ${
          isAccent
            ? 'bg-accent text-black'
            : 'bg-white/[0.06] border border-white/[0.08] text-zinc-400'
        }`}
      >
        {label}
      </motion.button>
    </motion.div>
  );
}
```

- [ ] **Step 2: Update the caller in `feed/page.tsx`**

Find the `<SuggestedPeopleCarousel .../>` usage (around line 394-399):

```tsx
<SuggestedPeopleCarousel
  users={discoverUsers}
  feedItems={items}
  followingIds={followingIds}
  onFollow={toggleFollow}
  onViewProfile={(id) => router.push(`/profile/${id}`)}
/>
```

Replace with:

```tsx
<SuggestedPeopleCarousel
  users={discoverUsers}
  feedItems={items}
  onViewProfile={(id) => router.push(`/profile/${id}`)}
/>
```

- [ ] **Step 3: Remove now-unused local bindings**

After Task 5 and this task, `followingIds` and `toggleFollow` may be unused in `feed/page.tsx`. Check with lint:

Run: `npm run lint`

If the linter flags either as unused, remove their declarations at the top of `FeedPageList`. If they're still referenced elsewhere (e.g. `const followingIds = useMemo(...)` used by some other branch), keep them.

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual verification**

1. In discover, the suggested-people carousel should show "Follow" on public unknowns, "Following" on already-followed users, and "Requested" on private users with pending outgoing requests.
2. Clicking "Requested" cancels the request; button flips to "Follow".

- [ ] **Step 6: Commit**

```bash
git add src/components/feed/suggested-people-carousel.tsx src/app/\(app\)/feed/page.tsx
git commit -m "fix: suggested-people carousel respects pending follow requests"
```

---

## Task 7: Follow-requests button in feed header (Fix #1)

**Files:**
- Modify: `src/app/(app)/feed/page.tsx` — imports, header block around lines 242-252

- [ ] **Step 1: Import `UserPlus` and the selectors we need**

In the existing lucide import at the top of `feed/page.tsx`:

```ts
import { Search, X, Bell, Lock } from 'lucide-react';
```

Add `UserPlus`:

```ts
import { Search, X, Bell, Lock, UserPlus } from 'lucide-react';
```

Inside `FeedPageList`, next to the existing `useAuthStore` selectors, add:

```ts
const isPrivateAccount = useAuthStore((s) => s.currentUser?.isPrivate ?? false);
const followRequestsCount = useAuthStore((s) => s.followRequests.length);
```

- [ ] **Step 2: Render the button next to Bell**

Find the header block (currently lines 242-252):

```tsx
<div className="flex items-center gap-0.5">
  <button
    onClick={() => router.push('/notifications')}
    aria-label="Notifications"
    className="relative p-2 rounded-xl hover:bg-white/5 active:bg-white/[0.08]"
  >
    <Bell className="w-5 h-5 text-zinc-500" />
    {unreadCount > 0 && (
      <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
    )}
  </button>
  ...
```

Insert a new button immediately **before** the Bell button (so it appears to the left). The visibility predicate: show whenever the account is private OR there are pending requests:

```tsx
<div className="flex items-center gap-0.5">
  {(isPrivateAccount || followRequestsCount > 0) && (
    <button
      onClick={() => router.push('/profile/requests')}
      aria-label="Follow requests"
      className="relative p-2 rounded-xl hover:bg-white/5 active:bg-white/[0.08]"
    >
      <UserPlus className="w-5 h-5 text-zinc-500" />
      {followRequestsCount > 0 && (
        <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
      )}
    </button>
  )}
  <button
    onClick={() => router.push('/notifications')}
    aria-label="Notifications"
    ...
```

- [ ] **Step 3: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 4: Manual verification**

1. Log in as a public user with zero pending requests.
   - Expected: header shows only Bell + Search (no UserPlus).
2. Flip account to private in Settings and return to feed.
   - Expected: UserPlus appears to the left of Bell. No red dot (no pending requests).
3. From another account, send this user a follow request.
   - Expected: within ~1s (existing realtime sub refreshes `followRequests`), red dot appears on UserPlus.
4. Click UserPlus → lands on `/profile/requests` and shows the pending request.
5. Accept or reject → red dot disappears (list empties).
6. Flip account back to public. If `followRequests.length === 0`, the UserPlus button disappears; if there are stragglers, it remains until the list empties.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/feed/page.tsx
git commit -m "feat: show follow-requests button with unread badge in feed header"
```

---

## Task 8: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 2: Dev-server smoke test**

Start the dev server:

```bash
npm run dev
```

Walk the manual checklist from the spec:

1. **Fix 4:** Private toggle persists on second Settings open.
2. **Fix 1:** Private user sees UserPlus+red-dot in feed header; routes correctly.
3. **Fix 2a:** Discover list / suggested carousel show three states (`Follow` / `Requested` / `Following`). Clicking `Requested` cancels; click cycle is reliable.
4. **Fix 2b:** Seeding a stale pending row in the DB no longer produces a "Failed to send request" toast on retry.
5. **Fix 3:** When a private target accepts, the requester's following list updates live (no reload required). Reject is silent.

Any regression? Stop and fix before continuing.

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin darahaas15/private-acct-fixes
gh pr create --title "Fix private accounts: state, badge, idempotent requests" --body "$(cat <<'EOF'
## Summary
- Persist `is_private` on login so the Settings toggle reflects real DB state.
- Make `sendFollowRequest` idempotent (handle stale pending rows / unique-violation).
- Add a second realtime channel so the requester's following list updates when a private target accepts.
- Surface the follow-requests inbox on the feed header with an unread badge.

## Test plan
- [ ] Private toggle stays on after reload + second Settings open
- [ ] Discover + suggested carousel render `Follow` / `Requested` / `Following` correctly
- [ ] Stale pending row in DB no longer triggers "Failed to send request" toast
- [ ] Accepting a request on account B makes account A's following list update live
- [ ] Rejecting a request silently clears it from A's outgoing state
- [ ] Header `UserPlus` appears for private users and for any user with pending requests; red dot clears when list empties
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Fix 1 (header button) → Task 7 ✓
- Fix 2a (pending-aware button) → Tasks 4, 5, 6 ✓
- Fix 2b (idempotent request) → Task 3 ✓
- Fix 3 (outgoing realtime) → Task 2 ✓
- Fix 4 (is_private in SELECT) → Task 1 ✓
- `useFollowState` hook (shared) → Task 4 ✓
- Logout cleanup for second channel → Task 2 Step 3 ✓
- "No toast on reject" → Task 2 Step 2 (rejected branch is silent) ✓
- Visibility: private OR pending → Task 7 Step 2 ✓

**Placeholder scan:** No TBD / TODO / "similar to" references; every code step is a complete replacement block.

**Type consistency:**
- `useFollowState` returns `{ state, label, onClick }`; both consumers (`DiscoverUserRow`, `SuggestedPersonCard`) destructure identically. ✓
- `FollowState` union (`'following' | 'pending' | 'none' | 'self'`) — `'self'` is handled consistently with `return null`. ✓
- `_outgoingRequestsChannel` typed the same as `_followRequestsChannel`. ✓
- `row.status` narrowed to the three literal values in Task 2. ✓

**Scope:** Single PR, four tightly-coupled fixes, ~5 files touched. Right-sized.
