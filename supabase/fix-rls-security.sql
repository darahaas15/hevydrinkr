-- ============================================================
-- SECURITY FIX: Tighten RLS policies
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Restrict session photos to session owner only
DROP POLICY IF EXISTS "photos_select" ON session_photos;
CREATE POLICY "photos_select" ON session_photos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM drink_sessions WHERE id = session_id AND user_id = auth.uid()));

-- 2. Restrict drink entries to session owner only
DROP POLICY IF EXISTS "drinks_select" ON drink_entries;
CREATE POLICY "drinks_select" ON drink_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM drink_sessions WHERE id = session_id AND user_id = auth.uid()));

-- 3. Restrict rounds to session owner
DROP POLICY IF EXISTS "rounds_select" ON rounds;
CREATE POLICY "rounds_select" ON rounds FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM drink_sessions WHERE id = session_id AND user_id = auth.uid()));

-- 4. Challenge participants: restrict to group members
DROP POLICY IF EXISTS "cp_insert" ON challenge_participants;
CREATE POLICY "cp_insert" ON challenge_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM challenges c
    JOIN group_members gm ON gm.group_id = c.group_id
    WHERE c.id = challenge_id AND gm.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "cp_update" ON challenge_participants;
CREATE POLICY "cp_update" ON challenge_participants FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM challenges c
    JOIN group_members gm ON gm.group_id = c.group_id
    WHERE c.id = challenge_id AND gm.user_id = auth.uid()
  ));

-- 5. Wager participants: restrict to group members
DROP POLICY IF EXISTS "wp_insert" ON wager_participants;
CREATE POLICY "wp_insert" ON wager_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM wagers w
    JOIN challenges c ON c.id = w.challenge_id
    JOIN group_members gm ON gm.group_id = c.group_id
    WHERE w.id = wager_id AND gm.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "wp_update" ON wager_participants;
CREATE POLICY "wp_update" ON wager_participants FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
