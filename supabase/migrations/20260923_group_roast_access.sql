-- =============================================================
-- Group Roast Access Migration
-- Run AFTER 20260731_drink_cost.sql
--
-- Weekly roasts belong to their group, but the roast tables were
-- readable by every signed-in user, awards could be written into any
-- group's recap, and anyone could insert themselves into group_members
-- using a group id read from those tables (skipping the invite code).
--
-- Covers:
--   1. roast_recaps / roast_awards: members-only reads
--   2. roast_awards: members-only writes, into their own group's recap
--   3. roast_streaks / group_records: drop the read-everything policies
--      (the existing members-only ALL policies still cover reads)
--   4. group_members: a direct insert is only for a group's creator
--      adding themselves; everyone else joins via join_group_by_invite
-- =============================================================

-- -----------------------------------------------------------------------------
-- 1. Recaps and awards are visible to members of the group only
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "roast_recaps_select" ON roast_recaps;
CREATE POLICY "roast_recaps_select" ON roast_recaps
  FOR SELECT TO authenticated
  USING (is_group_member(group_id));

DROP POLICY IF EXISTS "roast_awards_select" ON roast_awards;
CREATE POLICY "roast_awards_select" ON roast_awards
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM roast_recaps r
    WHERE r.id = roast_awards.recap_id AND is_group_member(r.group_id)
  ));

-- -----------------------------------------------------------------------------
-- 2. Awards can only be written into a recap of a group you belong to
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "roast_awards_insert" ON roast_awards;
CREATE POLICY "roast_awards_insert" ON roast_awards
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM roast_recaps r
    WHERE r.id = roast_awards.recap_id AND is_group_member(r.group_id)
  ));

-- -----------------------------------------------------------------------------
-- 3. Streaks and records: members-only via roast_streaks_all / group_records_all
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "roast_streaks_select" ON roast_streaks;
DROP POLICY IF EXISTS "group_records_select" ON group_records;

-- -----------------------------------------------------------------------------
-- 4. Joining a group goes through the invite code
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER because a creator can't see their new group through the
-- members-only groups policy until this very insert makes them a member.
CREATE OR REPLACE FUNCTION is_group_creator(p_group_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM groups
    WHERE id = p_group_id AND created_by = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "gm_insert" ON group_members;
CREATE POLICY "gm_insert" ON group_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_group_creator(group_id));
