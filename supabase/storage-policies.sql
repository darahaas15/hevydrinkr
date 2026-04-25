-- =============================================================
-- Storage Bucket Policies
-- Run after creating the buckets in the Dashboard:
--   1. avatars        (public read OK — used in <img>)
--   2. session-photos (authenticated read; gated upload/delete by owner)
-- =============================================================

-- ---- avatars ----
-- Public read so <img src> can load without auth tokens.
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Owner-only insert/update/delete. Files must be stored under <user_id>/<filename>.
CREATE POLICY "avatars_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---- session-photos ----
-- Authenticated read only — combined with the can_view_user_data gate on
-- session_photos rows, this is sufficient. (Storage RLS doesn't easily reach
-- across to drink_sessions, so we accept any-authenticated read here and rely
-- on session_photos RLS to control which rows get returned, hence which paths
-- get fetched.)
CREATE POLICY "session_photos_auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'session-photos');

-- Files stored under <user_id>/<session_id>/<filename>. Owner-only writes.
CREATE POLICY "session_photos_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'session-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "session_photos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'session-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
