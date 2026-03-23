-- Recover missing drink_entries from feed_items.session_summary
-- For sessions that have a feed post with drinks but no drink_entries in the DB
INSERT INTO drink_entries (id, session_id, drink_definition_id, drink_name, emoji, category, abv_percent, volume_ml, standard_drinks, timestamp)
SELECT
  gen_random_uuid(),
  fi.session_id,
  'recovered',
  drink->>'name',
  drink->>'emoji',
  drink->>'category',
  (drink->>'abvPercent')::numeric,
  (drink->>'volumeMl')::numeric,
  (drink->>'standardDrinks')::numeric,
  fi.created_at
FROM feed_items fi,
  jsonb_array_elements(fi.session_summary->'drinks') AS drink
WHERE NOT EXISTS (
  SELECT 1 FROM drink_entries de WHERE de.session_id = fi.session_id
)
AND fi.session_summary->'drinks' IS NOT NULL
AND jsonb_array_length(fi.session_summary->'drinks') > 0;
