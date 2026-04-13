-- Weekly Roast: replaces challenges with auto-generated weekly group recaps

-- ── New tables ──

CREATE TABLE IF NOT EXISTS roast_recaps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  week_key    TEXT NOT NULL,
  week_start  TIMESTAMPTZ NOT NULL,
  week_end    TIMESTAMPTZ NOT NULL,
  summary     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, week_key)
);
CREATE INDEX IF NOT EXISTS idx_roast_recaps_group ON roast_recaps(group_id);

CREATE TABLE IF NOT EXISTS roast_awards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recap_id     UUID NOT NULL REFERENCES roast_recaps(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  award_type   TEXT NOT NULL,
  title        TEXT NOT NULL,
  roast_line   TEXT NOT NULL,
  stat_value   REAL,
  stat_label   TEXT,
  emoji        TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_roast_awards_recap ON roast_awards(recap_id);
CREATE INDEX IF NOT EXISTS idx_roast_awards_user ON roast_awards(user_id);

CREATE TABLE IF NOT EXISTS roast_streaks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  award_type    TEXT NOT NULL,
  award_title   TEXT NOT NULL DEFAULT '',
  current_count INT NOT NULL DEFAULT 1,
  longest_count INT NOT NULL DEFAULT 1,
  last_week_key TEXT NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id, award_type)
);
CREATE INDEX IF NOT EXISTS idx_roast_streaks_group ON roast_streaks(group_id);

CREATE TABLE IF NOT EXISTS group_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  record_type     TEXT NOT NULL,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  value           REAL NOT NULL,
  formatted_value TEXT NOT NULL,
  week_key        TEXT NOT NULL,
  achieved_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, record_type)
);
CREATE INDEX IF NOT EXISTS idx_group_records_group ON group_records(group_id);

-- ── RLS ──

ALTER TABLE roast_recaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE roast_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE roast_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roast_recaps_select" ON roast_recaps FOR SELECT TO authenticated USING (true);
CREATE POLICY "roast_awards_select" ON roast_awards FOR SELECT TO authenticated USING (true);
CREATE POLICY "roast_streaks_select" ON roast_streaks FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_records_select" ON group_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "roast_recaps_insert" ON roast_recaps FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM group_members WHERE group_id = roast_recaps.group_id AND user_id = auth.uid()));

CREATE POLICY "roast_awards_insert" ON roast_awards FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "roast_streaks_all" ON roast_streaks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members WHERE group_id = roast_streaks.group_id AND user_id = auth.uid()));

CREATE POLICY "group_records_all" ON group_records FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM group_members WHERE group_id = group_records.group_id AND user_id = auth.uid()));
