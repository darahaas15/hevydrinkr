-- =============================================================
-- Tighten follows INSERT to enforce private-account gating
-- =============================================================
--
-- Prior policy only required `auth.uid() = follower_id`. That let any
-- authenticated client INSERT a follows row pointed at a private account
-- without ever going through the request/accept flow — bypassing privacy.
-- This rewrites the policy so a follow is only allowed when:
--   1) the target is public, OR
--   2) there's an accepted follow_request from the caller to that target.

DROP POLICY IF EXISTS "follows_insert" ON follows;

CREATE POLICY "follows_insert" ON follows
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = follower_id
    AND (
      NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = follows.following_id AND is_private = true
      )
      OR EXISTS (
        SELECT 1 FROM follow_requests
        WHERE requester_id = auth.uid()
          AND target_id = follows.following_id
          AND status = 'accepted'
      )
    )
  );

-- handle_follow_request_accepted (in 20260423_private_accounts.sql) inserts
-- the follows row with SECURITY DEFINER, so it bypasses this policy and the
-- accept flow continues to work.
