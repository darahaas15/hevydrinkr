-- =============================================================
-- Notification Context Migration
-- Run AFTER 20260425_launch_readiness.sql
--
-- Tightens up notification copy that was missing context:
--   * group_join: now names the group ("Sarah joined 🍻 Friday Crew")
--   * challenge_created: title names the group, body is the challenge title
--   * mention: clarifies it happened in a comment
-- =============================================================

-- -----------------------------------------------------------------------------
-- group_join: include group name + emoji in the body, expose groupName in data
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_group_member_joined()
RETURNS trigger AS $$
DECLARE
  v_admin_id uuid;
  v_name text;
  v_group_name text;
  v_group_emoji text;
  v_group_label text;
BEGIN
  SELECT created_by, name, coalesce(emoji, '')
    INTO v_admin_id, v_group_name, v_group_emoji
    FROM groups WHERE id = NEW.group_id;
  IF v_admin_id = NEW.user_id THEN RETURN NEW; END IF;

  v_name := get_display_name(NEW.user_id);
  v_group_label := CASE WHEN v_group_emoji = '' THEN v_group_name ELSE v_group_emoji || ' ' || v_group_name END;
  INSERT INTO notifications (user_id, actor_id, type, title, body, data)
  VALUES (v_admin_id, NEW.user_id, 'group_join', 'New Group Member',
          v_name || ' joined ' || v_group_label,
          jsonb_build_object('groupId', NEW.group_id, 'groupName', v_group_name));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- challenge_created: title carries the group, body carries the challenge title
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_challenge_created()
RETURNS trigger AS $$
DECLARE
  v_member record;
  v_group_name text;
  v_group_creator uuid;
BEGIN
  SELECT name, created_by INTO v_group_name, v_group_creator
    FROM groups WHERE id = NEW.group_id;

  FOR v_member IN
    SELECT user_id FROM group_members WHERE group_id = NEW.group_id
  LOOP
    CONTINUE WHEN v_member.user_id = v_group_creator;

    INSERT INTO notifications (user_id, actor_id, type, title, body, data)
    VALUES (v_member.user_id, NULL, 'challenge_created',
            'New challenge in ' || v_group_name,
            NEW.title,
            jsonb_build_object('groupId', NEW.group_id, 'groupName', v_group_name,
                               'challengeId', NEW.id, 'challengeTitle', NEW.title));
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- mention: clarify location ("…mentioned you in a comment")
-- Re-defines on_feed_comment_inserted from 20260425_launch_readiness.sql
-- with only the mention body string changed.
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
              v_name || ' mentioned you in a comment',
              jsonb_build_object('feedItemId', NEW.feed_item_id, 'commentId', NEW.id, 'commentPreview', left(NEW.text, 100)));
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
