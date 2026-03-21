-- Fix: Add ON DELETE CASCADE to groups.created_by and wagers.created_by
-- Run this in Supabase SQL Editor

ALTER TABLE groups DROP CONSTRAINT groups_created_by_fkey;
ALTER TABLE groups ADD CONSTRAINT groups_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE wagers DROP CONSTRAINT wagers_created_by_fkey;
ALTER TABLE wagers ADD CONSTRAINT wagers_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;

-- Also fix challenges.winner_id
ALTER TABLE challenges DROP CONSTRAINT challenges_winner_id_fkey;
ALTER TABLE challenges ADD CONSTRAINT challenges_winner_id_fkey
  FOREIGN KEY (winner_id) REFERENCES profiles(id) ON DELETE SET NULL;
