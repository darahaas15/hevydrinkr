-- =============================================================
-- Tighten follows SELECT policy so private accounts' social graph
-- is actually private. Prior policy (USING (true)) let any logged-in
-- user query followers/following of a private account directly.
-- Depends on can_view_user_data() from 20260423_private_accounts.sql.
-- =============================================================

DROP POLICY IF EXISTS "follows_select" ON follows;
CREATE POLICY "follows_select" ON follows
  FOR SELECT TO authenticated
  USING (can_view_user_data(follower_id) AND can_view_user_data(following_id));
