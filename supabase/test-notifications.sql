-- ============================================================================
-- Notification Trigger Integration Test
-- Run in Supabase SQL Editor. Uses two real users from your profiles table.
-- Creates temporary test data, fires every trigger, checks results, cleans up.
-- ============================================================================

DO $$
DECLARE
  user_a uuid;          -- actor (performs actions)
  user_b uuid;          -- recipient (should get notifications)
  user_a_name text;
  user_b_name text;
  v_feed_item_id uuid;
  v_comment_id uuid;
  v_reply_id uuid;
  v_mention_comment_id uuid;
  v_group_id uuid;
  v_challenge_id uuid;
  v_count int;
  v_passed int := 0;
  v_failed int := 0;
  v_total int := 8;
  v_notif_ids uuid[] := '{}';
  v_temp_id uuid;
BEGIN

  -- ── Pick two different users ──────────────────────────────────────────────
  SELECT id, display_name INTO user_a, user_a_name FROM profiles ORDER BY created_at LIMIT 1;
  SELECT id, display_name INTO user_b, user_b_name FROM profiles WHERE id != user_a ORDER BY created_at LIMIT 1;

  IF user_a IS NULL OR user_b IS NULL THEN
    RAISE EXCEPTION 'Need at least 2 users in profiles table to run this test';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════';
  RAISE NOTICE '  Notification Trigger Integration Test';
  RAISE NOTICE '══════════════════════════════════════════════════';
  RAISE NOTICE '  Actor (user_a):     % [%]', user_a_name, user_a;
  RAISE NOTICE '  Recipient (user_b): % [%]', user_b_name, user_b;
  RAISE NOTICE '──────────────────────────────────────────────────';

  -- ── Setup: create a feed item owned by user_b ─────────────────────────────
  INSERT INTO feed_items (user_id, session_summary)
  VALUES (user_b, '{"totalDrinks": 3, "duration": 3600}'::jsonb)
  RETURNING id INTO v_feed_item_id;

  -- ── Setup: create a comment by user_b (for reply + comment like tests) ────
  INSERT INTO feed_comments (feed_item_id, user_id, text)
  VALUES (v_feed_item_id, user_b, 'Test comment by user_b')
  RETURNING id INTO v_comment_id;
  -- Clear the notification this generates (user_b commenting on own post = no notif, but just in case)
  DELETE FROM notifications WHERE data->>'feedItemId' = v_feed_item_id::text AND type = 'comment';

  -- ═══════════════════════════════════════════════════════════════════════════
  -- TEST 1: Feed item like → 'like' notification
  -- ═══════════════════════════════════════════════════════════════════════════
  INSERT INTO feed_likes (feed_item_id, user_id) VALUES (v_feed_item_id, user_a);

  SELECT count(*) INTO v_count FROM notifications
    WHERE user_id = user_b AND actor_id = user_a AND type = 'like'
      AND data->>'feedItemId' = v_feed_item_id::text;
  SELECT id INTO v_temp_id FROM notifications
    WHERE user_id = user_b AND actor_id = user_a AND type = 'like'
      AND data->>'feedItemId' = v_feed_item_id::text
    ORDER BY created_at DESC LIMIT 1;

  IF v_count > 0 THEN
    RAISE NOTICE '  [PASS] 1/% Feed like → like notification', v_total;
    v_passed := v_passed + 1;
    v_notif_ids := v_notif_ids || v_temp_id;
  ELSE
    RAISE NOTICE '  [FAIL] 1/% Feed like → like notification (no row found)', v_total;
    v_failed := v_failed + 1;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- TEST 2: Comment on feed item → 'comment' notification to post owner
  -- ═══════════════════════════════════════════════════════════════════════════
  INSERT INTO feed_comments (feed_item_id, user_id, text)
  VALUES (v_feed_item_id, user_a, 'Nice session!')
  RETURNING id INTO v_reply_id;  -- reuse var, we need this comment for reply test

  SELECT count(*) INTO v_count FROM notifications
    WHERE user_id = user_b AND actor_id = user_a AND type = 'comment'
      AND data->>'feedItemId' = v_feed_item_id::text;
  SELECT id INTO v_temp_id FROM notifications
    WHERE user_id = user_b AND actor_id = user_a AND type = 'comment'
      AND data->>'feedItemId' = v_feed_item_id::text
    ORDER BY created_at DESC LIMIT 1;

  IF v_count > 0 THEN
    RAISE NOTICE '  [PASS] 2/% Comment → comment notification to post owner', v_total;
    v_passed := v_passed + 1;
    v_notif_ids := v_notif_ids || v_temp_id;
  ELSE
    RAISE NOTICE '  [FAIL] 2/% Comment → comment notification to post owner', v_total;
    v_failed := v_failed + 1;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- TEST 3: Reply to comment → 'reply' notification to comment author
  -- We need a 3rd perspective: user_a commented, now user_b's post.
  -- For reply test: user_a made a comment (v_reply_id). Now we insert a reply
  -- by user_b to user_a's comment. But user_b IS the post owner, so 'comment'
  -- notif to post owner is skipped (self). The 'reply' to user_a should fire.
  -- ═══════════════════════════════════════════════════════════════════════════
  INSERT INTO feed_comments (feed_item_id, user_id, text, parent_comment_id)
  VALUES (v_feed_item_id, user_b, 'Thanks!', v_reply_id);

  SELECT count(*) INTO v_count FROM notifications
    WHERE user_id = user_a AND actor_id = user_b AND type = 'reply'
      AND data->>'feedItemId' = v_feed_item_id::text;
  SELECT id INTO v_temp_id FROM notifications
    WHERE user_id = user_a AND actor_id = user_b AND type = 'reply'
      AND data->>'feedItemId' = v_feed_item_id::text
    ORDER BY created_at DESC LIMIT 1;

  IF v_count > 0 THEN
    RAISE NOTICE '  [PASS] 3/% Reply → reply notification to comment author', v_total;
    v_passed := v_passed + 1;
    v_notif_ids := v_notif_ids || v_temp_id;
  ELSE
    RAISE NOTICE '  [FAIL] 3/% Reply → reply notification to comment author', v_total;
    v_failed := v_failed + 1;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- TEST 4: Comment like → 'comment_like' notification
  -- ═══════════════════════════════════════════════════════════════════════════
  INSERT INTO comment_likes (comment_id, user_id) VALUES (v_comment_id, user_a);

  SELECT count(*) INTO v_count FROM notifications
    WHERE user_id = user_b AND actor_id = user_a AND type = 'comment_like'
      AND data->>'commentId' = v_comment_id::text;
  SELECT id INTO v_temp_id FROM notifications
    WHERE user_id = user_b AND actor_id = user_a AND type = 'comment_like'
      AND data->>'commentId' = v_comment_id::text
    ORDER BY created_at DESC LIMIT 1;

  IF v_count > 0 THEN
    RAISE NOTICE '  [PASS] 4/% Comment like → comment_like notification', v_total;
    v_passed := v_passed + 1;
    v_notif_ids := v_notif_ids || v_temp_id;
  ELSE
    RAISE NOTICE '  [FAIL] 4/% Comment like → comment_like notification', v_total;
    v_failed := v_failed + 1;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- TEST 5: @mention in comment → 'mention' notification
  -- user_a comments mentioning user_b by display_name on a DIFFERENT post
  -- (to avoid user_b getting 'comment' notif as post owner AND 'mention')
  -- Actually, the trigger skips mention if already notified as post owner.
  -- So let's test it on user_b's own post — user_b should NOT get a mention
  -- (because they already get 'comment'). Instead, let's create a post by
  -- user_a and have user_a mention user_b on their own post.
  -- ═══════════════════════════════════════════════════════════════════════════
  DECLARE
    v_feed_item_a uuid;
  BEGIN
    INSERT INTO feed_items (user_id, session_summary)
    VALUES (user_a, '{"totalDrinks": 1, "duration": 1800}'::jsonb)
    RETURNING id INTO v_feed_item_a;

    -- user_a mentions user_b on user_a's own post → no 'comment' (self-post),
    -- but 'mention' to user_b should fire
    INSERT INTO feed_comments (feed_item_id, user_id, text)
    VALUES (v_feed_item_a, user_a, 'Great night @' || user_b_name || '!')
    RETURNING id INTO v_mention_comment_id;

    SELECT count(*) INTO v_count FROM notifications
      WHERE user_id = user_b AND actor_id = user_a AND type = 'mention'
        AND data->>'feedItemId' = v_feed_item_a::text;
    SELECT id INTO v_temp_id FROM notifications
      WHERE user_id = user_b AND actor_id = user_a AND type = 'mention'
        AND data->>'feedItemId' = v_feed_item_a::text
      ORDER BY created_at DESC LIMIT 1;

    IF v_count > 0 THEN
      RAISE NOTICE '  [PASS] 5/% @mention → mention notification', v_total;
      v_passed := v_passed + 1;
      v_notif_ids := v_notif_ids || v_temp_id;
    ELSE
      RAISE NOTICE '  [FAIL] 5/% @mention → mention notification (looked for @%)', v_total, user_b_name;
      v_failed := v_failed + 1;
    END IF;

    -- Cleanup this extra feed item
    DELETE FROM feed_items WHERE id = v_feed_item_a;
  END;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- TEST 6: Follow → 'follow' notification
  -- ═══════════════════════════════════════════════════════════════════════════
  -- Remove existing follow if any, to avoid unique violation
  DELETE FROM follows WHERE follower_id = user_a AND following_id = user_b;

  INSERT INTO follows (follower_id, following_id) VALUES (user_a, user_b);

  SELECT count(*) INTO v_count FROM notifications
    WHERE user_id = user_b AND actor_id = user_a AND type = 'follow';
  SELECT id INTO v_temp_id FROM notifications
    WHERE user_id = user_b AND actor_id = user_a AND type = 'follow'
    ORDER BY created_at DESC LIMIT 1;

  IF v_count > 0 THEN
    RAISE NOTICE '  [PASS] 6/% Follow → follow notification', v_total;
    v_passed := v_passed + 1;
    v_notif_ids := v_notif_ids || v_temp_id;
  ELSE
    RAISE NOTICE '  [FAIL] 6/% Follow → follow notification', v_total;
    v_failed := v_failed + 1;
  END IF;

  -- Clean up the follow
  DELETE FROM follows WHERE follower_id = user_a AND following_id = user_b;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- TEST 7: Group member joined → 'group_join' notification to admin
  -- ═══════════════════════════════════════════════════════════════════════════
  INSERT INTO groups (name, created_by, invite_code)
  VALUES ('Test Group', user_b, 'TEST_NOTIF_' || gen_random_uuid())
  RETURNING id INTO v_group_id;

  INSERT INTO group_members (group_id, user_id, role)
  VALUES (v_group_id, user_b, 'admin');

  -- user_a joins
  INSERT INTO group_members (group_id, user_id) VALUES (v_group_id, user_a);

  SELECT count(*) INTO v_count FROM notifications
    WHERE user_id = user_b AND actor_id = user_a AND type = 'group_join'
      AND data->>'groupId' = v_group_id::text;
  SELECT id INTO v_temp_id FROM notifications
    WHERE user_id = user_b AND actor_id = user_a AND type = 'group_join'
      AND data->>'groupId' = v_group_id::text
    ORDER BY created_at DESC LIMIT 1;

  IF v_count > 0 THEN
    RAISE NOTICE '  [PASS] 7/% Group join → group_join notification to admin', v_total;
    v_passed := v_passed + 1;
    v_notif_ids := v_notif_ids || v_temp_id;
  ELSE
    RAISE NOTICE '  [FAIL] 7/% Group join → group_join notification to admin', v_total;
    v_failed := v_failed + 1;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- TEST 8: Challenge created → 'challenge_created' notification to members
  -- ═══════════════════════════════════════════════════════════════════════════
  INSERT INTO challenges (group_id, title, type, metric, start_date, end_date)
  VALUES (v_group_id, 'Test Challenge', 'individual', 'total_drinks', now(), now() + interval '7 days')
  RETURNING id INTO v_challenge_id;

  -- user_a is a member (not the creator/admin user_b), should get notified
  SELECT count(*) INTO v_count FROM notifications
    WHERE user_id = user_a AND type = 'challenge_created'
      AND data->>'groupId' = v_group_id::text;
  SELECT id INTO v_temp_id FROM notifications
    WHERE user_id = user_a AND type = 'challenge_created'
      AND data->>'groupId' = v_group_id::text
    ORDER BY created_at DESC LIMIT 1;

  IF v_count > 0 THEN
    RAISE NOTICE '  [PASS] 8/% Challenge created → challenge_created notification', v_total;
    v_passed := v_passed + 1;
    v_notif_ids := v_notif_ids || v_temp_id;
  ELSE
    RAISE NOTICE '  [FAIL] 8/% Challenge created → challenge_created notification', v_total;
    v_failed := v_failed + 1;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- CLEANUP
  -- ═══════════════════════════════════════════════════════════════════════════
  DELETE FROM groups WHERE id = v_group_id;         -- cascades to members, challenges
  DELETE FROM feed_items WHERE id = v_feed_item_id; -- cascades to likes, comments
  DELETE FROM notifications WHERE id = ANY(v_notif_ids);

  -- ═══════════════════════════════════════════════════════════════════════════
  -- RESULTS
  -- ═══════════════════════════════════════════════════════════════════════════
  RAISE NOTICE '──────────────────────────────────────────────────';
  IF v_failed = 0 THEN
    RAISE NOTICE '  ALL PASSED: %/% tests passed', v_passed, v_total;
  ELSE
    RAISE NOTICE '  RESULTS: % passed, % FAILED out of %', v_passed, v_failed, v_total;
  END IF;
  RAISE NOTICE '══════════════════════════════════════════════════';

END $$;
