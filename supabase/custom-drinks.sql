-- Custom drinks table — user-created drink definitions
-- Run this in Supabase SQL Editor

CREATE TABLE custom_drinks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '🍸',
  category    TEXT NOT NULL DEFAULT 'other',
  abv_percent REAL NOT NULL,
  volume_ml   REAL NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_custom_drinks_user ON custom_drinks(user_id);

ALTER TABLE custom_drinks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_drinks_select" ON custom_drinks FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "custom_drinks_insert" ON custom_drinks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "custom_drinks_delete" ON custom_drinks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
