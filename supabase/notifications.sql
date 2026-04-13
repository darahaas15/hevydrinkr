-- ============================================================================
-- Push Notifications Schema
-- ============================================================================

-- Device tokens for push notifications (APNs for iOS, Web Push for PWA)
CREATE TABLE IF NOT EXISTS device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'web',  -- 'ios' | 'web'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

-- Notification preferences per user
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  likes_enabled boolean NOT NULL DEFAULT true,
  comments_enabled boolean NOT NULL DEFAULT true,
  follows_enabled boolean NOT NULL DEFAULT true,
  group_joins_enabled boolean NOT NULL DEFAULT true,
  challenges_enabled boolean NOT NULL DEFAULT true,
  session_reminders_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Notification history (for in-app notification center, unread badges)
-- DB triggers insert rows here; a Database Webhook on INSERT calls the Edge Function to deliver push (APNs or Web Push).
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL,  -- 'like' | 'comment' | 'reply' | 'follow' | 'group_join' | 'challenge_created' | 'challenge_ending' | 'welcome'
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}',  -- deep-link info: { feedItemId, groupId, userId, etc. }
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read)
  WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- device_tokens: owner can CRUD
CREATE POLICY "Users can manage their own device tokens"
  ON device_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- notification_preferences: owner can read/upsert
CREATE POLICY "Users can manage their notification preferences"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- notifications: owner can read and update (mark read)
CREATE POLICY "Users can read their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Auto-create notification preferences on signup
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user_notification_prefs()
RETURNS trigger AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_notification_prefs
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_notification_prefs();

-- ============================================================================
-- Database triggers — insert into notifications table directly.
-- A Database Webhook (configured in Dashboard) on notifications INSERT
-- calls the send-notification Edge Function to deliver push notifications.
-- ============================================================================

-- Helper: get a user's display name
CREATE OR REPLACE FUNCTION get_display_name(p_user_id uuid)
RETURNS text AS $$
  SELECT COALESCE(display_name, 'Someone') FROM profiles WHERE id = p_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Trigger: new like on a feed item ──
CREATE OR REPLACE FUNCTION on_feed_like_inserted()
RETURNS trigger AS $$
DECLARE
  v_post_owner uuid;
  v_name text;
BEGIN
  SELECT user_id INTO v_post_owner FROM feed_items WHERE id = NEW.feed_item_id;
  IF v_post_owner = NEW.user_id THEN RETURN NEW; END IF;

  v_name := get_display_name(NEW.user_id);
  INSERT INTO notifications (user_id, actor_id, type, title, body, data)
  VALUES (v_post_owner, NEW.user_id, 'like', 'New Like', v_name || ' liked your post',
          jsonb_build_object('feedItemId', NEW.feed_item_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_feed_like_notify
  AFTER INSERT ON feed_likes
  FOR EACH ROW EXECUTE FUNCTION on_feed_like_inserted();

-- ── Trigger: new comment on a feed item ──
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

  -- Notify post owner (skip self)
  IF v_post_owner IS DISTINCT FROM NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, type, title, body, data)
    VALUES (v_post_owner, NEW.user_id, 'comment', 'New Comment', v_name || ' commented on your post',
            jsonb_build_object('feedItemId', NEW.feed_item_id, 'commentId', NEW.id, 'commentPreview', left(NEW.text, 100)));
  END IF;

  -- If reply, also notify parent comment author (skip if same as post owner or self)
  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_author FROM feed_comments WHERE id = NEW.parent_comment_id;
    IF v_parent_author IS DISTINCT FROM NEW.user_id AND v_parent_author IS DISTINCT FROM v_post_owner THEN
      INSERT INTO notifications (user_id, actor_id, type, title, body, data)
      VALUES (v_parent_author, NEW.user_id, 'reply', 'New Reply', v_name || ' replied to your comment',
              jsonb_build_object('feedItemId', NEW.feed_item_id, 'commentId', NEW.id, 'parentCommentId', NEW.parent_comment_id, 'commentPreview', left(NEW.text, 100)));
    END IF;
  END IF;

  -- Notify @mentioned users (skip self, post owner, and parent author already notified above)
  FOR v_mention IN
    SELECT (regexp_matches(NEW.text, '@([A-Za-z0-9_.]+)', 'g'))[1]
  LOOP
    SELECT id INTO v_mentioned_id FROM profiles
      WHERE lower(display_name) = lower(v_mention) LIMIT 1;

    IF v_mentioned_id IS NOT NULL
       AND v_mentioned_id IS DISTINCT FROM NEW.user_id
       AND v_mentioned_id IS DISTINCT FROM v_post_owner
       AND (v_parent_author IS NULL OR v_mentioned_id IS DISTINCT FROM v_parent_author)
    THEN
      INSERT INTO notifications (user_id, actor_id, type, title, body, data)
      VALUES (v_mentioned_id, NEW.user_id, 'mention', 'You were mentioned',
              v_name || ' mentioned you in a comment',
              jsonb_build_object('feedItemId', NEW.feed_item_id, 'commentId', NEW.id, 'commentPreview', left(NEW.text, 100)));
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_feed_comment_notify
  AFTER INSERT ON feed_comments
  FOR EACH ROW EXECUTE FUNCTION on_feed_comment_inserted();

-- ── Trigger: new follow ──
CREATE OR REPLACE FUNCTION on_follow_inserted()
RETURNS trigger AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.follower_id = NEW.following_id THEN RETURN NEW; END IF;

  v_name := get_display_name(NEW.follower_id);
  INSERT INTO notifications (user_id, actor_id, type, title, body, data)
  VALUES (NEW.following_id, NEW.follower_id, 'follow', 'New Follower', v_name || ' started following you',
          jsonb_build_object('actorId', NEW.follower_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_follow_notify
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION on_follow_inserted();

-- ── Trigger: new group member joined ──
CREATE OR REPLACE FUNCTION on_group_member_joined()
RETURNS trigger AS $$
DECLARE
  v_admin_id uuid;
  v_name text;
BEGIN
  SELECT created_by INTO v_admin_id FROM groups WHERE id = NEW.group_id;
  IF v_admin_id = NEW.user_id THEN RETURN NEW; END IF;

  v_name := get_display_name(NEW.user_id);
  INSERT INTO notifications (user_id, actor_id, type, title, body, data)
  VALUES (v_admin_id, NEW.user_id, 'group_join', 'New Group Member', v_name || ' joined your group',
          jsonb_build_object('groupId', NEW.group_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_group_member_notify
  AFTER INSERT ON group_members
  FOR EACH ROW EXECUTE FUNCTION on_group_member_joined();

-- ── Trigger: new challenge created ──
CREATE OR REPLACE FUNCTION on_challenge_created()
RETURNS trigger AS $$
DECLARE
  v_member record;
BEGIN
  FOR v_member IN
    SELECT user_id FROM group_members WHERE group_id = NEW.group_id
  LOOP
    -- Skip the person who presumably created the challenge
    CONTINUE WHEN v_member.user_id = (SELECT created_by FROM groups WHERE id = NEW.group_id);

    INSERT INTO notifications (user_id, actor_id, type, title, body, data)
    VALUES (v_member.user_id, NULL, 'challenge_created', 'New Challenge',
            'A new challenge was created in your group',
            jsonb_build_object('groupId', NEW.group_id, 'challengeId', NEW.id));
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_challenge_notify
  AFTER INSERT ON challenges
  FOR EACH ROW EXECUTE FUNCTION on_challenge_created();

-- ── Trigger: comment liked ──
CREATE OR REPLACE FUNCTION on_comment_like_inserted()
RETURNS trigger AS $$
DECLARE
  v_comment_author uuid;
  v_feed_item_id uuid;
  v_name text;
BEGIN
  SELECT user_id, feed_item_id INTO v_comment_author, v_feed_item_id
    FROM feed_comments WHERE id = NEW.comment_id;
  IF v_comment_author = NEW.user_id THEN RETURN NEW; END IF;

  v_name := get_display_name(NEW.user_id);
  INSERT INTO notifications (user_id, actor_id, type, title, body, data)
  VALUES (v_comment_author, NEW.user_id, 'comment_like', 'Comment Liked',
          v_name || ' liked your comment',
          jsonb_build_object('feedItemId', v_feed_item_id, 'commentId', NEW.comment_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_comment_like_notify
  AFTER INSERT ON comment_likes
  FOR EACH ROW EXECUTE FUNCTION on_comment_like_inserted();

-- ============================================================================
-- Cleanup triggers — remove notifications when source actions are reversed
-- ============================================================================

-- ── Comment deleted → remove comment/reply/mention notifications ──
CREATE OR REPLACE FUNCTION on_feed_comment_deleted()
RETURNS trigger AS $$
BEGIN
  DELETE FROM notifications
  WHERE data->>'commentId' = OLD.id::text;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_feed_comment_cleanup
  AFTER DELETE ON feed_comments
  FOR EACH ROW EXECUTE FUNCTION on_feed_comment_deleted();

-- ── Like removed → remove like notification ──
CREATE OR REPLACE FUNCTION on_feed_like_deleted()
RETURNS trigger AS $$
BEGIN
  DELETE FROM notifications
  WHERE type = 'like'
    AND actor_id = OLD.user_id
    AND data->>'feedItemId' = OLD.feed_item_id::text;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_feed_like_cleanup
  AFTER DELETE ON feed_likes
  FOR EACH ROW EXECUTE FUNCTION on_feed_like_deleted();

-- ── Unfollow → remove follow notification ──
CREATE OR REPLACE FUNCTION on_follow_deleted()
RETURNS trigger AS $$
BEGIN
  DELETE FROM notifications
  WHERE type = 'follow'
    AND actor_id = OLD.follower_id
    AND user_id = OLD.following_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_follow_cleanup
  AFTER DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION on_follow_deleted();

-- ── Comment like removed → remove comment_like notification ──
CREATE OR REPLACE FUNCTION on_comment_like_deleted()
RETURNS trigger AS $$
BEGIN
  DELETE FROM notifications
  WHERE type = 'comment_like'
    AND actor_id = OLD.user_id
    AND data->>'commentId' = OLD.comment_id::text;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_comment_like_cleanup
  AFTER DELETE ON comment_likes
  FOR EACH ROW EXECUTE FUNCTION on_comment_like_deleted();
