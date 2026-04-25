-- =============================================================
-- Launch Readiness Migration
-- Run AFTER 20260423_private_accounts.sql
--
-- This migration is idempotent and tolerates optional tables being
-- absent in production (e.g. rounds, wagers, party_*, comment_likes
-- that may have been dropped). The required moderation tables
-- blocked_users and reports are created if missing.
--
-- Covers:
--   1. Server-side age gate (date_of_birth + trigger validation)
--   2. ON DELETE rules so account deletion can cascade cleanly
--   3. is_username_taken RPC (was missing from source)
--   4. RLS lockdown for groups, group_members, challenges, wagers,
--      party_*, rounds, comment_likes, follows
--   5. Body-metric column grants so weight/height/gender are self-only
--   6. Block enforcement in feed visibility
--   7. Mention-by-username fix in comment trigger
--   8. Follow-request rate limit
--   9. join_group_by_invite RPC (replaces direct SELECT-then-INSERT)
--  10. delete_user_account helper used by the delete-account Edge Fn
-- =============================================================

-- -----------------------------------------------------------------------------
-- 0. Ensure moderation tables exist (blocked_users + reports)
--
-- The app already exposes Block and Report buttons. If the underlying tables
-- were dropped/never created, those features fail silently. They are also
-- referenced in the privacy policies below, so we guarantee them here.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS blocked_users (
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON blocked_users(blocker_id);
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blocked_select" ON blocked_users;
CREATE POLICY "blocked_select" ON blocked_users FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "blocked_insert" ON blocked_users;
CREATE POLICY "blocked_insert" ON blocked_users FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "blocked_delete" ON blocked_users;
CREATE POLICY "blocked_delete" ON blocked_users FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

CREATE TABLE IF NOT EXISTS reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'user')),
  target_id   UUID NOT NULL,
  reason      TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'underage', 'dangerous', 'other')),
  details     TEXT DEFAULT '',
  status      TEXT CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')) DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reports_insert" ON reports;
CREATE POLICY "reports_insert" ON reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "reports_select_own" ON reports;
CREATE POLICY "reports_select_own" ON reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

-- -----------------------------------------------------------------------------
-- 1. Age gate
-- -----------------------------------------------------------------------------

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Replace handle_new_user to read DoB from metadata and reject under-18.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_dob DATE;
  v_age INT;
BEGIN
  v_dob := (NEW.raw_user_meta_data->>'date_of_birth')::DATE;

  IF v_dob IS NULL THEN
    RAISE EXCEPTION 'date_of_birth is required for signup';
  END IF;

  v_age := DATE_PART('year', AGE(v_dob));
  IF v_age < 18 THEN
    RAISE EXCEPTION 'You must be at least 18 years old to use this app';
  END IF;

  INSERT INTO public.profiles (id, username, display_name, gender, weight_kg, height_cm, date_of_birth)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'display_name',
    COALESCE(NEW.raw_user_meta_data->>'gender', 'other'),
    COALESCE((NEW.raw_user_meta_data->>'weight_kg')::REAL, 70),
    (NEW.raw_user_meta_data->>'height_cm')::REAL,
    v_dob
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 2. ON DELETE rules for clean account deletion
-- -----------------------------------------------------------------------------

-- groups.created_by: SET NULL so a deleted creator doesn't take the group with them.
DO $$
BEGIN
  IF to_regclass('public.groups') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_created_by_fkey';
    EXECUTE 'ALTER TABLE groups ALTER COLUMN created_by DROP NOT NULL';
    EXECUTE 'ALTER TABLE groups ADD CONSTRAINT groups_created_by_fkey
             FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL';
  END IF;
END $$;

-- rounds.bought_by_user_id: SET NULL (round still happened, just no longer attributed).
-- Guarded — rounds was dropped in some environments via drop-rounds.sql.
DO $$
BEGIN
  IF to_regclass('public.rounds') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE rounds DROP CONSTRAINT IF EXISTS rounds_bought_by_user_id_fkey';
    EXECUTE 'ALTER TABLE rounds ALTER COLUMN bought_by_user_id DROP NOT NULL';
    EXECUTE 'ALTER TABLE rounds ADD CONSTRAINT rounds_bought_by_user_id_fkey
             FOREIGN KEY (bought_by_user_id) REFERENCES profiles(id) ON DELETE SET NULL';
  END IF;
END $$;

-- party_sessions.host_user_id: CASCADE (no host = orphan party).
DO $$
BEGIN
  IF to_regclass('public.party_sessions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE party_sessions DROP CONSTRAINT IF EXISTS party_sessions_host_user_id_fkey';
    EXECUTE 'ALTER TABLE party_sessions ADD CONSTRAINT party_sessions_host_user_id_fkey
             FOREIGN KEY (host_user_id) REFERENCES profiles(id) ON DELETE CASCADE';
  END IF;
END $$;

-- party_drink_events.user_id: CASCADE.
DO $$
BEGIN
  IF to_regclass('public.party_drink_events') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE party_drink_events DROP CONSTRAINT IF EXISTS party_drink_events_user_id_fkey';
    EXECUTE 'ALTER TABLE party_drink_events ADD CONSTRAINT party_drink_events_user_id_fkey
             FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE';
  END IF;
END $$;

-- wagers.created_by: CASCADE.
DO $$
BEGIN
  IF to_regclass('public.wagers') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE wagers DROP CONSTRAINT IF EXISTS wagers_created_by_fkey';
    EXECUTE 'ALTER TABLE wagers ADD CONSTRAINT wagers_created_by_fkey
             FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE';
  END IF;
END $$;

-- challenges.winner_id: SET NULL.
DO $$
BEGIN
  IF to_regclass('public.challenges') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_winner_id_fkey';
    EXECUTE 'ALTER TABLE challenges ADD CONSTRAINT challenges_winner_id_fkey
             FOREIGN KEY (winner_id) REFERENCES profiles(id) ON DELETE SET NULL';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. is_username_taken RPC
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_username_taken(p_username TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE lower(username) = lower(p_username));
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_username_taken(TEXT) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Body-metric column grants (weight/height/gender/date_of_birth)
--
-- These columns are sensitive (BAC inputs, DoB). We revoke broad SELECT and
-- expose them only via a self-only RPC. Other clients querying profiles will
-- still get the public columns.
-- -----------------------------------------------------------------------------

REVOKE SELECT ON TABLE profiles FROM authenticated;
GRANT SELECT (
  id, username, display_name, avatar_url, bio,
  is_demo, is_private, created_at, updated_at
) ON profiles TO authenticated;

-- INSERT/UPDATE grants — keep all columns writable by owner (RLS still gates row-level).
GRANT INSERT, UPDATE ON profiles TO authenticated;

-- Self-only RPC for the metrics the client actually needs (own BAC calculation).
CREATE OR REPLACE FUNCTION get_my_metrics()
RETURNS TABLE (
  weight_kg REAL,
  height_cm REAL,
  gender TEXT,
  date_of_birth DATE
) AS $$
  SELECT weight_kg, height_cm, gender, date_of_birth
  FROM profiles
  WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_my_metrics() TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Tighten visibility: groups, group_members, challenges, wagers, party_*,
--    rounds, comment_likes, follows, blocked_users
-- -----------------------------------------------------------------------------

-- Helper: is the caller a member of this group?
CREATE OR REPLACE FUNCTION is_group_member(p_group_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ---- groups: members only (joining-by-code goes through join_group_by_invite RPC) ----
DO $$
BEGIN
  IF to_regclass('public.groups') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "groups_select" ON groups';
    EXECUTE 'CREATE POLICY "groups_select" ON groups FOR SELECT TO authenticated
             USING (is_group_member(id))';
  END IF;
  IF to_regclass('public.group_members') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "gm_select" ON group_members';
    EXECUTE 'CREATE POLICY "gm_select" ON group_members FOR SELECT TO authenticated
             USING (is_group_member(group_id))';
  END IF;
END $$;

-- ---- challenges + challenge_participants: members only (guarded) ----
DO $$
BEGIN
  IF to_regclass('public.challenges') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "challenges_select" ON challenges';
    EXECUTE 'CREATE POLICY "challenges_select" ON challenges FOR SELECT TO authenticated
             USING (is_group_member(group_id))';
  END IF;
  IF to_regclass('public.challenge_participants') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "cp_select" ON challenge_participants';
    EXECUTE 'CREATE POLICY "cp_select" ON challenge_participants FOR SELECT TO authenticated
             USING (EXISTS (
               SELECT 1 FROM challenges c
               WHERE c.id = challenge_participants.challenge_id
                 AND is_group_member(c.group_id)
             ))';
  END IF;
END $$;

-- ---- wagers + wager_participants: members of the parent challenge's group only (guarded) ----
DO $$
BEGIN
  IF to_regclass('public.wagers') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "wagers_select" ON wagers';
    EXECUTE 'CREATE POLICY "wagers_select" ON wagers FOR SELECT TO authenticated
             USING (EXISTS (
               SELECT 1 FROM challenges c
               WHERE c.id = wagers.challenge_id
                 AND is_group_member(c.group_id)
             ))';
  END IF;
  IF to_regclass('public.wager_participants') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "wp_select" ON wager_participants';
    EXECUTE 'CREATE POLICY "wp_select" ON wager_participants FOR SELECT TO authenticated
             USING (EXISTS (
               SELECT 1 FROM wagers w
               JOIN challenges c ON c.id = w.challenge_id
               WHERE w.id = wager_participants.wager_id
                 AND is_group_member(c.group_id)
             ))';
  END IF;
END $$;

-- ---- party_*: members of the host group only (guarded) ----
DO $$
BEGIN
  IF to_regclass('public.party_sessions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "party_select" ON party_sessions';
    EXECUTE 'CREATE POLICY "party_select" ON party_sessions FOR SELECT TO authenticated
             USING (is_group_member(group_id))';
  END IF;
  IF to_regclass('public.party_participants') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "pp_select" ON party_participants';
    EXECUTE 'CREATE POLICY "pp_select" ON party_participants FOR SELECT TO authenticated
             USING (EXISTS (
               SELECT 1 FROM party_sessions ps
               WHERE ps.id = party_participants.party_id
                 AND is_group_member(ps.group_id)
             ))';
  END IF;
  IF to_regclass('public.party_drink_events') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "pde_select" ON party_drink_events';
    EXECUTE 'CREATE POLICY "pde_select" ON party_drink_events FOR SELECT TO authenticated
             USING (EXISTS (
               SELECT 1 FROM party_sessions ps
               WHERE ps.id = party_drink_events.party_id
                 AND is_group_member(ps.group_id)
             ))';
  END IF;
END $$;

-- ---- rounds: same privacy as the parent session (guarded; table may be dropped) ----
DO $$
BEGIN
  IF to_regclass('public.rounds') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "rounds_select" ON rounds';
    EXECUTE 'CREATE POLICY "rounds_select" ON rounds FOR SELECT TO authenticated
             USING (EXISTS (
               SELECT 1 FROM drink_sessions ds
               WHERE ds.id = rounds.session_id
                 AND can_view_user_data(ds.user_id)
             ))';
  END IF;
END $$;

-- ---- comment_likes: same privacy as the parent feed item (guarded) ----
DO $$
BEGIN
  IF to_regclass('public.comment_likes') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "comment_likes_select" ON comment_likes';
    EXECUTE 'CREATE POLICY "comment_likes_select" ON comment_likes FOR SELECT TO authenticated
             USING (EXISTS (
               SELECT 1 FROM feed_comments fc
               JOIN feed_items fi ON fi.id = fc.feed_item_id
               WHERE fc.id = comment_likes.comment_id
                 AND can_view_user_data(fi.user_id)
             ))';
  END IF;
END $$;

-- ---- follows: hide social graph of private accounts from non-followers ----
DROP POLICY IF EXISTS "follows_select" ON follows;
CREATE POLICY "follows_select" ON follows FOR SELECT TO authenticated
  USING (
    can_view_user_data(follower_id) OR can_view_user_data(following_id)
  );

-- -----------------------------------------------------------------------------
-- 6. Block enforcement
--
-- A blocker should not see the blocked user's posts/comments/profile, and the
-- blocked user should not see the blocker's. Update can_view_user_data to
-- honor blocks symmetrically.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION can_view_user_data(owner_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() = owner_id THEN RETURN true; END IF;

  -- Symmetric block: either side blocked the other → no visibility
  IF EXISTS (
    SELECT 1 FROM blocked_users
    WHERE (blocker_id = auth.uid() AND blocked_id = owner_id)
       OR (blocker_id = owner_id AND blocked_id = auth.uid())
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = owner_id AND is_private = true) THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM follows WHERE follower_id = auth.uid() AND following_id = owner_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Block-aware policy on follow_requests so a blocked user can't request follow.
DROP POLICY IF EXISTS "follow_requests_insert" ON follow_requests;
CREATE POLICY "follow_requests_insert" ON follow_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = requester_id
    AND NOT EXISTS (
      SELECT 1 FROM blocked_users
      WHERE (blocker_id = auth.uid() AND blocked_id = target_id)
         OR (blocker_id = target_id AND blocked_id = auth.uid())
    )
  );

-- Block-aware insert on feed_likes / feed_comments — can't engage with someone you've blocked or who blocked you.
DROP POLICY IF EXISTS "likes_insert" ON feed_likes;
CREATE POLICY "likes_insert" ON feed_likes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM feed_items fi
      WHERE fi.id = feed_item_id AND can_view_user_data(fi.user_id)
    )
  );

DROP POLICY IF EXISTS "comments_insert" ON feed_comments;
CREATE POLICY "comments_insert" ON feed_comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM feed_items fi
      WHERE fi.id = feed_item_id AND can_view_user_data(fi.user_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 7. Mention-by-username (was matching by display_name, leaking notifications)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_feed_comment_inserted()
RETURNS trigger AS $$
DECLARE
  v_post_owner uuid;
  v_parent_author uuid;
  v_name text;
  v_mention text;
  v_mentioned_id uuid;
BEGIN
  SELECT user_id INTO v_post_owner FROM feed_items WHERE id = NEW.feed_item_id;
  v_name := get_display_name(NEW.user_id);

  IF v_post_owner IS DISTINCT FROM NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, type, title, body, data)
    VALUES (v_post_owner, NEW.user_id, 'comment', 'New Comment', v_name || ' commented on your post',
            jsonb_build_object('feedItemId', NEW.feed_item_id, 'commentId', NEW.id, 'commentPreview', left(NEW.text, 100)));
  END IF;

  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_author FROM feed_comments WHERE id = NEW.parent_comment_id;
    IF v_parent_author IS DISTINCT FROM NEW.user_id AND v_parent_author IS DISTINCT FROM v_post_owner THEN
      INSERT INTO notifications (user_id, actor_id, type, title, body, data)
      VALUES (v_parent_author, NEW.user_id, 'reply', 'New Reply', v_name || ' replied to your comment',
              jsonb_build_object('feedItemId', NEW.feed_item_id, 'commentId', NEW.id, 'parentCommentId', NEW.parent_comment_id, 'commentPreview', left(NEW.text, 100)));
    END IF;
  END IF;

  -- Match by username (the @-handle), not display_name. Case-insensitive.
  FOR v_mention IN
    SELECT (regexp_matches(NEW.text, '@([a-z0-9_]+)', 'gi'))[1]
  LOOP
    SELECT id INTO v_mentioned_id FROM profiles
      WHERE lower(username) = lower(v_mention) LIMIT 1;

    IF v_mentioned_id IS NOT NULL
       AND v_mentioned_id IS DISTINCT FROM NEW.user_id
       AND v_mentioned_id IS DISTINCT FROM v_post_owner
       AND (v_parent_author IS NULL OR v_mentioned_id IS DISTINCT FROM v_parent_author)
    THEN
      INSERT INTO notifications (user_id, actor_id, type, title, body, data)
      VALUES (v_mentioned_id, NEW.user_id, 'mention', 'You were mentioned',
              v_name || ' mentioned you',
              jsonb_build_object('feedItemId', NEW.feed_item_id, 'commentId', NEW.id, 'commentPreview', left(NEW.text, 100)));
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 8. Follow-request rate limit (50 pending/sent per user per day)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_follow_request_rate_limit()
RETURNS trigger AS $$
DECLARE
  v_recent_count INT;
BEGIN
  SELECT COUNT(*) INTO v_recent_count
  FROM follow_requests
  WHERE requester_id = NEW.requester_id
    AND created_at > NOW() - INTERVAL '1 day';

  IF v_recent_count >= 50 THEN
    RAISE EXCEPTION 'Follow request limit reached (50/day). Try again tomorrow.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_follow_request_rate_limit ON follow_requests;
CREATE TRIGGER trg_follow_request_rate_limit
  BEFORE INSERT ON follow_requests
  FOR EACH ROW EXECUTE FUNCTION enforce_follow_request_rate_limit();

-- -----------------------------------------------------------------------------
-- 9. join_group_by_invite RPC
--
-- Bypasses the new groups RLS so a non-member can join via invite code without
-- being able to enumerate groups.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION join_group_by_invite(p_invite_code TEXT)
RETURNS UUID AS $$
DECLARE
  v_group_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_group_id FROM groups
  WHERE invite_code = p_invite_code AND is_active = true;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  INSERT INTO group_members (group_id, user_id, role)
  VALUES (v_group_id, auth.uid(), 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN v_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION join_group_by_invite(TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 10. Follow-request notification triggers
--
-- Replaces the broken client-side send-notification invocations with proper
-- DB triggers. INSERT → notify target of pending request. UPDATE to accepted
-- → notify requester. Rejected requests don't notify (the requester learns
-- via UI that their request is no longer pending).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_follow_request_inserted()
RETURNS trigger AS $$
DECLARE
  v_name text;
BEGIN
  v_name := get_display_name(NEW.requester_id);
  INSERT INTO notifications (user_id, actor_id, type, title, body, data)
  VALUES (
    NEW.target_id,
    NEW.requester_id,
    'follow_request',
    'Follow Request',
    v_name || ' requested to follow you',
    jsonb_build_object('requestId', NEW.id, 'actorId', NEW.requester_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_follow_request_notify ON follow_requests;
CREATE TRIGGER trg_follow_request_notify
  AFTER INSERT ON follow_requests
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION on_follow_request_inserted();

CREATE OR REPLACE FUNCTION on_follow_request_accepted_notify()
RETURNS trigger AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    v_name := get_display_name(NEW.target_id);
    INSERT INTO notifications (user_id, actor_id, type, title, body, data)
    VALUES (
      NEW.requester_id,
      NEW.target_id,
      'follow_request_accepted',
      'Follow Request Accepted',
      v_name || ' accepted your follow request',
      jsonb_build_object('actorId', NEW.target_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_follow_request_accepted_notify ON follow_requests;
CREATE TRIGGER trg_follow_request_accepted_notify
  AFTER UPDATE ON follow_requests
  FOR EACH ROW
  EXECUTE FUNCTION on_follow_request_accepted_notify();

-- The on_follow_inserted trigger fires for accept-flow follows too, sending a
-- redundant 'follow' notification. Skip it when the follow originated from a
-- recently-accepted follow_request.
CREATE OR REPLACE FUNCTION on_follow_inserted()
RETURNS trigger AS $$
DECLARE
  v_name text;
  v_recently_accepted boolean;
BEGIN
  IF NEW.follower_id = NEW.following_id THEN RETURN NEW; END IF;

  -- If a follow_request was just accepted, the dedicated accept notif covers it.
  SELECT EXISTS (
    SELECT 1 FROM follow_requests
    WHERE requester_id = NEW.follower_id
      AND target_id = NEW.following_id
      AND status = 'accepted'
      AND updated_at > now() - INTERVAL '1 minute'
  ) INTO v_recently_accepted;

  IF v_recently_accepted THEN RETURN NEW; END IF;

  v_name := get_display_name(NEW.follower_id);
  INSERT INTO notifications (user_id, actor_id, type, title, body, data)
  VALUES (NEW.following_id, NEW.follower_id, 'follow', 'New Follower', v_name || ' followed you',
          jsonb_build_object('actorId', NEW.follower_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 11. delete_user_account RPC (the Edge Fn calls this with service-role)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Profile delete cascades through everything FK'd ON DELETE CASCADE.
  -- Tables now safely covered by the FK fixes above.
  DELETE FROM profiles WHERE id = v_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;
