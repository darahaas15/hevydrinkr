-- Comment replies: add parent_comment_id for 1-level threading
ALTER TABLE feed_comments ADD COLUMN parent_comment_id UUID REFERENCES feed_comments(id) ON DELETE CASCADE;
CREATE INDEX idx_comments_parent ON feed_comments(parent_comment_id);

-- Comment likes table
CREATE TABLE comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES feed_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id)
);
CREATE INDEX idx_comment_likes_comment ON comment_likes(comment_id);
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comment_likes_select" ON comment_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "comment_likes_insert" ON comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comment_likes_delete" ON comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);
