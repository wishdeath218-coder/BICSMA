-- Store bulletin images in a public bucket so residents can view them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'announcement-images',
  'announcement-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Allow announcement image uploads" on storage.objects;
create policy "Allow announcement image uploads"
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'announcement-images'
    and (storage.foldername(name))[1] = 'announcements'
  );
