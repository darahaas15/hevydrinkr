# Private Accounts — Bug Fixes & UX Polish

**Date:** 2026-04-23
**Status:** Design approved
**Depends on:** [2026-04-23-private-accounts-design.md](./2026-04-23-private-accounts-design.md) (feature already shipped in PR #9)

## Context

Four user-reported issues in the shipped private-accounts feature:

1. Follow requests inbox is buried inside `/profile`. No affordance on the feed.
2. Clicking "Follow" on a private user from the discover/search list often shows "Failed to send request" — yet the request *does* arrive on the target. Reopening the target's profile shows "Requested" state correctly.
3. When a private target accepts a pending request, the requester starts seeing the target's posts (DB side is fine) but the requester's `following` list stays empty until a hard reload.
4. In Settings, the "Private account" toggle appears OFF on second open even though the account is still private server-side.

## Root causes

| # | Root cause | Location |
|---|------------|----------|
| 1 | No entry point on feed. Bell button exists; no sibling for requests. | `src/app/(app)/feed/page.tsx:242-252` |
| 2a | Discover list button computes state from `followingIds` only — no awareness of outgoing pending requests — so button shows "Follow" for users we've already requested. | `src/app/(app)/feed/page.tsx:334,359` |
| 2b | `sendFollowRequest` only deletes `accepted`/`rejected` rows before INSERT. A stale `pending` row triggers UNIQUE(requester_id, target_id) violation. Row is untouched, UI shows "Failed". | `src/stores/use-auth-store.ts:352-377` |
| 3 | Requester has no realtime subscription on its own outgoing requests. Current sub filters `target_id=eq.currentUser`. DB trigger creates the `follows` row on acceptance but the client never learns. | `src/stores/use-auth-store.ts:92-106` |
| 4 | `initialize()`'s profile SELECT omits `is_private`. `profileFromRow` defaults missing field to `false`, so `currentUser.isPrivate` is always falsy until something else refreshes it. | `src/stores/use-auth-store.ts:69-73` |

## Fixes

### Fix 1 — "Follow Requests" button in feed header

- Add an icon button (`UserPlus` from lucide) immediately to the **left** of the existing Bell button.
- Visibility: render whenever `currentUser?.isPrivate === true` **OR** `followRequests.length > 0` (covers the edge case of switching private→public with stragglers).
- Red-dot badge: `followRequests.length > 0`, matching the Bell's `unreadCount` dot styling.
- `onClick` routes to `/profile/requests` (existing page).
- No changes to the requests page itself.

### Fix 2 — Pending-aware follow button + idempotent `sendFollowRequest`

**Store (`use-auth-store.ts`):**
- `sendFollowRequest` becomes idempotent:
  1. If an entry for `targetId` already exists in local `outgoingRequests`, return early (no DB call).
  2. Attempt INSERT.
  3. On error: if Postgres error code is `23505` (unique violation), treat as success — re-fetch the existing request id via SELECT and merge into local state. Otherwise, roll back optimistic state and toast.
- Cleanup DELETE before INSERT stays as-is (only touches `accepted`/`rejected`) — we do NOT wipe existing pending rows because that would lose `created_at` ordering on the target's inbox.

**UI (`feed/page.tsx` discover list + `SuggestedPeopleCarousel`):**
- Derive `pendingOutgoingIds` (memoized) from `useAuthStore((s) => s.outgoingRequests)`.
- Button state is now three-way:
  - `following` → "Following" (unfollow on click)
  - `pending` → "Requested" (cancel request on click, calls `cancelFollowRequest`)
  - neither → "Follow" (calls `toggleFollow`)
- Extract this logic into a tiny `useFollowState(userId)` hook returning `{ state: 'following'|'pending'|'none', action: () => void, label: string }` so the same logic is used in discover list, suggested carousel, and future callers.

**Profile page** already handles this correctly (per PR #9) — it will adopt the new hook for consistency but behavior is unchanged.

### Fix 3 — Realtime subscription for outgoing request acceptance

**Store (`use-auth-store.ts`):**
- Keep the existing incoming channel (`target_id=eq.${userId}`).
- Add a second channel in `initialize()` filtered on `requester_id=eq.${userId}`.
- Handler behavior (on `UPDATE` events only; INSERT/DELETE ignored):
  - `status === 'accepted'`:
    - Append `target_id` to `currentUser.following` (dedupe).
    - Update the target's entry in `allUsers` to include `currentUser.id` in its `followers`.
    - Remove the request from `outgoingRequests`.
  - `status === 'rejected'`:
    - Remove from `outgoingRequests`. No toast (silent).
- Store channel reference in a module-scoped `_outgoingRequestsChannel` variable, symmetric with `_followRequestsChannel`.
- Extend `logout` to remove both channels.

No new push notifications or toasts — the existing `follow_request_accepted` notification (sent via edge function by `acceptFollowRequest`) remains the user-facing signal. This fix is purely about local state convergence.

### Fix 4 — Include `is_private` in `initialize` SELECT

- Single-line change at `use-auth-store.ts:71`: add `is_private` to the column list.
- `profileFromRow` already maps `row.is_private → isPrivate` (line 52). No other changes needed.
- Also check `updateProfile` optimistic path (line 177) — already handles `isPrivate` correctly, so no change.

## Non-goals

- No UI refactor of `/profile/requests` page.
- No changes to DB schema or RLS policies.
- No changes to notification infrastructure.
- No backfill / migration needed — Fix 4 is client-only; next page load for any existing user will correct their local state.

## Testing

Manual verification in order:
1. **Fix 4:** Set account to private in Settings. Reload app. Open Settings again → toggle should still show ON.
2. **Fix 1:** Log in as a private user with pending requests. Feed header shows UserPlus icon with red dot. Click → lands on `/profile/requests`.
3. **Fix 2:** As a public user A, from discover list, follow a private user B. Button should optimistically switch to "Requested" — no error toast. Click again → cancels the request. Click a third time → new request, no error.
4. **Fix 2 regression:** While A has a pending request to B, navigate to B's profile — button should also say "Requested" (existing profile-page logic already handles this).
5. **Fix 3:** With A having a pending request to B, log in as B in a second browser and accept. In A's tab, within ~1s the target should appear in A's following count. Visit B's profile from A's tab — "Following" state.

## Files touched

- `src/stores/use-auth-store.ts` — initialize SELECT, sendFollowRequest idempotency, second realtime channel, logout cleanup
- `src/app/(app)/feed/page.tsx` — header button, pending-aware discover list
- `src/components/feed/SuggestedPeopleCarousel.tsx` (or wherever it lives) — pending-aware suggested carousel
- New: `src/hooks/use-follow-state.ts` — shared hook

## Rollout

Ship as a single PR. All four fixes are tightly coupled to the private-accounts feature and share review context.
