# Private Accounts — Hardening & Adjacent Fixes

**Date:** 2026-04-23
**Status:** Design approved
**Depends on:** [2026-04-23-private-accounts-fixes-design.md](./2026-04-23-private-accounts-fixes-design.md)

## Context

Follow-up audit of the private-accounts feature surfaced five more issues. Fixing them here so the feature is actually safe and consistent.

## Issues & root causes

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | HIGH (security) | `follows` table SELECT policy is `USING (true)`. Any logged-in user can query the full social graph of any private account by hitting the table directly. | `supabase/schema.sql:335` |
| 2 | MEDIUM | Service worker has no click handler for `follow_request` / `follow_request_accepted` notification types. Taps fall through to `/feed`. | `public/sw.js:147-179` |
| 3 | MEDIUM | Switching private→public fires a SQL trigger that bulk-accepts pending requests, but SQL can't invoke the notification edge function — requesters never learn they were accepted. | `supabase/migrations/20260423_private_accounts.sql:63-85` + `src/stores/use-auth-store.ts` `updateProfile` |
| 4 | MEDIUM | When B removes A as a follower (or A unfollows B in a second tab), the other side's local state goes stale. No realtime subscription on `follows`. | `src/stores/use-auth-store.ts` |
| 5 | LOW | `cancelFollowRequest` does a DELETE on `follow_requests`. My outgoing-requests subscription only listens for `UPDATE`, so cancellations aren't synced across tabs. | `src/stores/use-auth-store.ts` outgoing channel |

## Fixes

### Fix 1 — Tighten `follows` SELECT policy

New migration `supabase/migrations/20260423_follows_privacy.sql` that replaces the current permissive policy:

```sql
DROP POLICY IF EXISTS "follows_select" ON follows;
CREATE POLICY "follows_select" ON follows
  FOR SELECT TO authenticated
  USING (can_view_user_data(follower_id) AND can_view_user_data(following_id));
```

Mirror the change in `supabase/schema.sql` so new environments get it on first apply.

**Semantics:** a `follows` row `(A → B)` is visible iff **both** A and B are viewable to the caller under the existing `can_view_user_data` helper (own row, non-private, or caller is a follower). This closes the bypass without breaking current queries — callers only query follows they're entitled to see.

**Regression risk:** `fetchAllUsers` runs a bulk SELECT across all follows; rows involving private users the current user doesn't follow will now be filtered out. That's the desired behavior — those follower/following counts should already be hidden elsewhere in the UI.

### Fix 2 — Service worker deep-links for follow-request notifications

In `public/sw.js`, inside the existing `notificationclick` handler's type-routing block, add two cases:

```js
} else if (data.type === 'follow_request') {
  path = '/profile/requests';
} else if (data.type === 'follow_request_accepted') {
  path = data.userId ? `/profile/${data.userId}` : '/profile';
}
```

### Fix 3 — Client-side notifications on bulk-accept

In `updateProfile` in `use-auth-store.ts`, when the update is `{ isPrivate: false }` and the **previous** state was `isPrivate: true`:

1. **Before** calling `supabase.from('profiles').update(...)`, fetch the pending requesters (the trigger is going to flip them to accepted, so snapshot first):
   ```ts
   const { data: pending } = await supabase
     .from('follow_requests')
     .select('requester_id')
     .eq('target_id', currentUser.id)
     .eq('status', 'pending');
   ```
2. After the profile update succeeds, fire notifications in parallel for each requester (non-blocking, try/catch, same pattern as the existing `sendFollowRequest` notification call).

This is best-effort — if the user refreshes between the update and the notification calls we'll lose some, but the DB trigger already did its job and the follow graph is correct.

### Fix 4 — Realtime subscription on `follows`

Add a third Supabase channel in `initialize()` with **two** `postgres_changes` listeners:

- `{ event: 'DELETE', table: 'follows', filter: 'follower_id=eq.<userId>' }` — fires when someone deletes a row where I'm the follower (either I unfollowed in another tab, or the target removed me). Handler: remove the row's `following_id` from `currentUser.following`, and remove `currentUser.id` from the target user's entry in `allUsers.followers`.
- `{ event: 'DELETE', table: 'follows', filter: 'following_id=eq.<userId>' }` — fires when someone deletes a row where I'm the target (either I removed a follower, or the follower unfollowed me). Handler: remove the row's `follower_id` from `currentUser.followers`, and remove `currentUser.id` from the follower user's entry in `allUsers.following`.

Handlers are idempotent (dedupe-safe), so self-triggered DELETEs from our own optimistic paths are no-ops. Tear down on logout alongside the existing channels.

DB-side note: the existing `follows_delete` policy in the private-accounts migration already allows both the follower and followed to DELETE their row. Realtime forwards DELETE payloads based on the OLD row under RLS, so both sides still receive the event.

### Fix 5 — Extend outgoing-requests subscription to DELETE

In the outgoing channel I added in the prior PR, subscribe to both `UPDATE` and `DELETE`. On `DELETE` — remove the row from local `outgoingRequests` (by id or targetId). Cheap, one-event branch.

## Non-goals

- No new UI surfaces.
- No changes to the accept/reject flow (those work).
- Not fixing the notification-spam window on rapid private→public→private toggles — users can hammer the toggle and spam N requesters; out of scope for this PR.

## Testing

Manual verification order (each fix has its own):

1. **Fix 1:** As user X, query `supabase.from('follows').select('*').eq('following_id', <private_user_Y_id>)` where X doesn't follow Y. Expected: empty result. Before the fix: returns Y's full follower list.
2. **Fix 2:** Trigger a follow_request push notification on device; tap it. Expected: lands on `/profile/requests`. Repeat for `follow_request_accepted`: lands on accepter's profile.
3. **Fix 3:** As private user B, receive a request from A. Switch B to public. Expected: A receives a `follow_request_accepted` push notification.
4. **Fix 4:** Two browsers. As A, unfollow B in tab 1. In tab 2, within ~1s: B should be gone from A's following count. As B, remove A as follower. In A's tab: same.
5. **Fix 5:** Two browsers as A. In tab 1, cancel an outgoing request. In tab 2 (profile page of the target open): the "Requested" button should flip back to "Follow" within ~1s.

## Files touched

- New: `supabase/migrations/20260423_follows_privacy.sql`
- Modify: `supabase/schema.sql`
- Modify: `public/sw.js`
- Modify: `src/stores/use-auth-store.ts`

## Rollout

One PR. The migration must run before the app with tightened RLS assumptions ships — normal Supabase flow.
