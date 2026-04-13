-- ============================================================================
-- Migration: Notification cleanup on action reversal
-- ============================================================================
-- When a comment/like/follow is deleted, the corresponding notification
-- should be removed (standard social media behavior).
-- ============================================================================

-- 1. Update comment insert trigger to include commentId in all notification types
--    (needed so the DELETE trigger can match notifications to their source comment)

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
            jsonb_build_object('feedItemId', NEW.feed_item_id, 'commentId', NEW.id));
  END IF;

  -- If reply, also notify parent comment author (skip if same as post owner or self)
  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_author FROM feed_comments WHERE id = NEW.parent_comment_id;
    IF v_parent_author IS DISTINCT FROM NEW.user_id AND v_parent_author IS DISTINCT FROM v_post_owner THEN
      INSERT INTO notifications (user_id, actor_id, type, title, body, data)
      VALUES (v_parent_author, NEW.user_id, 'reply', 'New Reply', v_name || ' replied to your comment',
              jsonb_build_object('feedItemId', NEW.feed_item_id, 'commentId', NEW.id, 'parentCommentId', NEW.parent_comment_id));
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
              jsonb_build_object('feedItemId', NEW.feed_item_id, 'commentId', NEW.id));
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Cleanup triggers — fire AFTER DELETE to remove orphaned notifications

-- Comment deleted → remove comment/reply/mention notifications
CREATE OR REPLACE FUNCTION on_feed_comment_deleted()
RETURNS trigger AS $$
BEGIN
  DELETE FROM notifications
  WHERE data->>'commentId' = OLD.id::text;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_feed_comment_cleanup ON feed_comments;
CREATE TRIGGER trg_feed_comment_cleanup
  AFTER DELETE ON feed_comments
  FOR EACH ROW EXECUTE FUNCTION on_feed_comment_deleted();

-- Like removed → remove like notification
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

DROP TRIGGER IF EXISTS trg_feed_like_cleanup ON feed_likes;
CREATE TRIGGER trg_feed_like_cleanup
  AFTER DELETE ON feed_likes
  FOR EACH ROW EXECUTE FUNCTION on_feed_like_deleted();

-- Unfollow → remove follow notification
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

DROP TRIGGER IF EXISTS trg_follow_cleanup ON follows;
CREATE TRIGGER trg_follow_cleanup
  AFTER DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION on_follow_deleted();

-- Comment like removed → remove comment_like notification
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

DROP TRIGGER IF EXISTS trg_comment_like_cleanup ON comment_likes;
CREATE TRIGGER trg_comment_like_cleanup
  AFTER DELETE ON comment_likes
  FOR EACH ROW EXECUTE FUNCTION on_comment_like_deleted();

-- 3. Clean up existing orphaned notifications
--    (actions that were reversed before this migration)

-- Comment notifications where the source comment no longer exists
DELETE FROM notifications n
WHERE n.type IN ('comment', 'reply', 'mention')
  AND n.data ? 'feedItemId'
  AND (
    -- New format: specific commentId stored but comment is gone
    (n.data ? 'commentId' AND NOT EXISTS (
      SELECT 1 FROM feed_comments WHERE id = (n.data->>'commentId')::uuid
    ))
    OR
    -- Old format: no commentId stored; orphaned if actor has zero remaining comments on that post
    (NOT (n.data ? 'commentId') AND n.actor_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM feed_comments
      WHERE feed_item_id = (n.data->>'feedItemId')::uuid
        AND user_id = n.actor_id
    ))
  );

-- Like notifications where the like no longer exists
DELETE FROM notifications n
WHERE n.type = 'like'
  AND n.actor_id IS NOT NULL
  AND n.data ? 'feedItemId'
  AND NOT EXISTS (
    SELECT 1 FROM feed_likes
    WHERE feed_item_id = (n.data->>'feedItemId')::uuid
      AND user_id = n.actor_id
  );

-- Follow notifications where the follow no longer exists
DELETE FROM notifications n
WHERE n.type = 'follow'
  AND n.actor_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM follows
    WHERE follower_id = n.actor_id
      AND following_id = n.user_id
  );
