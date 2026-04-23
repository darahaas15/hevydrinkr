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
