-- Remove emoji from feed_likes: make nullable, clear existing values
ALTER TABLE feed_likes ALTER COLUMN emoji DROP NOT NULL;
ALTER TABLE feed_likes ALTER COLUMN emoji SET DEFAULT NULL;
UPDATE feed_likes SET emoji = NULL;
