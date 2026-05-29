-- =============================================================
-- Post Tags Migration
-- Run AFTER 20260428_notification_context.sql
--
-- Lets a user tag people they follow in a session post. Tags are
-- stored denormalized on feed_items so the new-post notification
-- trigger can see them atomically with the post (a tagged follower
-- then gets ONE "tagged you" notification instead of both a
-- "new post" and a "tag" push).
--
-- Covers:
--   1. feed_items.tagged_user_ids column + GIN index
--   2. tags ⊆ following enforcement (BEFORE trigger)
--   3. on_feed_item_inserted: skip tagged followers for new_post,
--      add a 'tag' notification per tagged user
--   4. edit support: AFTER UPDATE trigger notifies newly-added tags
--      and cleans up notifications for removed tags
--   5. cleanup: a 'tag' notification is removed if the post is deleted
--      (handled by the UPDATE/INSERT logic + a delete cleanup below)
--   6. notification_preferences.tags_enabled column
-- =============================================================

-- -----------------------------------------------------------------------------
-- 1. Column + index
-- -----------------------------------------------------------------------------

ALTER TABLE feed_items
  ADD COLUMN IF NOT EXISTS tagged_user_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_feed_tagged ON feed_items USING gin (tagged_user_ids);

-- -----------------------------------------------------------------------------
-- 2. tags ⊆ following enforcement
--
-- Every tagged id must be someone the poster follows, and you can't tag
-- yourself. SECURITY DEFINER so the follows lookup bypasses RLS reliably.
-- Fires on INSERT and whenever tagged_user_ids changes on UPDATE.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_tags_subset_following()
RETURNS trigger AS $$
BEGIN
  IF NEW.tagged_user_ids IS NULL OR array_length(NEW.tagged_user_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(NEW.tagged_user_ids) AS u(id)
    WHERE u.id = NEW.user_id
       OR NOT EXISTS (
         SELECT 1 FROM follows
         WHERE follower_id = NEW.user_id AND following_id = u.id
       )
  ) THEN
    RAISE EXCEPTION 'Tagged users must be people you follow (and not yourself)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_feed_item_tags_validate ON feed_items;
CREATE TRIGGER trg_feed_item_tags_validate
  BEFORE INSERT OR UPDATE OF tagged_user_ids ON feed_items
  FOR EACH ROW EXECUTE FUNCTION enforce_tags_subset_following();

-- -----------------------------------------------------------------------------
-- 3. New post → notify followers (skipping tagged users) + notify tagged users
--
-- Replaces on_feed_item_inserted from notifications.sql. Tagged users get a
-- dedicated 'tag' notification instead of the generic 'new_post', so they
-- never receive both for the same post.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_feed_item_inserted()
RETURNS trigger AS $$
DECLARE
  v_name text;
  v_follower record;
  v_tagged uuid;
BEGIN
  v_name := get_display_name(NEW.user_id);

  -- Followers who are NOT tagged → generic new_post notification.
  FOR v_follower IN
    SELECT follower_id FROM follows WHERE following_id = NEW.user_id
  LOOP
    CONTINUE WHEN v_follower.follower_id = ANY(NEW.tagged_user_ids);

    INSERT INTO notifications (user_id, actor_id, type, title, body, data)
    VALUES (
      v_follower.follower_id,
      NEW.user_id,
      'new_post',
      'New Post',
      v_name || ' shared a new session',
      jsonb_build_object('feedItemId', NEW.id)
    );
  END LOOP;

  -- Tagged users (skip self) → 'tag' notification.
  FOREACH v_tagged IN ARRAY NEW.tagged_user_ids
  LOOP
    CONTINUE WHEN v_tagged = NEW.user_id;

    INSERT INTO notifications (user_id, actor_id, type, title, body, data)
    VALUES (
      v_tagged,
      NEW.user_id,
      'tag',
      'Tagged in a post',
      v_name || ' tagged you in a post',
      jsonb_build_object('feedItemId', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger trg_feed_item_notify already exists (AFTER INSERT) and points at this
-- function name; CREATE OR REPLACE above is enough.

-- -----------------------------------------------------------------------------
-- 4. Edit support — tags added/removed on an existing post
--
-- Newly-added tags get a 'tag' notification (and any stale new_post for that
-- user+post is cleared first, matching the insert behavior). Removed tags have
-- their 'tag' notification cleaned up.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_feed_item_tags_updated()
RETURNS trigger AS $$
DECLARE
  v_name text;
  v_added uuid;
BEGIN
  v_name := get_display_name(NEW.user_id);

  -- Added = NEW - OLD
  FOR v_added IN
    SELECT u.id FROM unnest(NEW.tagged_user_ids) AS u(id)
    EXCEPT
    SELECT o.id FROM unnest(OLD.tagged_user_ids) AS o(id)
  LOOP
    CONTINUE WHEN v_added = NEW.user_id;

    DELETE FROM notifications
    WHERE user_id = v_added
      AND type = 'new_post'
      AND data->>'feedItemId' = NEW.id::text;

    INSERT INTO notifications (user_id, actor_id, type, title, body, data)
    VALUES (
      v_added,
      NEW.user_id,
      'tag',
      'Tagged in a post',
      v_name || ' tagged you in a post',
      jsonb_build_object('feedItemId', NEW.id)
    );
  END LOOP;

  -- Removed = OLD - NEW → clean up their tag notification.
  DELETE FROM notifications
  WHERE type = 'tag'
    AND data->>'feedItemId' = NEW.id::text
    AND user_id IN (
      SELECT o.id FROM unnest(OLD.tagged_user_ids) AS o(id)
      EXCEPT
      SELECT n.id FROM unnest(NEW.tagged_user_ids) AS n(id)
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_feed_item_tags_update ON feed_items;
CREATE TRIGGER trg_feed_item_tags_update
  AFTER UPDATE OF tagged_user_ids ON feed_items
  FOR EACH ROW
  WHEN (OLD.tagged_user_ids IS DISTINCT FROM NEW.tagged_user_ids)
  EXECUTE FUNCTION on_feed_item_tags_updated();

-- -----------------------------------------------------------------------------
-- 5. Post deleted → remove its 'tag' notifications
--
-- 'tag' notifications reference the post only via data->>'feedItemId' (no FK),
-- so a post delete won't cascade to them. Clean them up explicitly.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_feed_item_deleted_tags_cleanup()
RETURNS trigger AS $$
BEGIN
  DELETE FROM notifications
  WHERE type = 'tag'
    AND data->>'feedItemId' = OLD.id::text;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_feed_item_tags_cleanup ON feed_items;
CREATE TRIGGER trg_feed_item_tags_cleanup
  AFTER DELETE ON feed_items
  FOR EACH ROW EXECUTE FUNCTION on_feed_item_deleted_tags_cleanup();

-- -----------------------------------------------------------------------------
-- 6. notification_preferences.tags_enabled
-- -----------------------------------------------------------------------------

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS tags_enabled boolean NOT NULL DEFAULT true;
