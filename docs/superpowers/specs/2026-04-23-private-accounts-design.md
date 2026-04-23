# Private Accounts Design Spec

## Overview

Add Instagram-style private accounts to Drinkr. Private users' drinking data (sessions, posts, PRs) is protected at the database level via RLS. Non-followers see a locked profile with basic identity info. Following a private account requires an approval flow with notifications.

**Default behavior:** All existing and new accounts are public (`is_private = false`). Privacy is opt-in via a settings toggle.

## Approach: Hybrid RLS + Client-Side UX

- **RLS enforces privacy** on sensitive tables: `feed_items`, `drink_sessions`, `drink_entries`, `personal_records`, `session_photos`, `feed_likes`, `feed_comments`
- **Profiles stay fully readable** for search, discovery, and locked profile card rendering
- **Client-side logic** handles UX: locked profile views, follow request button states, requests inbox
- **Groups override privacy** — being in the same group grants full visibility within group contexts (challenges, parties)

## Schema Changes

### `profiles` table — new column

```sql
ALTER TABLE profiles ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_profiles_is_private ON profiles(is_private);
```

### New `follow_requests` table

```sql
CREATE TABLE follow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(requester_id, target_id)
);

CREATE INDEX idx_follow_requests_target_pending ON follow_requests(target_id) WHERE status = 'pending';
CREATE INDEX idx_follow_requests_requester ON follow_requests(requester_id);
```

### RLS on `follow_requests`

```sql
ALTER TABLE follow_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY follow_requests_select ON follow_requests
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE POLICY follow_requests_insert ON follow_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY follow_requests_update ON follow_requests
  FOR UPDATE USING (auth.uid() = target_id);

CREATE POLICY follow_requests_delete ON follow_requests
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = target_id);
```

### Postgres trigger: auto-insert into `follows` on accept

```sql
CREATE OR REPLACE FUNCTION handle_follow_request_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO follows (follower_id, following_id)
    VALUES (NEW.requester_id, NEW.target_id)
    ON CONFLICT DO NOTHING;
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_follow_request_accepted
  BEFORE UPDATE ON follow_requests
  FOR EACH ROW
  EXECUTE FUNCTION handle_follow_request_accepted();
```

### Postgres trigger: bulk-accept on switching private → public

```sql
CREATE OR REPLACE FUNCTION handle_privacy_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_private = true AND NEW.is_private = false THEN
    -- Insert follows for all pending requests
    INSERT INTO follows (follower_id, following_id)
    SELECT requester_id, target_id
    FROM follow_requests
    WHERE target_id = NEW.id AND status = 'pending'
    ON CONFLICT DO NOTHING;

    -- Mark all pending requests as accepted
    UPDATE follow_requests
    SET status = 'accepted', updated_at = now()
    WHERE target_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_privacy_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.is_private IS DISTINCT FROM NEW.is_private)
  EXECUTE FUNCTION handle_privacy_change();
```

## RLS Policy Changes for Sensitive Tables

### Visibility helper function

```sql
CREATE OR REPLACE FUNCTION can_view_user_data(owner_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Can always view own data
  IF auth.uid() = owner_id THEN RETURN true; END IF;

  -- Check if owner is public
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = owner_id AND is_private = true) THEN
    RETURN true;
  END IF;

  -- Check if viewer follows the private owner
  RETURN EXISTS (
    SELECT 1 FROM follows WHERE follower_id = auth.uid() AND following_id = owner_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### Updated SELECT policies

Replace the existing `true`-based SELECT policies on these tables:

```sql
-- feed_items
DROP POLICY IF EXISTS feed_select ON feed_items;
CREATE POLICY feed_select ON feed_items
  FOR SELECT USING (can_view_user_data(user_id));

-- drink_sessions
DROP POLICY IF EXISTS sessions_select ON drink_sessions;
CREATE POLICY sessions_select ON drink_sessions
  FOR SELECT USING (can_view_user_data(user_id));

-- drink_entries (via session owner)
DROP POLICY IF EXISTS entries_select ON drink_entries;
CREATE POLICY entries_select ON drink_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM drink_sessions ds
      WHERE ds.id = drink_entries.session_id
      AND can_view_user_data(ds.user_id)
    )
  );

-- session_photos (via session owner)
DROP POLICY IF EXISTS photos_select ON session_photos;
CREATE POLICY photos_select ON session_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM drink_sessions ds
      WHERE ds.id = session_photos.session_id
      AND can_view_user_data(ds.user_id)
    )
  );

-- personal_records
DROP POLICY IF EXISTS records_select ON personal_records;
CREATE POLICY records_select ON personal_records
  FOR SELECT USING (can_view_user_data(user_id));

-- feed_likes
DROP POLICY IF EXISTS likes_select ON feed_likes;
CREATE POLICY likes_select ON feed_likes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feed_items fi
      WHERE fi.id = feed_likes.feed_item_id
      AND can_view_user_data(fi.user_id)
    )
  );

-- feed_comments
DROP POLICY IF EXISTS comments_select ON feed_comments;
CREATE POLICY comments_select ON feed_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feed_items fi
      WHERE fi.id = feed_comments.feed_item_id
      AND can_view_user_data(fi.user_id)
    )
  );
```

### `follows` DELETE policy update

The existing DELETE policy only allows `follower_id = auth.uid()`. Update to also allow the followed user to remove followers:

```sql
DROP POLICY IF EXISTS follows_delete ON follows;
CREATE POLICY follows_delete ON follows
  FOR DELETE USING (auth.uid() = follower_id OR auth.uid() = following_id);
```

### Tables NOT affected

- `profiles` — stays fully readable (needed for search, locked profiles, follow request UX)
- `follows` — SELECT stays fully readable (follower/following counts on locked profiles). DELETE updated above.
- `groups`, `group_members`, `challenges`, `challenge_participants`, `party_*` — groups override privacy
- `blocked_users` — already scoped to own rows
- `reports` — already scoped to own rows

## Follow Request Flow

### When User A taps "Follow" on private User B

1. Client checks `profiles.is_private` for User B
2. If public: direct insert into `follows` (unchanged current behavior)
3. If private:
   - Insert into `follow_requests` with status `pending`
   - Button changes: "Follow" → "Requested"
   - Push notification sent to User B: "[@userA] requested to follow you"

### User B's actions on a pending request

- **Accept:** Update `follow_requests.status` to `accepted`. Postgres trigger inserts into `follows`. Notification sent to User A: "[@userB] accepted your follow request"
- **Reject:** Update `follow_requests.status` to `rejected`. No notification to User A (silent rejection)

### Edge cases

- **Cancel request:** User A taps "Requested" → deletes from `follow_requests`, button reverts to "Follow"
- **Re-request after unfollow:** Delete the old `follow_requests` row, then insert a new `pending` row
- **Blocked user:** Block check happens before request creation — blocked users can't send requests
- **Private → public switch:** Postgres trigger bulk-accepts all pending requests. Client detects the switch and calls the `send-notification` edge function for each newly-accepted requester.
- **Existing followers on public → private switch:** All current followers are kept. Only new follows require approval going forward.
- **Remove follower:** Private users can remove existing followers. The `follows` DELETE RLS policy is updated to also allow `following_id = auth.uid()` (the person being followed can remove a follower). UI: a small "X" or "Remove" button next to each follower on the followers list.

### New notification types

- `follow_request` — "[@user] requested to follow you"
- `follow_request_accepted` — "[@user] accepted your follow request"

These integrate with the existing `send-notification` edge function.

## UI Changes

### Settings page (`profile/settings/page.tsx`)

New toggle in the body metrics section:
- **"Private Account"** switch
- Description text: "When enabled, only approved followers can see your sessions and posts"
- Toggle calls `updateProfile({ is_private: true/false })`
- Public → private: immediate, no confirmation
- Private → public: confirmation modal — "All pending follow requests will be automatically accepted. Your posts and sessions will be visible to everyone. Continue?"

### Follow button states (on other users' profiles)

| Target state | Button label | Tap action |
|---|---|---|
| Public, not following | "Follow" | Insert into `follows` |
| Public, following | "Following" | Unfollow |
| Private, not following, no request | "Follow" | Send follow request |
| Private, request pending | "Requested" | Cancel request |
| Private, following | "Following" | Unfollow |

### Locked profile view (`profile/[userId]/user-profile.tsx`)

When viewing a private user you don't follow:
- **Visible:** avatar, display name, username, bio, follower/following counts
- **Hidden:** stats, highlights, milestones, session history, posts, PRs — replaced with a lock section
- **Lock section:** centered padlock icon + "This account is private" + "Follow this account to see their sessions and posts" + Follow/Requested button

### Follow requests inbox

- New page at `/profile/requests`
- Accessible from an inbox icon on the profile page with badge count for pending requests
- List of pending requests with requester's avatar, display name, username
- Each row has Accept / Reject buttons
- Accepted requests disappear from the list

### Feed

- **Home tab:** no change (already filtered to followed users)
- **Discover tab:** private users' posts simply don't appear (RLS handles this, no locked cards)

### Leaderboard

No change needed — already scoped to following circle.

### Search

- Private users appear in search results with a small lock icon next to their name
- Tapping takes you to their locked profile view

## Store Changes

### `useAuthStore`

- Add `is_private` to `UserProfile` type
- New state: `followRequests: FollowRequest[]` (incoming pending requests)
- New state: `outgoingRequests: FollowRequest[]` (sent pending requests)
- New methods:
  - `fetchFollowRequests()` — pending requests where `target_id = currentUser.id`
  - `fetchOutgoingRequests()` — pending requests where `requester_id = currentUser.id`
  - `sendFollowRequest(targetId)` — insert into `follow_requests`
  - `cancelFollowRequest(targetId)` — delete from `follow_requests`
  - `acceptFollowRequest(requestId)` — update status to `accepted`
  - `rejectFollowRequest(requestId)` — update status to `rejected`
- Modify `toggleFollow(userId)` — check `is_private` before deciding `follows` insert vs. follow request
- `removeFollower(followerId)` — delete from `follows` where `follower_id = followerId` and `following_id = currentUser.id`
- Realtime subscription on `follow_requests` where `target_id = currentUser.id` for live updates

### `useFeedStore`

Minimal changes — RLS handles filtering. Discover tab query naturally excludes private users' posts.

### `useSessionStore`

No client-side change needed. `fetchSessions(userId)` returns empty for unauthorized viewers; the locked profile view handles this.

### New type

```typescript
interface FollowRequest {
  id: string
  requesterId: string
  targetId: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
  requesterProfile?: {
    displayName: string
    avatarUrl: string
    username: string
  }
}
```

## Performance

- Index on `follows(follower_id, following_id)` — already exists from the unique constraint
- Index on `profiles(is_private)` — new, for the RLS helper function
- Partial index on `follow_requests(target_id) WHERE status = 'pending'` — for the requests inbox query
- The `can_view_user_data()` function is marked `STABLE` for query planner optimization
- `SECURITY DEFINER` on the helper function so it can read `profiles` and `follows` without additional RLS overhead
