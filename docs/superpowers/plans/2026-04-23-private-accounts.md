# Private Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Instagram-style private accounts so users can control who sees their drinking data, with follow requests, locked profiles, and database-level privacy enforcement via RLS.

**Architecture:** Hybrid approach — RLS enforces privacy on sensitive tables (feed_items, drink_sessions, personal_records, etc.) while profiles stay fully readable for search/discovery. A new `follow_requests` table handles the approval flow, with Postgres triggers for auto-inserting follows on accept and bulk-accepting on privacy toggle. Client-side UI handles locked profile views, follow request button states, and a requests inbox.

**Tech Stack:** Supabase (Postgres RLS, triggers, realtime), Next.js 16 App Router, React 19, Zustand, Tailwind CSS 4, Framer Motion, Lucide icons

**Spec:** `docs/superpowers/specs/2026-04-23-private-accounts-design.md`

---

### Task 1: Schema Migration — Add `is_private` column and `follow_requests` table

**Files:**
- Create: `supabase/migrations/20260423_private_accounts.sql`

This task produces the SQL migration file. The user will run it manually in Supabase SQL Editor.

- [ ] **Step 1: Create the migration file**

```sql
-- =============================================================
-- Private Accounts Migration
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================

-- 1. Add is_private column to profiles
ALTER TABLE profiles ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_profiles_is_private ON profiles(is_private);

-- 2. Create follow_requests table
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

-- 3. RLS on follow_requests
ALTER TABLE follow_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follow_requests_select" ON follow_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE POLICY "follow_requests_insert" ON follow_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "follow_requests_update" ON follow_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = target_id);

CREATE POLICY "follow_requests_delete" ON follow_requests
  FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- 4. Trigger: auto-insert into follows when request is accepted
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

-- 5. Trigger: bulk-accept pending requests when switching private -> public
CREATE OR REPLACE FUNCTION handle_privacy_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_private = true AND NEW.is_private = false THEN
    INSERT INTO follows (follower_id, following_id)
    SELECT requester_id, target_id
    FROM follow_requests
    WHERE target_id = NEW.id AND status = 'pending'
    ON CONFLICT DO NOTHING;

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

-- 6. Update follows DELETE policy to allow removing followers
DROP POLICY IF EXISTS "follows_delete" ON follows;
CREATE POLICY "follows_delete" ON follows
  FOR DELETE TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- 7. Visibility helper function
CREATE OR REPLACE FUNCTION can_view_user_data(owner_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() = owner_id THEN RETURN true; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = owner_id AND is_private = true) THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM follows WHERE follower_id = auth.uid() AND following_id = owner_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 8. Update SELECT policies on sensitive tables

-- feed_items
DROP POLICY IF EXISTS "feed_select" ON feed_items;
CREATE POLICY "feed_select" ON feed_items
  FOR SELECT TO authenticated
  USING (can_view_user_data(user_id));

-- drink_sessions
DROP POLICY IF EXISTS "sessions_select" ON drink_sessions;
CREATE POLICY "sessions_select" ON drink_sessions
  FOR SELECT TO authenticated
  USING (can_view_user_data(user_id));

-- drink_entries (via session owner)
DROP POLICY IF EXISTS "drinks_select" ON drink_entries;
CREATE POLICY "drinks_select" ON drink_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM drink_sessions ds
      WHERE ds.id = drink_entries.session_id
      AND can_view_user_data(ds.user_id)
    )
  );

-- session_photos (via session owner)
DROP POLICY IF EXISTS "photos_select" ON session_photos;
CREATE POLICY "photos_select" ON session_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM drink_sessions ds
      WHERE ds.id = session_photos.session_id
      AND can_view_user_data(ds.user_id)
    )
  );

-- personal_records
DROP POLICY IF EXISTS "prs_select" ON personal_records;
CREATE POLICY "prs_select" ON personal_records
  FOR SELECT TO authenticated
  USING (can_view_user_data(user_id));

-- feed_likes (via feed item owner)
DROP POLICY IF EXISTS "likes_select" ON feed_likes;
CREATE POLICY "likes_select" ON feed_likes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM feed_items fi
      WHERE fi.id = feed_likes.feed_item_id
      AND can_view_user_data(fi.user_id)
    )
  );

-- feed_comments (via feed item owner)
DROP POLICY IF EXISTS "comments_select" ON feed_comments;
CREATE POLICY "comments_select" ON feed_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM feed_items fi
      WHERE fi.id = feed_comments.feed_item_id
      AND can_view_user_data(fi.user_id)
    )
  );
```

- [ ] **Step 2: Update the schema reference file**

Add the `is_private` column to the profiles table definition and the `follow_requests` table to `supabase/schema.sql` so the schema file stays in sync with the live database.

In `supabase/schema.sql`, add `is_private BOOLEAN DEFAULT FALSE,` after line 16 (`is_demo BOOLEAN DEFAULT FALSE,`) in the profiles table:

```sql
  is_demo      BOOLEAN DEFAULT FALSE,
  is_private   BOOLEAN DEFAULT FALSE,
```

After the `follows` table (after line 29), add the `follow_requests` table:

```sql
-- 2b. Follow Requests (for private accounts)
CREATE TABLE follow_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(requester_id, target_id)
);
CREATE INDEX idx_follow_requests_target_pending ON follow_requests(target_id) WHERE status = 'pending';
CREATE INDEX idx_follow_requests_requester ON follow_requests(requester_id);
```

In the RLS section, add after the follows policies (after line 323):

```sql
-- Follow requests
ALTER TABLE follow_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follow_requests_select" ON follow_requests FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = target_id);
CREATE POLICY "follow_requests_insert" ON follow_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "follow_requests_update" ON follow_requests FOR UPDATE TO authenticated USING (auth.uid() = target_id);
CREATE POLICY "follow_requests_delete" ON follow_requests FOR DELETE TO authenticated USING (auth.uid() = requester_id OR auth.uid() = target_id);
```

Update the follows delete policy at line 323:

```sql
CREATE POLICY "follows_delete" ON follows FOR DELETE TO authenticated USING (auth.uid() = follower_id OR auth.uid() = following_id);
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260423_private_accounts.sql supabase/schema.sql
git commit -m "feat: add private accounts schema migration and RLS policies"
```

---

### Task 2: Add `isPrivate` to UserProfile type and `FollowRequest` type

**Files:**
- Modify: `src/types/user.ts`

- [ ] **Step 1: Add `isPrivate` to UserProfile and create FollowRequest type**

In `src/types/user.ts`, add `isPrivate: boolean;` to the `UserProfile` interface after the `isDemo` field (line 14), and add the `FollowRequest` interface after the `UserSettings` interface:

```typescript
export type Gender = 'male' | 'female' | 'other';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  gender: Gender;
  weightKg: number;
  heightCm: number | null;
  joinedAt: string;
  isDemo: boolean;
  isPrivate: boolean;
  followers: string[];
  following: string[];
}

export interface UserSettings {
  userId: string;
  hydrationReminderEnabled: boolean;
  hydrationIntervalMinutes: number;
  bacWarningThreshold: number;
  theme: 'dark' | 'neon';
}

export interface FollowRequest {
  id: string;
  requesterId: string;
  targetId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  requesterProfile?: {
    displayName: string;
    avatarUrl: string | null;
    username: string;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/user.ts
git commit -m "feat: add isPrivate to UserProfile and FollowRequest type"
```

---

### Task 3: Update `useAuthStore` — add `isPrivate` mapping, follow request methods, and privacy-aware follow logic

**Files:**
- Modify: `src/stores/use-auth-store.ts`

- [ ] **Step 1: Update imports and AuthState interface**

At the top of `src/stores/use-auth-store.ts`, update the import to include `FollowRequest`:

```typescript
import type { UserProfile, Gender, FollowRequest } from '@/types';
```

Update the `AuthState` interface (lines 9-23) to add new state and methods:

```typescript
interface AuthState {
  currentUser: UserProfile | null;
  allUsers: UserProfile[];
  isAuthenticated: boolean;
  isLoading: boolean;
  followRequests: FollowRequest[];
  outgoingRequests: FollowRequest[];

  initialize: () => Promise<void>;
  signup: (email: string, password: string, username: string, displayName: string, gender?: Gender, weightKg?: number, heightCm?: number) => Promise<string | null>;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<UserProfile, 'displayName' | 'bio' | 'gender' | 'weightKg' | 'heightCm' | 'avatarUrl' | 'isPrivate'>>) => Promise<void>;
  getUserById: (id: string) => UserProfile | undefined;
  fetchAllUsers: (force?: boolean) => Promise<void>;
  toggleFollow: (userId: string) => Promise<void>;
  fetchFollowRequests: () => Promise<void>;
  fetchOutgoingRequests: () => Promise<void>;
  sendFollowRequest: (targetId: string) => Promise<void>;
  cancelFollowRequest: (targetId: string) => Promise<void>;
  acceptFollowRequest: (requestId: string) => Promise<void>;
  rejectFollowRequest: (requestId: string) => Promise<void>;
  removeFollower: (followerId: string) => Promise<void>;
}
```

- [ ] **Step 2: Update `profileFromRow` to include `isPrivate`**

Update the `profileFromRow` function (lines 30-45) to map `is_private`:

```typescript
function profileFromRow(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    username: row.username as string,
    displayName: row.display_name as string,
    avatarUrl: (row.avatar_url as string) || null,
    bio: (row.bio as string) || '',
    gender: (row.gender as 'male' | 'female' | 'other') || 'other',
    weightKg: (row.weight_kg as number) || 70,
    heightCm: (row.height_cm as number) ?? null,
    joinedAt: row.created_at as string,
    isDemo: false,
    isPrivate: (row.is_private as boolean) || false,
    followers: (row.followers as string[]) || [],
    following: (row.following as string[]) || [],
  };
}
```

- [ ] **Step 3: Update store initial state and `updateProfile`**

In the store creator (line 47 onwards), add the new initial state after `isLoading: true,`:

```typescript
  followRequests: [],
  outgoingRequests: [],
```

Update `updateProfile` (lines 135-165) to handle `isPrivate`:

```typescript
  updateProfile: async (updates) => {
    const { currentUser } = get();
    if (!currentUser) return;

    const prevUser = currentUser;
    const prevAllUsers = get().allUsers;

    const updated = { ...currentUser, ...updates };
    set({
      currentUser: updated,
      allUsers: get().allUsers.map((u) => (u.id === currentUser.id ? updated : u)),
    });

    const dbUpdates: Record<string, unknown> = {};
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
    if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
    if (updates.weightKg !== undefined) dbUpdates.weight_kg = updates.weightKg;
    if (updates.heightCm !== undefined) dbUpdates.height_cm = updates.heightCm;
    if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
    if (updates.isPrivate !== undefined) dbUpdates.is_private = updates.isPrivate;
    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', currentUser.id);

    if (error) {
      console.error('Failed to update profile:', error);
      set({ currentUser: prevUser, allUsers: prevAllUsers });
      useUIStore.getState().addToast('Something went wrong', 'error');
    }
  },
```

- [ ] **Step 4: Update `fetchAllUsers` to include `is_private`**

Update the select query in `fetchAllUsers` (line 173) to include `is_private`:

```typescript
      supabase.from('profiles').select('id, username, display_name, avatar_url, bio, is_private, created_at').limit(500),
```

- [ ] **Step 5: Update `toggleFollow` to check privacy**

Replace the `toggleFollow` method (lines 201-250) with privacy-aware logic:

```typescript
  toggleFollow: async (userId) => {
    const { currentUser, allUsers } = get();
    if (!currentUser || followInFlight.has(userId)) return;
    if (userId === currentUser.id) return;
    followInFlight.add(userId);
    hapticMedium();

    const isFollowing = currentUser.following.includes(userId);
    const targetUser = allUsers.find((u) => u.id === userId);

    if (isFollowing) {
      // Unfollow — same as before
      const prevCurrentUser = currentUser;
      const prevAllUsers = allUsers;
      const updatedFollowing = currentUser.following.filter((id) => id !== userId);
      const updatedCurrentUser = { ...currentUser, following: updatedFollowing };
      const updatedAllUsers = allUsers.map((user) => {
        if (user.id === currentUser.id) return updatedCurrentUser;
        if (user.id === userId) {
          return { ...user, followers: user.followers.filter((id) => id !== currentUser.id) };
        }
        return user;
      });
      set({ currentUser: updatedCurrentUser, allUsers: updatedAllUsers });

      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUser.id)
        .eq('following_id', userId);

      if (error) {
        console.error('Failed to unfollow:', error);
        set({ currentUser: prevCurrentUser, allUsers: prevAllUsers });
      }
    } else if (targetUser?.isPrivate) {
      // Private user — send follow request instead
      await get().sendFollowRequest(userId);
    } else {
      // Public user — direct follow
      const prevCurrentUser = currentUser;
      const prevAllUsers = allUsers;
      const updatedFollowing = [...currentUser.following, userId];
      const updatedCurrentUser = { ...currentUser, following: updatedFollowing };
      const updatedAllUsers = allUsers.map((user) => {
        if (user.id === currentUser.id) return updatedCurrentUser;
        if (user.id === userId) {
          return { ...user, followers: [...user.followers, currentUser.id] };
        }
        return user;
      });
      set({ currentUser: updatedCurrentUser, allUsers: updatedAllUsers });

      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: currentUser.id, following_id: userId });

      if (error) {
        console.error('Failed to follow:', error);
        set({ currentUser: prevCurrentUser, allUsers: prevAllUsers });
      }
    }
    followInFlight.delete(userId);
  },
```

- [ ] **Step 6: Add follow request methods**

Add these methods after `toggleFollow` in the store, before the closing `}), {` (before line 251):

```typescript
  fetchFollowRequests: async () => {
    const { currentUser } = get();
    if (!currentUser) return;
    const { data } = await supabase
      .from('follow_requests')
      .select('id, requester_id, target_id, status, created_at, updated_at, requester:profiles!follow_requests_requester_id_fkey(display_name, avatar_url, username)')
      .eq('target_id', currentUser.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (data) {
      set({
        followRequests: data.map((r) => ({
          id: r.id,
          requesterId: r.requester_id,
          targetId: r.target_id,
          status: r.status as 'pending',
          createdAt: r.created_at,
          requesterProfile: r.requester ? {
            displayName: (r.requester as Record<string, string>).display_name,
            avatarUrl: (r.requester as Record<string, string>).avatar_url,
            username: (r.requester as Record<string, string>).username,
          } : undefined,
        })),
      });
    }
  },

  fetchOutgoingRequests: async () => {
    const { currentUser } = get();
    if (!currentUser) return;
    const { data } = await supabase
      .from('follow_requests')
      .select('id, requester_id, target_id, status, created_at')
      .eq('requester_id', currentUser.id)
      .eq('status', 'pending');

    if (data) {
      set({
        outgoingRequests: data.map((r) => ({
          id: r.id,
          requesterId: r.requester_id,
          targetId: r.target_id,
          status: r.status as 'pending',
          createdAt: r.created_at,
        })),
      });
    }
  },

  sendFollowRequest: async (targetId) => {
    const { currentUser, outgoingRequests } = get();
    if (!currentUser) return;

    // Delete any old accepted/rejected request for this pair (re-request scenario)
    await supabase
      .from('follow_requests')
      .delete()
      .eq('requester_id', currentUser.id)
      .eq('target_id', targetId)
      .in('status', ['accepted', 'rejected']);

    // Optimistic: add to outgoing
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
      console.error('Failed to send follow request:', error);
      set({ outgoingRequests: outgoingRequests.filter((r) => r.targetId !== targetId) });
      useUIStore.getState().addToast('Failed to send request', 'error');
    } else if (data) {
      set({
        outgoingRequests: get().outgoingRequests.map((r) =>
          r.targetId === targetId ? { ...r, id: data.id } : r
        ),
      });
    }
  },

  cancelFollowRequest: async (targetId) => {
    const { outgoingRequests } = get();
    const prev = outgoingRequests;
    set({ outgoingRequests: outgoingRequests.filter((r) => r.targetId !== targetId) });

    const { error } = await supabase
      .from('follow_requests')
      .delete()
      .eq('requester_id', get().currentUser?.id ?? '')
      .eq('target_id', targetId);

    if (error) {
      console.error('Failed to cancel follow request:', error);
      set({ outgoingRequests: prev });
    }
  },

  acceptFollowRequest: async (requestId) => {
    const { followRequests, currentUser, allUsers } = get();
    const request = followRequests.find((r) => r.id === requestId);
    if (!request || !currentUser) return;

    // Optimistic: remove from requests, add to followers
    set({
      followRequests: followRequests.filter((r) => r.id !== requestId),
      currentUser: { ...currentUser, followers: [...currentUser.followers, request.requesterId] },
      allUsers: allUsers.map((u) => {
        if (u.id === currentUser.id) return { ...u, followers: [...u.followers, request.requesterId] };
        if (u.id === request.requesterId) return { ...u, following: [...u.following, currentUser.id] };
        return u;
      }),
    });

    const { error } = await supabase
      .from('follow_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId);

    if (error) {
      console.error('Failed to accept follow request:', error);
      set({ followRequests, currentUser, allUsers });
      useUIStore.getState().addToast('Failed to accept request', 'error');
    }
  },

  rejectFollowRequest: async (requestId) => {
    const { followRequests } = get();
    const prev = followRequests;
    set({ followRequests: followRequests.filter((r) => r.id !== requestId) });

    const { error } = await supabase
      .from('follow_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);

    if (error) {
      console.error('Failed to reject follow request:', error);
      set({ followRequests: prev });
    }
  },

  removeFollower: async (followerId) => {
    const { currentUser, allUsers } = get();
    if (!currentUser) return;

    const prevCurrentUser = currentUser;
    const prevAllUsers = allUsers;
    set({
      currentUser: { ...currentUser, followers: currentUser.followers.filter((id) => id !== followerId) },
      allUsers: allUsers.map((u) => {
        if (u.id === currentUser.id) return { ...u, followers: u.followers.filter((id) => id !== followerId) };
        if (u.id === followerId) return { ...u, following: u.following.filter((id) => id !== currentUser.id) };
        return u;
      }),
    });

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', currentUser.id);

    if (error) {
      console.error('Failed to remove follower:', error);
      set({ currentUser: prevCurrentUser, allUsers: prevAllUsers });
      useUIStore.getState().addToast('Failed to remove follower', 'error');
    }
  },
```

- [ ] **Step 7: Update `initialize` to fetch follow requests**

In the `initialize` method (lines 53-81), after `get().fetchAllUsers();` (line 76), add:

```typescript
        get().fetchFollowRequests();
        get().fetchOutgoingRequests();
```

- [ ] **Step 8: Update `partialize` to persist new state**

Update the `partialize` at line 254 to include `isPrivate` awareness (no change needed — `currentUser` is already persisted and it now contains `isPrivate`). But update `logout` to clear follow requests:

```typescript
  logout: async () => {
    await supabase.auth.signOut();
    set({ currentUser: null, allUsers: [], isAuthenticated: false, followRequests: [], outgoingRequests: [] });
  },
```

- [ ] **Step 9: Verify the app still compiles**

Run: `cd /Users/dyajaman/conductor/workspaces/hevydrinkr/louisville && npm run build 2>&1 | tail -20`
Expected: Build succeeds (or only warnings, no errors)

- [ ] **Step 10: Commit**

```bash
git add src/stores/use-auth-store.ts
git commit -m "feat: add follow request methods and privacy-aware follow logic to auth store"
```

---

### Task 4: Settings page — Add private account toggle

**Files:**
- Modify: `src/app/(app)/profile/settings/page.tsx`

- [ ] **Step 1: Add `isPrivate` state and confirmation modal state**

In `src/app/(app)/profile/settings/page.tsx`, add state for the privacy toggle after the existing state declarations (after line 28):

```typescript
  const [showPublicConfirm, setShowPublicConfirm] = useState(false);
```

Add the `Lock` icon to the import from `lucide-react` (line 5):

```typescript
import { ChevronLeft, LogOut, Trash2, User, Camera, Type, FileText, Bell, ChevronRight, Scale, Shield, Ruler, Weight, Lock } from 'lucide-react';
```

- [ ] **Step 2: Add privacy toggle handler**

After `handleTogglePref` (line 75), add:

```typescript
  const handleTogglePrivacy = () => {
    if (!currentUser) return;
    hapticSelection();
    if (currentUser.isPrivate) {
      setShowPublicConfirm(true);
    } else {
      updateProfile({ isPrivate: true });
      addToast('Account is now private', 'success');
    }
  };

  const handleConfirmPublic = async () => {
    setShowPublicConfirm(false);

    // Fetch pending requests before switching (trigger will bulk-accept them)
    const { data: pendingRequests } = await supabase
      .from('follow_requests')
      .select('requester_id')
      .eq('target_id', currentUser!.id)
      .eq('status', 'pending');

    updateProfile({ isPrivate: false });

    // Send notifications to all newly-accepted requesters
    if (pendingRequests && pendingRequests.length > 0) {
      for (const req of pendingRequests) {
        supabase.functions.invoke('send-notification', {
          body: {
            recipientId: req.requester_id,
            type: 'follow_request_accepted',
            title: 'Follow Request Accepted',
            body: `@${currentUser!.username} accepted your follow request`,
            data: { userId: currentUser!.id },
          },
        }).catch(() => {});
      }
    }

    addToast('Account is now public', 'success');
  };
```

- [ ] **Step 3: Add Privacy section to the settings UI**

In the JSX, add a new "Privacy" section after the Body Metrics section (after line 243, the closing `</div>` and `<p>` for BAC disclaimer). Insert before the Notifications section:

```tsx
        {/* Privacy */}
        <div>
          <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1.5">Privacy</h3>
          <p className="text-[11px] text-zinc-600 mb-2.5">Control who can see your sessions and posts</p>
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] divide-y divide-white/[0.04]">
            <button
              onClick={handleTogglePrivacy}
              className="w-full px-4 py-3.5 flex items-center justify-between active:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-zinc-500" />
                <div className="text-left">
                  <span className="text-sm block">Private Account</span>
                  <span className="text-[11px] text-zinc-600">Only approved followers can see your sessions and posts</span>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full relative transition-colors ${currentUser?.isPrivate ? 'bg-teal-500' : 'bg-zinc-700'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${currentUser?.isPrivate ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </div>
        </div>
```

- [ ] **Step 4: Add confirmation modal for switching to public**

At the end of the component, before the final `</div>` (before line 359), add the confirmation modal:

```tsx
      {/* Public confirmation modal */}
      <AnimatePresence>
        {showPublicConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowPublicConfirm(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-xs mx-6 rounded-3xl p-6 text-center"
              style={{ background: 'rgba(20,20,24,0.95)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <Lock className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
              <h3 className="text-base font-bold mb-2">Switch to Public?</h3>
              <p className="text-xs text-zinc-500 mb-5">All pending follow requests will be automatically accepted. Your posts and sessions will be visible to everyone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPublicConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm font-semibold text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPublic}
                  className="flex-1 py-2.5 rounded-xl bg-accent text-sm font-semibold text-black"
                >
                  Switch
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
```

Add `AnimatePresence` and `motion` imports — `motion` is already imported (line 4). Add `AnimatePresence` to the framer-motion import:

```typescript
import { motion, AnimatePresence } from 'framer-motion';
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/profile/settings/page.tsx
git commit -m "feat: add private account toggle to settings page"
```

---

### Task 5: Locked profile view for private users

**Files:**
- Modify: `src/app/(app)/profile/[userId]/user-profile.tsx`

- [ ] **Step 1: Add follow request state and imports**

In `src/app/(app)/profile/[userId]/user-profile.tsx`, update imports to add `Lock` icon (line 5):

```typescript
import { ChevronLeft, Wine, Clock, Calendar, TrendingUp, Share2, X, Heart, Trophy as TrophyIcon, Timer, Flag, Ban, MoreHorizontal, Lock } from 'lucide-react';
```

Add follow request store selectors after the existing store hooks (after line 41):

```typescript
  const outgoingRequests = useAuthStore((s) => s.outgoingRequests);
  const sendFollowRequest = useAuthStore((s) => s.sendFollowRequest);
  const cancelFollowRequest = useAuthStore((s) => s.cancelFollowRequest);
  const fetchOutgoingRequests = useAuthStore((s) => s.fetchOutgoingRequests);
```

- [ ] **Step 2: Compute privacy state**

After `const isFollowing = ...` (line 58), add:

```typescript
  const isPrivate = user?.isPrivate ?? false;
  const hasPendingRequest = outgoingRequests.some((r) => r.targetId === resolvedUserId);
  const isLockedProfile = isPrivate && !isFollowing;
```

Update the `useEffect` (lines 43-55) to also fetch outgoing requests:

```typescript
  useEffect(() => {
    fetchSessions(resolvedUserId);
    fetchUserPosts(resolvedUserId);
    fetchOutgoingRequests();
    const alreadyLoaded = useAuthStore.getState().allUsers.some((u) => u.id === resolvedUserId);
    if (alreadyLoaded) {
      setLoadingUser(false);
      fetchAllUsers();
    } else {
      setLoadingUser(true);
      fetchAllUsers(true).finally(() => setLoadingUser(false));
    }
  }, [resolvedUserId, fetchSessions, fetchUserPosts, fetchAllUsers, fetchOutgoingRequests]);
```

- [ ] **Step 3: Update the follow button to handle request states**

Replace the follow button (lines 269-279) with privacy-aware logic:

```tsx
          {isLockedProfile && hasPendingRequest ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { hapticLight(); cancelFollowRequest(resolvedUserId); }}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-white/[0.06] border border-white/[0.08] text-zinc-400"
            >
              Requested
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { hapticLight(); toggleFollow(resolvedUserId); }}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                isFollowing
                  ? 'bg-white/[0.06] border border-white/[0.08] text-zinc-400'
                  : 'bg-accent text-black'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </motion.button>
          )}
```

- [ ] **Step 4: Add locked profile content**

After the follow counts + button section (after line 280 area, after the `</div>` that closes the follow section), add the locked profile gate. Replace the content from the stats grid onwards (lines 282-368) with a conditional:

```tsx
        {isLockedProfile ? (
          /* Locked profile view */
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-8 text-center">
            <Lock className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold mb-1">This account is private</h3>
            <p className="text-sm text-zinc-500 mb-5">Follow this account to see their sessions and posts</p>
            {hasPendingRequest ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { hapticLight(); cancelFollowRequest(resolvedUserId); }}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.06] border border-white/[0.08] text-zinc-400"
              >
                Requested
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { hapticLight(); toggleFollow(resolvedUserId); }}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-accent text-black"
              >
                Follow
              </motion.button>
            )}
          </div>
        ) : (
          /* Normal profile content — everything that was here before */
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { icon: Calendar, label: 'Sessions', value: stats.totalSessions, color: 'text-violet-400' },
                { icon: Wine, label: 'Total Drinks', value: stats.totalDrinks, color: 'text-accent' },
                { icon: Clock, label: 'Time Partying', value: formatDuration(stats.totalMinutes), color: 'text-cyan-400' },
                { icon: TrendingUp, label: 'Avg/Session', value: stats.avgDrinks.toFixed(1), color: 'text-green-400' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4"
                >
                  <stat.icon className={`w-4 h-4 ${stat.color} mb-2`} />
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-[10px] text-zinc-500">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Achievements */}
            {earnedMilestones.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Achievements</h3>
                <div className="flex flex-wrap gap-2">
                  {earnedMilestones.map((m) => (
                    <span key={m.threshold} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-[11px] font-semibold text-accent">
                      {m.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Session Highlights */}
            {highlights.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Highlights</h3>
                <div className="flex gap-2.5 overflow-x-auto scrollbar-hide">
                  {highlights.map((h) => (
                    <div
                      key={h.label}
                      onClick={() => router.push(`/feed?post=${h.postId}`)}
                      className="shrink-0 w-[130px] rounded-2xl bg-white/[0.03] border border-white/[0.05] p-3.5 cursor-pointer active:bg-white/[0.05] transition-colors"
                    >
                      <h.icon className="w-4 h-4 text-accent mb-2" />
                      <p className="text-lg font-bold">{h.value}</p>
                      <p className="text-[10px] text-zinc-500">{h.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signature Drink */}
            {signatureDrink && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Signature Drink</h3>
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4 flex items-center gap-4">
                  <DrinkIcon category={signatureDrink.category} className="w-8 h-8" />
                  <div className="flex-1">
                    <p className="text-sm font-bold">{signatureDrink.name}</p>
                    <p className="text-[11px] text-zinc-500">{signatureDrink.count} times &middot; {signatureDrink.pct}% of drinks</p>
                  </div>
                </div>
              </div>
            )}

            {/* User's posts */}
            {userPosts.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Posts</h3>
                <div className="space-y-3">
                  {userPosts.map((post) => (
                    <FeedCard key={post.id} item={post} />
                  ))}
                </div>
              </div>
            )}

            {userPosts.length === 0 && (
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-6 text-center">
                <p className="text-sm text-zinc-600">No posts yet</p>
              </div>
            )}
          </>
        )}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/profile/[userId]/user-profile.tsx
git commit -m "feat: add locked profile view and follow request buttons for private users"
```

---

### Task 6: Follow requests inbox page

**Files:**
- Create: `src/app/(app)/profile/requests/page.tsx`

- [ ] **Step 1: Create the follow requests inbox page**

```tsx
'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, UserPlus, Check, X } from 'lucide-react';
import { useAppRouter } from '@/hooks/use-app-router';
import { useAuthStore } from '@/stores/use-auth-store';
import { Avatar } from '@/components/ui/avatar';
import { hapticLight } from '@/lib/haptics';

export default function FollowRequestsPage() {
  const router = useAppRouter();
  const followRequests = useAuthStore((s) => s.followRequests);
  const fetchFollowRequests = useAuthStore((s) => s.fetchFollowRequests);
  const acceptFollowRequest = useAuthStore((s) => s.acceptFollowRequest);
  const rejectFollowRequest = useAuthStore((s) => s.rejectFollowRequest);

  useEffect(() => {
    fetchFollowRequests();
  }, [fetchFollowRequests]);

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 active:text-white">
            <ChevronLeft className="w-6 h-6 text-zinc-400" />
          </button>
          <h1 className="text-lg font-bold">Follow Requests</h1>
        </div>
      </div>

      <div className="px-5 py-3">
        {followRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <UserPlus className="w-8 h-8 text-zinc-700" />
            </div>
            <p className="text-sm text-zinc-600">No pending requests</p>
          </div>
        ) : (
          <div className="space-y-1">
            {followRequests.map((request) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3 py-3 px-1"
              >
                <div
                  onClick={() => router.push(`/profile/${request.requesterId}`)}
                  className="cursor-pointer"
                >
                  <Avatar
                    name={request.requesterProfile?.displayName || ''}
                    size="md"
                    src={request.requesterProfile?.avatarUrl || null}
                  />
                </div>
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => router.push(`/profile/${request.requesterId}`)}
                >
                  <p className="text-sm font-semibold truncate">
                    {request.requesterProfile?.displayName || 'Unknown'}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    @{request.requesterProfile?.username || ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => { hapticLight(); acceptFollowRequest(request.id); }}
                    className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center"
                  >
                    <Check className="w-4 h-4 text-black" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => { hapticLight(); rejectFollowRequest(request.id); }}
                    className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-zinc-400" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/profile/requests/page.tsx
git commit -m "feat: add follow requests inbox page"
```

---

### Task 7: Add follow requests badge to profile page

**Files:**
- Modify: `src/app/(app)/profile/page.tsx`

- [ ] **Step 1: Add follow requests link to own profile page**

In `src/app/(app)/profile/page.tsx`, add store selectors for follow requests. Find where other store hooks are used (near the top of the ProfilePageOwn function) and add:

```typescript
  const followRequests = useAuthStore((s) => s.followRequests);
  const isPrivate = useAuthStore((s) => s.currentUser?.isPrivate) ?? false;
```

Add the `UserPlus` icon to the lucide-react import.

After the header area (near the settings button), add a follow requests button that only shows when the account is private and there are pending requests. Add it next to the settings gear button in the header:

```tsx
              {isPrivate && (
                <button
                  onClick={() => router.push('/profile/requests')}
                  aria-label="Follow requests"
                  className="relative p-2.5 rounded-lg hover:bg-white/5 active:bg-white/[0.08]"
                >
                  <UserPlus className="w-5 h-5 text-zinc-500" />
                  {followRequests.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-accent text-[10px] font-bold text-black flex items-center justify-center">
                      {followRequests.length > 9 ? '9+' : followRequests.length}
                    </span>
                  )}
                </button>
              )}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/profile/page.tsx
git commit -m "feat: add follow requests badge to profile page header"
```

---

### Task 8: Lock icon in search results for private users

**Files:**
- Modify: `src/app/(app)/feed/page.tsx`

- [ ] **Step 1: Add lock icon to search result rows**

In `src/app/(app)/feed/page.tsx`, add the `Lock` icon to the lucide-react import.

Find where search results render user rows (the section that maps over `searchResults`). In each user row, after the username text, add a lock indicator for private users.

Find the search result rendering. It maps `searchResults` and shows avatar, display name, username. After the username `<p>` element, the lock icon should show conditionally. Since the search results come from a direct Supabase query that doesn't include `is_private`, update the search query (around line 102-106) to also select `is_private`:

```typescript
      const { data } = await supabase
        .from('profiles')
        .select('*, is_private')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq('id', currentUser?.id ?? '')
        .limit(20);
```

Update the mapping (around lines 110-125) to include `isPrivate`:

```typescript
        setSearchResults(
          data.map((p) => ({
            id: p.id,
            username: p.username,
            displayName: p.display_name,
            avatarUrl: p.avatar_url,
            bio: p.bio || '',
            gender: p.gender || 'other',
            weightKg: p.weight_kg || 70,
            heightCm: p.height_cm || null,
            joinedAt: p.created_at,
            isDemo: false,
            isPrivate: p.is_private || false,
            followers: [],
            following: [],
          }))
        );
```

Then in the search results UI where each user row renders, add a lock icon next to private user names. Find the search result row and add after the username:

```tsx
                    {user.isPrivate && <Lock className="w-3 h-3 text-zinc-600 inline ml-1" />}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/feed/page.tsx
git commit -m "feat: show lock icon on private users in search results"
```

---

### Task 9: Realtime subscription for follow requests

**Files:**
- Modify: `src/stores/use-auth-store.ts`

- [ ] **Step 1: Add realtime subscription in `initialize`**

In `src/stores/use-auth-store.ts`, in the `initialize` method, after the lines that call `fetchFollowRequests()` and `fetchOutgoingRequests()`, add a realtime subscription:

```typescript
        // Subscribe to follow request changes
        supabase
          .channel('follow-requests')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'follow_requests',
              filter: `target_id=eq.${session.user.id}`,
            },
            () => {
              get().fetchFollowRequests();
            }
          )
          .subscribe();
```

- [ ] **Step 2: Clean up subscription on logout**

Update the `logout` method to remove the channel:

```typescript
  logout: async () => {
    supabase.removeChannel(supabase.channel('follow-requests'));
    await supabase.auth.signOut();
    set({ currentUser: null, allUsers: [], isAuthenticated: false, followRequests: [], outgoingRequests: [] });
  },
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/use-auth-store.ts
git commit -m "feat: add realtime subscription for follow requests"
```

---

### Task 10: Notifications for follow requests

**Files:**
- Modify: `src/stores/use-auth-store.ts`

- [ ] **Step 1: Send push notification on follow request and accept**

In `sendFollowRequest`, after the successful insert (after the `else if (data)` block), add a notification call:

```typescript
      // Send push notification
      try {
        const { currentUser: cu } = get();
        if (cu) {
          await supabase.functions.invoke('send-notification', {
            body: {
              recipientId: targetId,
              type: 'follow_request',
              title: 'Follow Request',
              body: `@${cu.username} requested to follow you`,
              data: { userId: cu.id },
            },
          });
        }
      } catch { /* notification failure is non-critical */ }
```

In `acceptFollowRequest`, after the successful update (after the `if (error)` block), add:

```typescript
    // Send notification to requester
    try {
      const { currentUser: cu } = get();
      if (cu && request.requesterId) {
        await supabase.functions.invoke('send-notification', {
          body: {
            recipientId: request.requesterId,
            type: 'follow_request_accepted',
            title: 'Follow Request Accepted',
            body: `@${cu.username} accepted your follow request`,
            data: { userId: cu.id },
          },
        });
      }
    } catch { /* notification failure is non-critical */ }
```

- [ ] **Step 2: Add notification preference for follow requests**

In `src/stores/use-notification-store.ts`, the existing `followsEnabled` preference already covers follow-related notifications. The `send-notification` edge function should respect this preference — no client-side change needed since the edge function already checks preferences.

- [ ] **Step 3: Commit**

```bash
git add src/stores/use-auth-store.ts
git commit -m "feat: send push notifications for follow requests and acceptances"
```

---

### Task 11: Remove follower capability in followers list

**Files:**
- Modify: `src/app/(app)/profile/page.tsx`

- [ ] **Step 1: Add remove follower button to own profile's followers modal**

In `src/app/(app)/profile/page.tsx`, find the followers/following modal (the `AnimatePresence` block near the end of the file that renders the follower list). Add `removeFollower` to the store selectors:

```typescript
  const removeFollower = useAuthStore((s) => s.removeFollower);
```

In the followers modal, when rendering each follower row on the OWN profile (not other users' profiles), add a remove button. Find the follower row rendering and add a remove button for the followers tab when `isPrivate` is true:

After the follow/following button in each row, add a remove option. For the own profile's followers list, when the profile is private, show an "X" button to remove the follower:

```tsx
                        {!isMe && isPrivate && showFollowList === 'followers' && (
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => { hapticLight(); removeFollower(u.id); }}
                            className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center ml-1.5"
                          >
                            <X className="w-3.5 h-3.5 text-zinc-500" />
                          </motion.button>
                        )}
```

Add `X` to the lucide-react imports if not already present.

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/profile/page.tsx
git commit -m "feat: add remove follower button for private accounts"
```

---

### Task 12: Build verification and cleanup

**Files:**
- All modified files

- [ ] **Step 1: Run build to verify everything compiles**

Run: `cd /Users/dyajaman/conductor/workspaces/hevydrinkr/louisville && npm run build 2>&1 | tail -30`
Expected: Build succeeds

- [ ] **Step 2: Fix any build errors**

If there are TypeScript errors, fix them. Common issues:
- Missing imports
- Type mismatches on the `FollowRequest` type
- `isPrivate` not being read from the right place in components

- [ ] **Step 3: Run lint if configured**

Run: `cd /Users/dyajaman/conductor/workspaces/hevydrinkr/louisville && npm run lint 2>&1 | tail -20`
Fix any lint errors.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build errors from private accounts feature"
```

---

## Summary of files changed

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260423_private_accounts.sql` | Create | Full SQL migration (run in Supabase SQL Editor) |
| `supabase/schema.sql` | Modify | Add is_private column and follow_requests table to reference schema |
| `src/types/user.ts` | Modify | Add `isPrivate` to UserProfile, add `FollowRequest` type |
| `src/stores/use-auth-store.ts` | Modify | Privacy-aware follow logic, follow request methods, realtime sub, notifications |
| `src/app/(app)/profile/settings/page.tsx` | Modify | Private account toggle with confirmation modal |
| `src/app/(app)/profile/[userId]/user-profile.tsx` | Modify | Locked profile view, follow request button states |
| `src/app/(app)/profile/requests/page.tsx` | Create | Follow requests inbox page |
| `src/app/(app)/profile/page.tsx` | Modify | Requests badge, remove follower button |
| `src/app/(app)/feed/page.tsx` | Modify | Lock icon in search results, is_private in search query |

## SQL to run in Supabase

The full migration SQL is in Task 1, Step 1. Copy the entire contents of `supabase/migrations/20260423_private_accounts.sql` and run it in Supabase SQL Editor.
