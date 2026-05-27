-- Public "images" bucket for avatars, group icons, and session/feed photos.
-- Replaces base64 data-URLs that were stored directly in DB columns, which
-- shipped full image bytes on every query (the egress problem). Public read =>
-- served from the Storage CDN (cached egress is free, and browsers cache by URL),
-- so repeat views cost ~nothing. Authenticated users upload; owners manage their
-- own objects.

insert into storage.buckets (id, name, public, file_size_limit)
values ('images', 'images', true, 5242880)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- Anyone can read (the bucket is public; this also covers the authenticated API).
drop policy if exists "images_public_read" on storage.objects;
create policy "images_public_read"
  on storage.objects for select
  using (bucket_id = 'images');

-- Any signed-in user can upload into the bucket.
drop policy if exists "images_authenticated_insert" on storage.objects;
create policy "images_authenticated_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'images');

-- Owners (the uploader) can replace/remove their own objects.
drop policy if exists "images_owner_update" on storage.objects;
create policy "images_owner_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'images' and owner = auth.uid())
  with check (bucket_id = 'images' and owner = auth.uid());

drop policy if exists "images_owner_delete" on storage.objects;
create policy "images_owner_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'images' and owner = auth.uid());
