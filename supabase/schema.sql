-- ============================================================
-- drinkr — Full Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Profiles (extends auth.users)
CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT UNIQUE NOT NULL CHECK (username ~ '^[a-z0-9_]{3,}$'),
  display_name TEXT NOT NULL,
  avatar_url   TEXT,
  bio          TEXT DEFAULT '',
  gender       TEXT CHECK (gender IN ('male', 'female', 'other')) DEFAULT 'other',
  weight_kg    REAL DEFAULT 70,
  height_cm    REAL DEFAULT NULL,
  is_demo      BOOLEAN DEFAULT FALSE,
  is_private   BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 2. Follows
CREATE TABLE follows (
  follower_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);
CREATE INDEX idx_follows_following ON follows(following_id);

-- 2b. Follow Requests
CREATE TABLE follow_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(requester_id, target_id)
);
CREATE INDEX idx_follow_requests_target_pending ON follow_requests(target_id) WHERE status = 'pending';
CREATE INDEX idx_follow_requests_requester ON follow_requests(requester_id);

-- 3. Drink Sessions
CREATE TABLE drink_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status                TEXT CHECK (status IN ('active', 'completed', 'abandoned')) NOT NULL DEFAULT 'active',
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at              TIMESTAMPTZ,
  venue                 TEXT NOT NULL DEFAULT '',
  total_standard_drinks REAL DEFAULT 0,
  total_volume_ml       REAL DEFAULT 0,
  peak_bac_estimate     REAL DEFAULT 0,
  duration_minutes      INT DEFAULT 0,
  is_party_mode         BOOLEAN DEFAULT FALSE,
  party_id              UUID,
  mood                  TEXT CHECK (mood IN ('legendary', 'great', 'good', 'meh', 'rough')),
  notes                 TEXT DEFAULT '',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sessions_user ON drink_sessions(user_id);
CREATE INDEX idx_sessions_status ON drink_sessions(status);

-- 4. Drink Entries
CREATE TABLE drink_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES drink_sessions(id) ON DELETE CASCADE,
  drink_definition_id TEXT NOT NULL,
  drink_name          TEXT NOT NULL,
  emoji               TEXT NOT NULL,
  category            TEXT NOT NULL,
  abv_percent         REAL NOT NULL,
  volume_ml           REAL NOT NULL,
  standard_drinks     REAL NOT NULL,
  timestamp           TIMESTAMPTZ NOT NULL DEFAULT now(),
  round_id            UUID,
  notes               TEXT DEFAULT '',
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_drinks_session ON drink_entries(session_id);

-- 5. Rounds
CREATE TABLE rounds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES drink_sessions(id) ON DELETE CASCADE,
  bought_by_user_id UUID NOT NULL REFERENCES profiles(id),
  bought_by_name    TEXT NOT NULL,
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT now(),
  cost              REAL,
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_rounds_session ON rounds(session_id);

-- 6. Session Photos
CREATE TABLE session_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES drink_sessions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url          TEXT NOT NULL,
  sort_order   INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_photos_session ON session_photos(session_id);

-- 7. Personal Records
CREATE TABLE personal_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,
  value           REAL NOT NULL,
  formatted_value TEXT NOT NULL,
  previous_value  REAL,
  session_id      UUID REFERENCES drink_sessions(id) ON DELETE SET NULL,
  achieved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  celebrated      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_prs_user ON personal_records(user_id);
CREATE UNIQUE INDEX idx_prs_user_category ON personal_records(user_id, category);

-- 8. Feed Items
CREATE TABLE feed_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id      UUID REFERENCES drink_sessions(id) ON DELETE SET NULL,
  session_summary JSONB NOT NULL,
  photos          TEXT[] DEFAULT '{}',
  caption         TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_feed_user ON feed_items(user_id);
CREATE INDEX idx_feed_created ON feed_items(created_at DESC);

-- 9. Feed Likes
CREATE TABLE feed_likes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_item_id UUID NOT NULL REFERENCES feed_items(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(feed_item_id, user_id)
);
CREATE INDEX idx_likes_feed ON feed_likes(feed_item_id);

-- 10. Feed Comments
CREATE TABLE feed_comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_item_id UUID NOT NULL REFERENCES feed_items(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_comments_feed ON feed_comments(feed_item_id);
CREATE INDEX idx_comments_parent ON feed_comments(parent_comment_id);
CREATE INDEX idx_comments_feed_created ON feed_comments(feed_item_id, created_at);

-- 11. Groups
CREATE TABLE groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  emoji       TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_by  UUID NOT NULL REFERENCES profiles(id),
  icon_url    TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 12. Group Members
CREATE TABLE group_members (
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  joined_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX idx_gm_user ON group_members(user_id);

-- 13. Challenges
CREATE TABLE challenges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT DEFAULT '',
  type         TEXT CHECK (type IN ('individual', 'team', 'head-to-head')) NOT NULL,
  metric       TEXT NOT NULL,
  target_value REAL,
  start_date   TIMESTAMPTZ NOT NULL,
  end_date     TIMESTAMPTZ NOT NULL,
  status       TEXT CHECK (status IN ('pending', 'active', 'completed', 'expired')) DEFAULT 'pending',
  winner_id    UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_challenges_group ON challenges(group_id);

-- 14. Challenge Participants
CREATE TABLE challenge_participants (
  challenge_id  UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  current_value REAL DEFAULT 0,
  rank          INT DEFAULT 0,
  PRIMARY KEY (challenge_id, user_id)
);

-- 15. Wagers
CREATE TABLE wagers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID UNIQUE NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES profiles(id),
  description  TEXT NOT NULL,
  stake        TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 16. Wager Participants
CREATE TABLE wager_participants (
  wager_id  UUID NOT NULL REFERENCES wagers(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  accepted  BOOLEAN DEFAULT FALSE,
  outcome   TEXT CHECK (outcome IN ('pending', 'won', 'lost', 'draw', 'cancelled')) DEFAULT 'pending',
  PRIMARY KEY (wager_id, user_id)
);

-- 17. Party Sessions
CREATE TABLE party_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  host_user_id UUID NOT NULL REFERENCES profiles(id),
  name         TEXT NOT NULL,
  status       TEXT CHECK (status IN ('waiting', 'active', 'ended')) DEFAULT 'waiting',
  started_at   TIMESTAMPTZ,
  ended_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 18. Party Participants
CREATE TABLE party_participants (
  party_id              UUID NOT NULL REFERENCES party_sessions(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id            UUID REFERENCES drink_sessions(id),
  total_standard_drinks REAL DEFAULT 0,
  is_active             BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (party_id, user_id)
);

-- 19. Party Drink Events
CREATE TABLE party_drink_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id    UUID NOT NULL REFERENCES party_sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id),
  drink_name  TEXT NOT NULL,
  drink_emoji TEXT NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pde_party ON party_drink_events(party_id);

-- 20. Reports (content moderation)
CREATE TABLE reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'user')),
  target_id   UUID NOT NULL,
  reason      TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'underage', 'dangerous', 'other')),
  details     TEXT DEFAULT '',
  status      TEXT CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')) DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_reports_status ON reports(status);

-- 21. Blocked Users
CREATE TABLE blocked_users (
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);
CREATE INDEX idx_blocked_blocker ON blocked_users(blocker_id);

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, gender, weight_kg, height_cm)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'display_name',
    COALESCE(NEW.raw_user_meta_data->>'gender', 'other'),
    COALESCE((NEW.raw_user_meta_data->>'weight_kg')::REAL, 70),
    (NEW.raw_user_meta_data->>'height_cm')::REAL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE drink_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drink_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE wagers ENABLE ROW LEVEL SECURITY;
ALTER TABLE wager_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_drink_events ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, only owner can update
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Follows: anyone can read, owner can insert/delete
CREATE POLICY "follows_select" ON follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "follows_insert" ON follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete" ON follows FOR DELETE TO authenticated USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- Follow requests: only requester/target can see; requester inserts; target updates; either deletes
ALTER TABLE follow_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follow_requests_select" ON follow_requests FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id);
CREATE POLICY "follow_requests_insert" ON follow_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "follow_requests_update" ON follow_requests FOR UPDATE TO authenticated
  USING (auth.uid() = target_id);
CREATE POLICY "follow_requests_delete" ON follow_requests FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- Sessions: anyone can read (leaderboards), owner can CUD
CREATE POLICY "sessions_select" ON drink_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "sessions_insert" ON drink_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sessions_update" ON drink_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sessions_delete" ON drink_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Drink entries: anyone can read, session owner can CUD
CREATE POLICY "drinks_select" ON drink_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "drinks_insert" ON drink_entries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM drink_sessions WHERE id = session_id AND user_id = auth.uid()));
CREATE POLICY "drinks_update" ON drink_entries FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM drink_sessions WHERE id = session_id AND user_id = auth.uid()));
CREATE POLICY "drinks_delete" ON drink_entries FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM drink_sessions WHERE id = session_id AND user_id = auth.uid()));

-- Rounds: same as drink entries
CREATE POLICY "rounds_select" ON rounds FOR SELECT TO authenticated USING (true);
CREATE POLICY "rounds_insert" ON rounds FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM drink_sessions WHERE id = session_id AND user_id = auth.uid()));

-- Session photos: same pattern
CREATE POLICY "photos_select" ON session_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "photos_insert" ON session_photos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM drink_sessions WHERE id = session_id AND user_id = auth.uid()));
CREATE POLICY "photos_delete" ON session_photos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM drink_sessions WHERE id = session_id AND user_id = auth.uid()));

-- Personal records
CREATE POLICY "prs_select" ON personal_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "prs_insert" ON personal_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prs_update" ON personal_records FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Feed items
CREATE POLICY "feed_select" ON feed_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "feed_insert" ON feed_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "feed_update" ON feed_items FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "feed_delete" ON feed_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Feed likes
CREATE POLICY "likes_select" ON feed_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes_insert" ON feed_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete" ON feed_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Feed comments
CREATE POLICY "comments_select" ON feed_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert" ON feed_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON feed_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Groups: authenticated can read and create
CREATE POLICY "groups_select" ON groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "groups_insert" ON groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "groups_update" ON groups FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "groups_delete" ON groups FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Group members
CREATE POLICY "gm_select" ON group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "gm_insert" ON group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gm_delete" ON group_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM groups WHERE id = group_id AND created_by = auth.uid()));

-- Challenges
CREATE POLICY "challenges_select" ON challenges FOR SELECT TO authenticated USING (true);
CREATE POLICY "challenges_insert" ON challenges FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM group_members WHERE group_id = challenges.group_id AND user_id = auth.uid()
  ));
CREATE POLICY "challenges_delete" ON challenges FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM groups WHERE id = challenges.group_id AND created_by = auth.uid()
  ));

-- Challenge participants
CREATE POLICY "cp_select" ON challenge_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "cp_insert" ON challenge_participants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cp_update" ON challenge_participants FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Wagers
CREATE POLICY "wagers_select" ON wagers FOR SELECT TO authenticated USING (true);
CREATE POLICY "wagers_insert" ON wagers FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Wager participants
CREATE POLICY "wp_select" ON wager_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "wp_insert" ON wager_participants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wp_update" ON wager_participants FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Party sessions
CREATE POLICY "party_select" ON party_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "party_insert" ON party_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_user_id);
CREATE POLICY "party_update" ON party_sessions FOR UPDATE TO authenticated USING (auth.uid() = host_user_id);

-- Party participants
CREATE POLICY "pp_select" ON party_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "pp_insert" ON party_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pp_update" ON party_participants FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Party drink events
CREATE POLICY "pde_select" ON party_drink_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "pde_insert" ON party_drink_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Reports: user can insert their own, only admins can read all
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_insert" ON reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_select_own" ON reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

-- Blocked users: user can manage their own blocks
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked_select" ON blocked_users FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "blocked_insert" ON blocked_users FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocked_delete" ON blocked_users FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- ============================================================
-- Storage Buckets (run these separately or via dashboard)
-- ============================================================
-- CREATE POLICY on storage.objects for avatars and session-photos
-- Set up via Supabase Dashboard > Storage > New Bucket:
--   1. "avatars" (public)
--   2. "session-photos" (public)
